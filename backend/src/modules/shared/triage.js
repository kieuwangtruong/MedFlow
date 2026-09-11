/**
 * ESI 5-Level Triage & Clinical Urgency Engine for Healthcare HIS/EMR
 * Implements Emergency Severity Index (ESI Version 4 / American College of Emergency Physicians & ENA standard)
 * with robust Vital Signs mapping, Anti-Under-Triage, and Anti-Over-Triage safeguards.
 */

const ESI_LEVELS = {
  P1: {
    level: 1,
    code: 'P1',
    category: 'RESUSCITATION',
    vietnameseTitle: 'Cấp cứu tối khẩn',
    priority: 'EMERGENCY',
    maxWaitMinutes: 0,
    severityScore: 100,
    description: 'Đe dọa tính mạng tức thời, cần hồi sức cấp cứu ngay lập tức',
  },
  P2: {
    level: 2,
    code: 'P2',
    category: 'EMERGENT',
    vietnameseTitle: 'Cấp cứu nguy kịch',
    priority: 'EMERGENCY',
    maxWaitMinutes: 15,
    severityScore: 80,
    description: 'Tình trạng nguy cơ cao, lú lẫn/lơ mơ, hoặc đau dữ dội kèm bất thường sinh hiệu',
  },
  P3: {
    level: 3,
    code: 'P3',
    category: 'URGENT',
    vietnameseTitle: 'Khẩn cấp',
    priority: 'URGENT',
    maxWaitMinutes: 30,
    severityScore: 50,
    description: 'Sinh hiệu ổn định, cần từ 2 tài nguyên cận lâm sàng trở lên để chẩn đoán',
  },
  P4: {
    level: 4,
    code: 'P4',
    category: 'SEMI_URGENT',
    vietnameseTitle: 'Bán khẩn',
    priority: 'NORMAL',
    maxWaitMinutes: 60,
    severityScore: 25,
    description: 'Sinh hiệu ổn định, chỉ cần 1 tài nguyên cận lâm sàng (vd: 1 X-quang hoặc 1 test nhanh)',
  },
  P5: {
    level: 5,
    code: 'P5',
    category: 'NON_URGENT',
    vietnameseTitle: 'Không khẩn',
    priority: 'NON_URGENT',
    maxWaitMinutes: 120,
    severityScore: 10,
    description: 'Khám thông thường, không cần tài nguyên cận lâm sàng phức tạp (kê đơn, tái khám)',
  },
};

// High risk clinical red flag keywords in Vietnamese & Medical English
const CRITICAL_RED_FLAGS = [
  'ngừng tim', 'ngừng thở', 'hôn mê', 'sốc', 'mất ý thức', 'ngất', 'co giật',
  'anaphylaxis', 'sốc phản vệ', 'cardiac arrest', 'respiratory arrest', 'unresponsive'
];

const HIGH_RISK_RED_FLAGS = [
  'đau thắt ngực', 'đau ngực dữ dội', 'khó thở nặng', 'khó thở thanh quản',
  'yếu nửa người', 'méo miệng', 'nói ngọng', 'tai biến', 'đột quỵ', 'nôn ra máu',
  'ho ra máu sét đánh', 'chấn thương đầu nặng', 'vết thương thấu bụng', 'gãy xương hở',
  'chest pain', 'acute stroke', 'hemoptysis', 'hematemesis'
];

/**
 * Parses and normalizes vital signs and assessment payload
 */
function normalizeVitals(input = {}) {
  const payload = input.vitals || input;
  const painLevel = Number(payload.painLevel ?? input.painLevel ?? 0);
  const spo2 = payload.spo2 != null ? Number(payload.spo2) : null;
  const pulse = payload.pulse != null ? Number(payload.pulse) : (payload.heartRate != null ? Number(payload.heartRate) : null);
  const sbp = payload.systolicBp != null ? Number(payload.systolicBp) : (payload.sbp != null ? Number(payload.sbp) : null);
  const dbp = payload.diastolicBp != null ? Number(payload.diastolicBp) : (payload.dbp != null ? Number(payload.dbp) : null);
  const rr = payload.respiratoryRate != null ? Number(payload.respiratoryRate) : (payload.rr != null ? Number(payload.rr) : null);
  const temp = payload.temperature != null ? Number(payload.temperature) : null;
  const gcs = payload.gcs != null ? Number(payload.gcs) : null;
  const avpu = (payload.avpu || input.avpu || 'A').toString().toUpperCase().trim();
  const dangerSigns = Array.isArray(input.dangerSigns)
    ? input.dangerSigns
    : (Array.isArray(payload.dangerSigns) ? payload.dangerSigns : []);
  const description = (input.description || payload.description || '').toLowerCase();
  const expectedResources = Number(input.expectedResources ?? payload.expectedResources ?? 2);

  return {
    painLevel: Math.max(0, Math.min(10, isNaN(painLevel) ? 0 : painLevel)),
    spo2,
    pulse,
    sbp,
    dbp,
    rr,
    temp,
    gcs,
    avpu: ['A', 'V', 'P', 'U'].includes(avpu) ? avpu : 'A',
    dangerSigns,
    description,
    expectedResources: Math.max(0, isNaN(expectedResources) ? 2 : expectedResources),
  };
}

/**
 * ESI Triage Classifier
 * Evaluates in 4 steps according to ESI decision algorithm:
 * Step A: Does patient require immediate life-saving intervention? -> Level 1 (P1)
 * Step B: Is this a high-risk situation, confused/lethargic/disoriented, or severe distress? -> Level 2 (P2)
 * Step C: How many different resources are needed? -> Levels 3, 4, or 5
 * Step D: Danger zone vitals check (Vital Sign instability escalates Level 3 -> Level 2)
 */
function classifyTriage(input = {}) {
  const v = normalizeVitals(input);
  const rationales = [];
  const flags = {
    underTriagePrevention: false,
    overTriageAdjusted: false,
    vitalSignTriggered: false,
  };

  const dangerText = `${v.dangerSigns.join(' ')} ${v.description}`;
  const hasCriticalRedFlag = CRITICAL_RED_FLAGS.some((flag) => dangerText.includes(flag));
  const hasHighRiskRedFlag = HIGH_RISK_RED_FLAGS.some((flag) => dangerText.includes(flag));

  // --- STEP A: ESI Level 1 (Resuscitation / P1 Cấp cứu tối khẩn) ---
  // Criteria: Cardiac/respiratory arrest, severe hypoxemia, unresponsive, profound shock
  const isP1LifeThreat = (
    hasCriticalRedFlag
    || v.avpu === 'U'
    || (v.gcs != null && v.gcs < 9)
    || (v.spo2 != null && v.spo2 < 88)
    || (v.sbp != null && v.sbp > 0 && v.sbp < 80)
    || (v.pulse != null && (v.pulse < 40 || v.pulse > 160))
    || (v.rr != null && (v.rr < 8 || v.rr > 40))
  );

  if (isP1LifeThreat) {
    if (v.spo2 != null && v.spo2 < 88) rationales.push(`SpO2 nguy kịch (${v.spo2}% < 88%)`);
    if (v.sbp != null && v.sbp < 80) rationales.push(`Tụt huyết áp nặng (Huyết áp tâm thu ${v.sbp} mmHg < 80)`);
    if (v.avpu === 'U' || (v.gcs != null && v.gcs < 9)) rationales.push(`Hôn mê / Mất ý thức (AVPU: ${v.avpu}, GCS: ${v.gcs || '<9'})`);
    if (v.pulse != null && (v.pulse < 40 || v.pulse > 160)) rationales.push(`Rối loạn nhịp tim nguy kịch (${v.pulse} bpm)`);
    if (v.rr != null && (v.rr < 8 || v.rr > 40)) rationales.push(`Suy hô hấp cấp / Ngừng thở (Nhịp thở ${v.rr} lần/phút)`);
    if (hasCriticalRedFlag) rationales.push('Phát hiện dấu hiệu đe dọa sinh mạng tối khẩn');

    // Anti-Under-Triage: Even if patient didn't complain of high pain, vitals triggered P1
    if (v.painLevel < 7) flags.underTriagePrevention = true;

    return buildResult(ESI_LEVELS.P1, rationales, v, flags);
  }

  // --- STEP B: ESI Level 2 (Emergent / P2 Nguy kịch) ---
  // Criteria: High risk situations, altered mental status, severe pain with clinical risk, severe vitals
  const isHighRiskVitals = (
    (v.spo2 != null && v.spo2 >= 88 && v.spo2 <= 92)
    || (v.pulse != null && (v.pulse >= 130 || (v.pulse >= 40 && v.pulse <= 49)))
    || (v.sbp != null && (v.sbp > 200 || (v.sbp >= 80 && v.sbp <= 89)))
    || (v.rr != null && (v.rr >= 30 || (v.rr >= 8 && v.rr <= 10)))
  );

  const isAlteredMental = v.avpu === 'V' || v.avpu === 'P' || (v.gcs != null && v.gcs >= 9 && v.gcs <= 13);
  const isP2Emergent = hasHighRiskRedFlag || isHighRiskVitals || isAlteredMental;

  if (isP2Emergent) {
    if (hasHighRiskRedFlag) rationales.push('Dấu hiệu cảnh báo nguy cơ cao (đau ngực cấp / tai biến / xuất huyết)');
    if (isAlteredMental) rationales.push(`Rối loạn ý thức / Lơ mơ (AVPU: ${v.avpu}, GCS: ${v.gcs || '9-13'})`);
    if (isHighRiskVitals) {
      flags.vitalSignTriggered = true;
      if (v.spo2 != null && v.spo2 <= 92) rationales.push(`Thiếu oxy mô (SpO2 ${v.spo2}%)`);
      if (v.pulse != null && v.pulse >= 130) rationales.push(`Mạch nhanh nguy cơ (${v.pulse} bpm)`);
      if (v.sbp != null && v.sbp > 200) rationales.push(`Cơn tăng huyết áp kịch phát (HA ${v.sbp} mmHg)`);
      if (v.rr != null && v.rr >= 30) rationales.push(`Thở nhanh nguy cơ (${v.rr} l/p)`);
    }

    if (v.painLevel < 7 && isHighRiskVitals) flags.underTriagePrevention = true;
    return buildResult(ESI_LEVELS.P2, rationales, v, flags);
  }

  // --- ANTI-OVER-TRIAGE CHECK FOR SEVERE PAIN ---
  // Patient rates pain >= 7, but ALL vital signs are completely normal, AVPU = 'A', GCS = 15, no red flags
  // In true ESI, severe pain without high-risk etiology or hemodynamic compromise is evaluated carefully
  // to avoid starving ICU/Resuscitation beds of emergent resources.
  const hasStableVitals = (
    (v.spo2 == null || v.spo2 >= 95)
    && (v.pulse == null || (v.pulse >= 60 && v.pulse <= 100))
    && (v.sbp == null || (v.sbp >= 90 && v.sbp <= 140))
    && (v.rr == null || (v.rr >= 12 && v.rr <= 20))
    && v.avpu === 'A'
    && (v.gcs == null || v.gcs >= 14)
  );

  if (v.painLevel >= 7 && hasStableVitals && !hasHighRiskRedFlag) {
    flags.overTriageAdjusted = true;
    rationales.push(`Đau mức độ ${v.painLevel}/10 nhưng sinh hiệu hoàn toàn ổn định -> Phân loại P3 (Khẩn cấp, chống Over-triage)`);
    return buildResult(ESI_LEVELS.P3, rationales, v, flags);
  }

  // If severe pain with borderline vitals
  if (v.painLevel >= 8) {
    rationales.push(`Đau dữ dội (${v.painLevel}/10) cần can thiệp giảm đau khẩn`);
    return buildResult(ESI_LEVELS.P2, rationales, v, flags);
  }

  // --- STEP C: ESI Level 3, 4, 5 by Resource Utilization ---
  // Many resources (>= 2): Level 3
  // One resource (1): Level 4
  // Zero resources (0): Level 5
  if (v.expectedResources >= 2 || (v.painLevel >= 4 && v.painLevel <= 6)) {
    rationales.push(
      v.expectedResources >= 2
        ? `Cần từ ${v.expectedResources} tài nguyên cận lâm sàng (Lab, X-quang/CĐHA)`
        : `Mức độ đau trung bình (${v.painLevel}/10)`
    );
    return buildResult(ESI_LEVELS.P3, rationales, v, flags);
  }

  if (v.expectedResources === 1 || (v.painLevel >= 1 && v.painLevel <= 3)) {
    rationales.push('Cần 1 tài nguyên cận lâm sàng đơn lẻ (vd: 1 phim X-quang hoặc 1 xét nghiệm)');
    return buildResult(ESI_LEVELS.P4, rationales, v, flags);
  }

  rationales.push('Không cần cận lâm sàng phức tạp (khám lâm sàng, kê đơn ngoại trú)');
  return buildResult(ESI_LEVELS.P5, rationales, v, flags);
}

function buildResult(esiConfig, rationales, vitals, flags) {
  return {
    level: esiConfig.level,
    code: esiConfig.code,
    category: esiConfig.category,
    priority: esiConfig.priority,
    vietnameseTitle: esiConfig.vietnameseTitle,
    maxWaitMinutes: esiConfig.maxWaitMinutes,
    severityScore: esiConfig.severityScore,
    rationale: rationales.join('; ') || esiConfig.description,
    flags,
    vitalsSummary: {
      spo2: vitals.spo2,
      pulse: vitals.pulse,
      bp: vitals.sbp != null ? `${vitals.sbp}/${vitals.dbp || '-'}` : null,
      rr: vitals.rr,
      temp: vitals.temp,
      avpu: vitals.avpu,
      painLevel: vitals.painLevel,
    },
  };
}

module.exports = {
  ESI_LEVELS,
  classifyTriage,
  normalizeVitals,
};

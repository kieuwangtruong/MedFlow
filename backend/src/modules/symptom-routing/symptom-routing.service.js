const AppError = require('../../errors/app-error');
const { requestAi } = require('../ai-gateway/ai-client');

const DISCLAIMER = 'Kết quả chỉ hỗ trợ phân loại khoa tiếp nhận, không phải chẩn đoán y khoa.';
const NEGATIONS = ['khong', 'chua', 'khong bi', 'khong co'];
const EMERGENCY_RULES = [
  {
    code: 'SUDDEN_NEURO_DEFICIT',
    label: 'Dấu hiệu thần kinh cần đánh giá khẩn cấp',
    alternatives: [
      ['te nua nguoi'], ['te mot ben'], ['yeu nua nguoi'], ['yeu mot ben'],
      ['liet nua nguoi'], ['meo mieng'], ['noi kho'], ['noi ngong'],
    ],
  },
  {
    code: 'LOSS_OF_CONSCIOUSNESS',
    label: 'Mất ý thức hoặc bất tỉnh',
    alternatives: [['bat tinh'], ['mat y thuc'], ['ngat', 'kho danh thuc']],
  },
  {
    code: 'SEIZURE_ACTIVE',
    label: 'Co giật',
    alternatives: [['co giat'], ['giat toan than']],
  },
  {
    code: 'SEVERE_BREATHING_DIFFICULTY',
    label: 'Khó thở nghiêm trọng',
    alternatives: [['kho tho nghiem trong'], ['khong noi duoc cau dai'], ['tim tai', 'kho tho']],
  },
  {
    code: 'SEVERE_BLEEDING',
    label: 'Chảy máu nghiêm trọng',
    alternatives: [['chay mau nhieu'], ['mau chay lien tuc'], ['chay mau', 'choang']],
  },
];

function normalizeVietnamese(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNegated(text, term) {
  const position = text.indexOf(term);
  if (position < 0) return false;
  const prefix = text.slice(Math.max(0, position - 18), position).trim();
  return NEGATIONS.some((negation) => prefix.includes(negation));
}

function findEmergencyRule(normalizedText) {
  for (const rule of EMERGENCY_RULES) {
    for (const terms of rule.alternatives) {
      if (terms.every((term) => normalizedText.includes(term) && !isNegated(normalizedText, term))) {
        return { ...rule, matchedTerms: terms };
      }
    }
  }
  return null;
}

function fallbackRouting(payload) {
  const normalizedText = normalizeVietnamese(payload?.symptom_text);
  const emergencyRule = findEmergencyRule(normalizedText);

  if (emergencyRule) {
    return {
      normalized_text: normalizedText,
      is_red_flag: true,
      priority: 'EMERGENCY',
      action: 'EMERGENCY_ROUTE',
      recommendations: [{
        rank: 1,
        department_code: 'ER',
        department_name: 'Khoa Cấp cứu',
        clinic_room: 'CC-102',
        confidence: 1,
        eligible: true,
        estimated_wait: 0,
        waiting_count: 0,
      }],
      confidence_low: false,
      requires_human_review: true,
      red_flag: {
        code: emergencyRule.code,
        label: emergencyRule.label,
        matched_terms: emergencyRule.matchedTerms,
      },
      message: 'Phát hiện dấu hiệu cần đánh giá khẩn cấp: chuyển Cấp cứu và yêu cầu nhân viên xác nhận ngay.',
      disclaimer: DISCLAIMER,
      source: 'BACKEND_SAFETY_FALLBACK',
    };
  }

  return {
    normalized_text: normalizedText,
    is_red_flag: false,
    priority: 'NORMAL',
    action: 'HUMAN_REVIEW',
    recommendations: [{
      rank: 1,
      department_code: 'GENERAL',
      department_name: 'Khoa Khám bệnh Tổng quát',
      clinic_room: 'PK-TQ-101',
      confidence: 0.4,
      eligible: true,
      estimated_wait: 0,
      waiting_count: 0,
    }],
    confidence_low: true,
    requires_human_review: true,
    red_flag: null,
    message: 'Dịch vụ AI đang khởi động; tạm chuyển phòng khám Tổng quát và yêu cầu nhân viên xác nhận.',
    disclaimer: DISCLAIMER,
    source: 'BACKEND_SAFETY_FALLBACK',
  };
}

function isAiAvailabilityError(error) {
  return error instanceof AppError && error.statusCode >= 500;
}

async function routeSymptoms(payload, aiRequest = requestAi) {
  try {
    const data = await aiRequest('/api/v1/symptom-routing', { method: 'POST', body: payload });
    return { statusCode: 200, data };
  } catch (error) {
    if (!isAiAvailabilityError(error)) throw error;
    return { statusCode: 200, data: fallbackRouting(payload) };
  }
}

module.exports = {
  fallbackRouting,
  routeSymptoms,
};

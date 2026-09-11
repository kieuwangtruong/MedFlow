const assert = require('node:assert/strict');
const { test } = require('node:test');
const { classifyTriage } = require('../src/modules/shared/triage');

test('Triage P1 (Resuscitation): Severe hypoxemia (SpO2 < 88%) triggers immediate P1', () => {
  const result = classifyTriage({
    spo2: 84,
    pulse: 110,
    systolicBp: 100,
    painLevel: 2,
    description: 'Bệnh nhân mệt nhiều',
  });

  assert.equal(result.level, 1);
  assert.equal(result.code, 'P1');
  assert.equal(result.priority, 'EMERGENCY');
  assert.equal(result.maxWaitMinutes, 0);
  assert.equal(result.flags.underTriagePrevention, true);
  assert.match(result.rationale, /SpO2 nguy kịch/);
});

test('Triage P1 (Resuscitation): Profound hypotension/shock (SBP < 80 mmHg) triggers P1', () => {
  const result = classifyTriage({
    systolicBp: 72,
    pulse: 135,
    spo2: 95,
    painLevel: 1,
    description: 'Chóng mặt lả người',
  });

  assert.equal(result.level, 1);
  assert.equal(result.code, 'P1');
  assert.equal(result.priority, 'EMERGENCY');
  assert.equal(result.flags.underTriagePrevention, true);
  assert.match(result.rationale, /Tụt huyết áp nặng/);
});

test('Triage P1 (Resuscitation): Unresponsive consciousness (AVPU = U or GCS < 9) triggers P1', () => {
  const result = classifyTriage({
    avpu: 'U',
    gcs: 7,
    spo2: 96,
    pulse: 80,
    systolicBp: 110,
  });

  assert.equal(result.level, 1);
  assert.equal(result.code, 'P1');
  assert.match(result.rationale, /Hôn mê \/ Mất ý thức/);
});

test('Triage P1 (Resuscitation): Critical red flag (ngừng tuần hoàn, ngừng thở, co giật) triggers P1', () => {
  const result = classifyTriage({
    dangerSigns: ['Bệnh nhân co giật sùi bọt mép'],
    painLevel: 0,
  });

  assert.equal(result.level, 1);
  assert.equal(result.code, 'P1');
  assert.equal(result.priority, 'EMERGENCY');
});

test('Triage P2 (Emergent): Acute coronary syndrome chest pain triggers P2', () => {
  const result = classifyTriage({
    dangerSigns: ['đau thắt ngực lan ra vai trái'],
    painLevel: 7,
    spo2: 96,
    pulse: 88,
    systolicBp: 130,
  });

  assert.equal(result.level, 2);
  assert.equal(result.code, 'P2');
  assert.equal(result.priority, 'EMERGENCY');
  assert.equal(result.maxWaitMinutes, 15);
  assert.match(result.rationale, /nguy cơ cao/);
});

test('Triage P2 (Emergent): Altered mental status (AVPU = V or P, GCS 11) triggers P2', () => {
  const result = classifyTriage({
    avpu: 'V',
    gcs: 11,
    spo2: 95,
    pulse: 80,
    systolicBp: 120,
    painLevel: 0,
  });

  assert.equal(result.level, 2);
  assert.equal(result.code, 'P2');
  assert.match(result.rationale, /Lơ mơ/);
});

test('Triage P2 (Emergent): Borderline danger zone vitals (SpO2 91%, Pulse 135 bpm) triggers P2', () => {
  const result = classifyTriage({
    spo2: 91,
    pulse: 135,
    systolicBp: 125,
    painLevel: 3,
  });

  assert.equal(result.level, 2);
  assert.equal(result.code, 'P2');
  assert.equal(result.flags.vitalSignTriggered, true);
  assert.equal(result.flags.underTriagePrevention, true);
});

test('Anti-Over-Triage Safeguard: Severe pain (9/10) with 100% normal vitals is capped at P3', () => {
  // Toothache or chronic ankle ache with pain 9/10 but perfectly stable vitals
  const result = classifyTriage({
    painLevel: 9,
    spo2: 99,
    pulse: 75,
    systolicBp: 120,
    diastolicBp: 80,
    respiratoryRate: 16,
    avpu: 'A',
    gcs: 15,
    description: 'Đau răng hàm dưới dữ dội',
  });

  assert.equal(result.level, 3);
  assert.equal(result.code, 'P3');
  assert.equal(result.priority, 'URGENT');
  assert.equal(result.flags.overTriageAdjusted, true);
  assert.match(result.rationale, /chống Over-triage/);
});

test('Anti-Under-Triage Safeguard: Zero pain with silent hypoxia (SpO2 86%) is caught as P1', () => {
  const result = classifyTriage({
    painLevel: 0,
    spo2: 86,
    pulse: 90,
    systolicBp: 120,
    description: 'Chỉ hơi tức nhẹ không đau đớn gì',
  });

  assert.equal(result.level, 1);
  assert.equal(result.code, 'P1');
  assert.equal(result.flags.underTriagePrevention, true);
});

test('Triage P3 (Urgent): Stable vitals, moderate pain (5/10), multiple resources (>= 2)', () => {
  const result = classifyTriage({
    painLevel: 5,
    expectedResources: 2,
    spo2: 98,
    pulse: 78,
    systolicBp: 118,
    description: 'Đau bụng âm ỉ vùng hạ vị',
  });

  assert.equal(result.level, 3);
  assert.equal(result.code, 'P3');
  assert.equal(result.priority, 'URGENT');
  assert.equal(result.maxWaitMinutes, 30);
});

test('Triage P4 (Semi-urgent): Stable vitals, mild pain, single resource needed', () => {
  const result = classifyTriage({
    painLevel: 2,
    expectedResources: 1,
    spo2: 99,
    pulse: 72,
    systolicBp: 120,
    description: 'Trật khớp ngón tay nhẹ sau đá bóng',
  });

  assert.equal(result.level, 4);
  assert.equal(result.code, 'P4');
  assert.equal(result.priority, 'NORMAL');
  assert.equal(result.maxWaitMinutes, 60);
});

test('Triage P5 (Non-urgent): Stable vitals, no pain, 0 resources needed', () => {
  const result = classifyTriage({
    painLevel: 0,
    expectedResources: 0,
    spo2: 99,
    pulse: 70,
    systolicBp: 115,
    description: 'Tái khám định kỳ xin cấp lại đơn thuốc huyết áp',
  });

  assert.equal(result.level, 5);
  assert.equal(result.code, 'P5');
  assert.equal(result.priority, 'NON_URGENT');
  assert.equal(result.maxWaitMinutes, 120);
});

const SERVICE_DEFINITIONS = Object.freeze([
  {
    label: 'X-quang',
    tokens: ['x-quang', 'x quang'],
    serviceType: 'XRAY',
    department: 'Chẩn đoán hình ảnh',
  },
  {
    label: 'Siêu âm',
    tokens: ['sieu am'],
    serviceType: 'ABDOMINAL_ULTRASOUND',
    department: 'Chẩn đoán hình ảnh',
  },
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function getServiceDefinition(label) {
  const normalized = normalizeText(label);
  return SERVICE_DEFINITIONS.find((definition) => (
    definition.tokens.some((token) => normalized.includes(token))
  )) || null;
}

module.exports = {
  SERVICE_DEFINITIONS,
  getServiceDefinition,
  normalizeText,
};

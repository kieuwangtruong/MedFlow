const STANDARD_SERVICE_DURATIONS = Object.freeze({
  CLINICAL_CONSULT: 15,
  INITIAL_CONSULT: 15,
  ABDOMINAL_ULTRASOUND: 15,
  XRAY: 8,
  RESULT_REVIEW: 5,
  RETURN_REVIEW: 5,
  DEFAULT: 10,
});

function getStandardDuration(serviceType, taskType) {
  if (serviceType && STANDARD_SERVICE_DURATIONS[serviceType]) {
    return STANDARD_SERVICE_DURATIONS[serviceType];
  }
  if (taskType && STANDARD_SERVICE_DURATIONS[taskType]) {
    return STANDARD_SERVICE_DURATIONS[taskType];
  }
  return STANDARD_SERVICE_DURATIONS.DEFAULT;
}

/**
 * Calculates Estimated Wait Time (EWT) using the standard FIFO queue formula:
 * EWT = max(0, T_remaining_current) + (N_patients_ahead * T_standard_duration)
 * If the room is empty (0 patients in queue and no active consultation), EWT = 0.
 *
 * @param {Object} options
 * @param {number} [options.patientsAhead=0] - Number of patients ahead in line (0 for first patient in line)
 * @param {Date|string|null} [options.currentServiceStart=null] - Timestamp when active patient in consultation started
 * @param {string} [options.serviceType='CLINICAL_CONSULT'] - Service type
 * @param {string} [options.taskType='INITIAL_CONSULT'] - Task type
 * @param {number|null} [options.customDuration=null] - Optional override for standard duration
 * @param {Date} [options.now=new Date()] - Current reference time
 * @returns {number} EWT in minutes (rounded integer >= 0)
 */
function calculateEWT({
  patientsAhead = 0,
  currentServiceStart = null,
  serviceType = 'CLINICAL_CONSULT',
  taskType = 'INITIAL_CONSULT',
  customDuration = null,
  now = new Date(),
}) {
  const standardDuration = customDuration || getStandardDuration(serviceType, taskType);

  let remainingCurrent = 0;
  if (currentServiceStart) {
    const startMs = new Date(currentServiceStart).getTime();
    const elapsedMinutes = Math.max(0, (now.getTime() - startMs) / 60000);
    remainingCurrent = Math.max(0, standardDuration - elapsedMinutes);
  }

  // If no patient is currently in service and no one is ahead, wait time is exactly 0
  if (!currentServiceStart && patientsAhead <= 0) {
    return 0;
  }

  const countAhead = Math.max(0, patientsAhead);
  const totalEwt = remainingCurrent + (countAhead * standardDuration);
  return Math.max(0, Math.round(totalEwt));
}

module.exports = {
  STANDARD_SERVICE_DURATIONS,
  calculateEWT,
  getStandardDuration,
};

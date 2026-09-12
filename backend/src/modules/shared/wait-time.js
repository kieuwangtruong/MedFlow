/**
 * Clinical Wait-Time Engine for Healthcare Outpatient Services
 * Calculates dynamic queue clearance time, handles emergency preemption,
 * excludes patients away in paraclinical/diagnostic tests, and records actual wait duration.
 */

const DEFAULT_SERVICE_TIMES = {
  CLINICAL_CONSULT: 10,       // 10 minutes average general doctor examination
  RESULT_REVIEW: 5,           // 5 minutes return review of lab/imaging results
  XRAY: 8,                    // 8 minutes per X-ray procedure
  ABDOMINAL_ULTRASOUND: 15,   // 15 minutes per ultrasound scan
};

const PRIORITY_FACTORS = {
  EMERGENCY: 1.2,  // May require stabilization buffer
  URGENT: 1.0,
  NORMAL: 1.0,
  NON_URGENT: 0.8,
};

/**
 * Calculates dynamic estimated wait time in minutes for a queue or specific patient.
 *
 * @param {Object} options
 * @param {Array} options.queueEntries - Active queue entries for the room
 * @param {number} [options.activeDoctorsCount=1] - Number of active doctors on duty
 * @param {number} [options.avgServiceTime=10] - Default baseline service time (minutes)
 * @param {string} [options.targetEntryId] - Optional target entry to get specific wait time for
 * @param {Date} [options.now=new Date()] - Evaluation timestamp
 * @returns {Object} { estimatedWaitMinutes, peopleAhead, breakdown }
 */
function calculateEstimatedWaitTime(options = {}) {
  const {
    queueEntries = [],
    activeDoctorsCount = 1,
    avgServiceTime = 10,
    targetEntryId = null,
  } = options;

  const effectiveDoctors = Math.max(1, Number(activeDoctorsCount) || 1);

  // Filter queue entries:
  // ONLY include patients who are actively waiting at this room!
  // CRITICAL REQUIREMENT: Patients away doing paraclinical tests (X-ray, ultrasound, lab)
  // or waiting for pending results must NOT inflate the consultation room's current wait time!
  const validWaitingEntries = queueEntries.filter((entry) => {
    // Exclude finished, cancelled, or no-show entries
    if (['DONE', 'CANCELLED', 'NO_SHOW'].includes(entry.status)) return false;

    const task = entry.task;
    if (!task) return true;

    // If task is waiting for results of diagnostic tests, patient is not physically in line
    if (task.readinessStatus === 'RESULT_PENDING' || task.status === 'WAITING_RESULT') {
      return false;
    }

    return true;
  });

  // Sort waiting entries by priority tier:
  // 1. EMERGENCY (P1)
  // 2. WAITING_REVIEW / Priority Bump (patients returned with completed diagnostic results)
  // 3. URGENT (P2)
  // 4. NORMAL (P3) / NON_URGENT (P4)
  // Within same tier, sort by enqueuedAt
  const sortedEntries = [...validWaitingEntries].sort((a, b) => {
    const tierA = getPriorityTier(a);
    const tierB = getPriorityTier(b);
    if (tierA !== tierB) return tierA - tierB;
    return (a.enqueuedAt ? new Date(a.enqueuedAt).getTime() : 0) - (b.enqueuedAt ? new Date(b.enqueuedAt).getTime() : 0);
  });

  let targetIndex = sortedEntries.length;
  if (targetEntryId) {
    const foundIdx = sortedEntries.findIndex((e) => e.id === targetEntryId || e.taskId === targetEntryId);
    if (foundIdx !== -1) {
      targetIndex = foundIdx;
    }
  }

  // Calculate cumulative workload of patients ahead
  const entriesAhead = sortedEntries.slice(0, targetIndex);
  let totalWorkloadMinutes = 0;
  let emergencyCount = 0;
  let reviewCount = 0;
  let routineCount = 0;

  for (const entry of entriesAhead) {
    const task = entry.task || {};
    const baseDuration = DEFAULT_SERVICE_TIMES[task.serviceType] || avgServiceTime;
    const factor = PRIORITY_FACTORS[entry.priority] || 1.0;
    const workload = baseDuration * factor;

    totalWorkloadMinutes += workload;

    if (entry.priority === 'EMERGENCY') emergencyCount += 1;
    else if (entry.isPriorityBump || task.taskType === 'RETURN_REVIEW') reviewCount += 1;
    else routineCount += 1;
  }

  // Preemption & Multi-server queue clearance:
  // Total wait time = Total Workload / Number of active doctors
  const rawWaitTime = totalWorkloadMinutes / effectiveDoctors;

  // Enforce non-negative wait time: EWT >= 0
  const estimatedWaitMinutes = Math.max(0, Math.round(rawWaitTime * 10) / 10);

  return {
    estimatedWaitMinutes,
    peopleAhead: entriesAhead.length,
    breakdown: {
      emergencyAhead: emergencyCount,
      reviewAhead: reviewCount,
      routineAhead: routineCount,
      activeDoctorsCount: effectiveDoctors,
      totalWorkloadMinutes: Math.round(totalWorkloadMinutes * 10) / 10,
    },
  };
}

/**
 * Maps queue entry to priority rank tier (lower number = higher priority)
 */
function getPriorityTier(entry) {
  if (entry.priority === 'EMERGENCY') return 0;
  if (entry.isPriorityBump || entry.task?.taskType === 'RETURN_REVIEW') return 1;
  if (entry.priority === 'URGENT') return 2;
  if (entry.priority === 'NORMAL') return 3;
  return 4; // NON_URGENT
}

/**
 * Measures actual wait time when patient is called into service
 *
 * @param {Date|string} enqueuedAt - Timestamp when patient joined queue
 * @param {Date|string} calledAt - Timestamp when patient was called by doctor
 * @returns {number} Wait duration in minutes (>= 0, 1 decimal place)
 */
function calculateActualWaitTime(enqueuedAt, calledAt = new Date()) {
  if (!enqueuedAt) return 0;
  const start = new Date(enqueuedAt).getTime();
  const end = new Date(calledAt).getTime();
  if (isNaN(start) || isNaN(end)) return 0;
  const diffMs = end - start;
  const minutes = diffMs / 60000;
  return Math.max(0, Math.round(minutes * 10) / 10);
}

/**
 * Evaluates whether a patient's waiting duration has exceeded the estimated wait time.
 * Generates clinical reasons and transparent communication for the patient.
 *
 * @param {Object} options
 * @param {Date|string} options.enqueuedAt - Timestamp when patient joined queue
 * @param {number} [options.estimatedWaitMinutes=0] - Estimated wait minutes
 * @param {Object} [options.breakdown={}] - Breakdown of queue ahead (emergencyAhead, reviewAhead, etc.)
 * @param {Date} [options.now=new Date()] - Current timestamp
 * @returns {Object} { isDelayed, delayMinutes, elapsedMinutes, estimatedWaitMinutes, title, reason }
 */
function evaluateWaitDelay(options = {}) {
  const {
    enqueuedAt,
    estimatedWaitMinutes = 0,
    breakdown = {},
    now = new Date(),
  } = options;

  const elapsedMinutes = calculateActualWaitTime(enqueuedAt, now);
  const targetEstimate = Math.max(0, Number(estimatedWaitMinutes) || 0);
  const isDelayed = targetEstimate > 0 && elapsedMinutes > targetEstimate;
  const delayMinutes = isDelayed ? Math.max(0, Math.round((elapsedMinutes - targetEstimate) * 10) / 10) : 0;

  let reason = 'Phòng khám đang trong khung giờ cao điểm, lượt khám trước cần thêm thời gian xử lý chu đáo.';
  if (breakdown.emergencyAhead > 0) {
    reason = `Phòng khám đang ưu tiên cấp cứu ${breakdown.emergencyAhead} ca khẩn cấp phía trước. Số thứ tự của bạn được đảm bảo ngay sau đó.`;
  } else if (breakdown.reviewAhead > 0) {
    reason = 'Bác sĩ đang hội chẩn trả kết quả cận lâm sàng cho người bệnh trước.';
  } else if (delayMinutes >= 15) {
    reason = 'Ca bệnh đang khám có diễn tiến phức tạp cần hội chẩn kỹ lưỡng. Bác sĩ sẽ gọi bạn ngay khi hoàn tất.';
  }

  return {
    isDelayed,
    delayMinutes,
    elapsedMinutes,
    estimatedWaitMinutes: targetEstimate,
    reason,
    title: isDelayed
      ? `Thời gian chờ đang lâu hơn dự kiến (+${Math.round(delayMinutes)} phút)`
      : 'Thời gian chờ dự kiến',
  };
}

module.exports = {
  calculateActualWaitTime,
  calculateEstimatedWaitTime,
  evaluateWaitDelay,
  getPriorityTier,
};

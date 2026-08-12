const PRIORITY_TO_FRONTEND = {
  EMERGENCY: 'EMERGENCY',
  URGENT: 'URGENT',
  NORMAL: 'NORMAL',
  NON_URGENT: 'LOW',
};

const TASK_STATUS_TO_FRONTEND = {
  PENDING: 'CHECKED_IN',
  READY: 'WAITING',
  IN_QUEUE: 'WAITING',
  IN_SERVICE: 'IN_SERVICE',
  WAITING_RESULT: 'WAITING_RESULT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'CANCELLED',
};

const QUEUE_STATUS_TO_FRONTEND = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_SERVICE: 'IN_EXAMINATION',
  DONE: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'CANCELLED',
};

function toFrontendPriority(priority) {
  return PRIORITY_TO_FRONTEND[priority] || 'NORMAL';
}

function toDatabasePriority(priority) {
  if (priority === 'HIGH') return 'URGENT';
  if (priority === 'LOW') return 'NON_URGENT';
  return ['EMERGENCY', 'URGENT', 'NORMAL', 'NON_URGENT'].includes(priority)
    ? priority
    : 'NORMAL';
}

function toVisitStatus(taskStatus, queueStatus) {
  if (taskStatus === 'WAITING_RESULT') return 'WAITING_RESULT';
  return QUEUE_STATUS_TO_FRONTEND[queueStatus] || TASK_STATUS_TO_FRONTEND[taskStatus] || 'WAITING';
}

function toStepStatus(taskStatus, queueStatus) {
  const visitStatus = toVisitStatus(taskStatus, queueStatus);
  if (visitStatus === 'CALLED') return 'CALLED';
  if (['IN_EXAMINATION', 'IN_SERVICE'].includes(visitStatus)) return 'IN_PROGRESS';
  if (visitStatus === 'COMPLETED') return 'COMPLETED';
  if (visitStatus === 'CANCELLED') return 'CANCELLED';
  return ['CHECKED_IN', 'SYMPTOM_SUBMITTED'].includes(visitStatus) ? 'PENDING' : 'WAITING';
}

function formatQueueNumber(value) {
  return `A${String(value || 0).padStart(3, '0')}`;
}

function floorNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function patientAge(dateOfBirth) {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}

function taskTitle(task) {
  if (task.taskType === 'INITIAL_CONSULT') return 'Khám lâm sàng';
  if (task.taskType === 'RETURN_REVIEW') return 'Bác sĩ xem kết quả';
  const labels = {
    XRAY: 'X-quang',
    ABDOMINAL_ULTRASOUND: 'Siêu âm',
    RESULT_REVIEW: 'Đọc kết quả',
  };
  return labels[task.serviceType] || 'Dịch vụ cận lâm sàng';
}

function currentQueueEntry(task) {
  return task.queueEntries?.find((entry) => !['DONE', 'CANCELLED', 'NO_SHOW'].includes(entry.status))
    || task.queueEntries?.[0]
    || null;
}

module.exports = {
  currentQueueEntry,
  floorNumber,
  formatQueueNumber,
  patientAge,
  taskTitle,
  toDatabasePriority,
  toFrontendPriority,
  toStepStatus,
  toVisitStatus,
};

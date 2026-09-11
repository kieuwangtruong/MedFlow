const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  calculateActualWaitTime,
  calculateEstimatedWaitTime,
  getPriorityTier,
} = require('../src/modules/shared/wait-time');

test('Priority tier ranking: Emergency (0) > Priority Bump (1) > Urgent (2) > Normal (3) > Low (4)', () => {
  const emergencyEntry = { priority: 'EMERGENCY' };
  const priorityBumpEntry = { priority: 'NORMAL', isPriorityBump: true };
  const returnReviewEntry = { priority: 'NORMAL', task: { taskType: 'RETURN_REVIEW' } };
  const urgentEntry = { priority: 'URGENT' };
  const normalEntry = { priority: 'NORMAL' };
  const lowEntry = { priority: 'NON_URGENT' };

  assert.equal(getPriorityTier(emergencyEntry), 0);
  assert.equal(getPriorityTier(priorityBumpEntry), 1);
  assert.equal(getPriorityTier(returnReviewEntry), 1);
  assert.equal(getPriorityTier(urgentEntry), 2);
  assert.equal(getPriorityTier(normalEntry), 3);
  assert.equal(getPriorityTier(lowEntry), 4);

  // Assert strict ordering
  assert.ok(getPriorityTier(emergencyEntry) < getPriorityTier(priorityBumpEntry));
  assert.ok(getPriorityTier(priorityBumpEntry) < getPriorityTier(urgentEntry));
  assert.ok(getPriorityTier(urgentEntry) < getPriorityTier(normalEntry));
});

test('Wait-time calculation excludes patients away in paraclinical / diagnostic tests', () => {
  const queueEntries = [
    // Patient 1: In line waiting for doctor
    { id: 'e-1', priority: 'NORMAL', status: 'WAITING', enqueuedAt: new Date(Date.now() - 10000), task: { serviceType: 'CLINICAL_CONSULT', status: 'IN_QUEUE' } },
    // Patient 2: AWAY in X-ray room / waiting for results (RESULT_PENDING) -> MUST BE EXCLUDED!
    { id: 'e-2', priority: 'NORMAL', status: 'WAITING', enqueuedAt: new Date(Date.now() - 20000), task: { serviceType: 'RESULT_REVIEW', status: 'WAITING_RESULT', readinessStatus: 'RESULT_PENDING' } },
    // Patient 3: In line waiting for doctor
    { id: 'e-3', priority: 'NORMAL', status: 'WAITING', enqueuedAt: new Date(Date.now() - 5000), task: { serviceType: 'CLINICAL_CONSULT', status: 'IN_QUEUE' } },
  ];

  const result = calculateEstimatedWaitTime({
    queueEntries,
    activeDoctorsCount: 1,
    avgServiceTime: 10,
  });

  // Since Patient 2 is away at diagnostics, only Patients 1 and 3 are counted
  // Total workload should be 20 minutes (2 patients * 10 mins), NOT 30 minutes!
  assert.equal(result.breakdown.routineAhead, 2);
  assert.equal(result.estimatedWaitMinutes, 20);
});

test('Wait-time scales inversely with the number of active doctors', () => {
  const queueEntries = [
    { id: 'e-1', priority: 'NORMAL', status: 'WAITING', task: { serviceType: 'CLINICAL_CONSULT' } },
    { id: 'e-2', priority: 'NORMAL', status: 'WAITING', task: { serviceType: 'CLINICAL_CONSULT' } },
    { id: 'e-3', priority: 'NORMAL', status: 'WAITING', task: { serviceType: 'CLINICAL_CONSULT' } },
    { id: 'e-4', priority: 'NORMAL', status: 'WAITING', task: { serviceType: 'CLINICAL_CONSULT' } },
  ];

  // With 1 doctor: 4 * 10 / 1 = 40 minutes
  const waitWith1Doc = calculateEstimatedWaitTime({
    queueEntries,
    activeDoctorsCount: 1,
    avgServiceTime: 10,
  });
  assert.equal(waitWith1Doc.estimatedWaitMinutes, 40);

  // With 2 doctors: 4 * 10 / 2 = 20 minutes
  const waitWith2Docs = calculateEstimatedWaitTime({
    queueEntries,
    activeDoctorsCount: 2,
    avgServiceTime: 10,
  });
  assert.equal(waitWith2Docs.estimatedWaitMinutes, 20);
});

test('Preemption: Emergency cases are prioritized and wait time is never negative', () => {
  const queueEntries = [
    { id: 'e-routine', priority: 'NORMAL', status: 'WAITING', enqueuedAt: new Date(Date.now() - 30000), task: { serviceType: 'CLINICAL_CONSULT' } },
    // Emergency arrives later but preempts routine
    { id: 'e-emergency', priority: 'EMERGENCY', status: 'WAITING', enqueuedAt: new Date(Date.now() - 5000), task: { serviceType: 'CLINICAL_CONSULT' } },
  ];

  // Wait time for the routine patient when an emergency preempts:
  const routineWait = calculateEstimatedWaitTime({
    queueEntries,
    activeDoctorsCount: 1,
    targetEntryId: 'e-routine',
  });

  // The emergency case is ahead of the routine patient!
  assert.equal(routineWait.breakdown.emergencyAhead, 1);
  assert.ok(routineWait.estimatedWaitMinutes >= 0);

  // For the emergency patient, nobody is ahead:
  const emergencyWait = calculateEstimatedWaitTime({
    queueEntries,
    activeDoctorsCount: 1,
    targetEntryId: 'e-emergency',
  });
  assert.equal(emergencyWait.peopleAhead, 0);
  assert.equal(emergencyWait.estimatedWaitMinutes, 0);
});

test('Actual wait time calculation correctly records minutes elapsed', () => {
  const enqueuedAt = new Date(Date.now() - 25 * 60 * 1000); // 25 minutes ago
  const calledAt = new Date();

  const actualWait = calculateActualWaitTime(enqueuedAt, calledAt);
  assert.equal(actualWait, 25);

  // Edge case: called before enqueued (clock skew) -> clamped to 0
  const futureEnqueued = new Date(Date.now() + 5000);
  assert.equal(calculateActualWaitTime(futureEnqueued, calledAt), 0);
});

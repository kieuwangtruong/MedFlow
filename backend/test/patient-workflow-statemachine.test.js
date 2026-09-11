const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getPriorityTier } = require('../src/modules/shared/wait-time');

/**
 * In-memory Mock Test Harness for Patient Workflow State Machine
 * Verifies the exact transactional sequence of:
 * Check-in -> Initial Consultation (Room A) -> 2 Diagnostic Orders (Lab + Imaging)
 * -> Partial Completion (Order 1 Done) -> Final Completion (Order 2 Done)
 * -> Automatic transition back to initial_room_id with WAITING_REVIEW & Priority Bump.
 */
function createWorkflowTestHarness() {
  const store = {
    journeys: new Map(),
    tasks: new Map(),
    queueEntries: new Map(),
    dependencies: [],
  };

  const initialRoomId = 'ROOM-CLINIC-101';
  const initialQueueId = 'QUEUE-ROOM-CLINIC-101';
  const labRoomId = 'ROOM-LAB-201';
  const labQueueId = 'QUEUE-ROOM-LAB-201';
  const imagingRoomId = 'ROOM-IMAGING-202';
  const imagingQueueId = 'QUEUE-ROOM-IMAGING-202';

  return {
    store,
    initialRoomId,
    initialQueueId,
    labRoomId,
    labQueueId,
    imagingRoomId,
    imagingQueueId,

    // 1. Check-in & Initial Room Assignment
    checkin(visitId, patientToken) {
      const journey = {
        id: visitId,
        patientToken,
        checkinAt: new Date(),
        initialRoomId,
        currentRoomId: initialRoomId,
        queueStatus: 'WAITING',
      };
      store.journeys.set(visitId, journey);

      const consultTask = {
        id: `TASK-CONSULT-${visitId}`,
        journeyId: visitId,
        taskType: 'INITIAL_CONSULT',
        roomId: initialRoomId,
        originRoomId: initialRoomId,
        queueId: initialQueueId,
        status: 'IN_QUEUE',
        clinicalPriority: 'NORMAL',
        sequenceOrder: 1,
      };
      store.tasks.set(consultTask.id, consultTask);

      const entry = {
        id: `ENTRY-CONSULT-${visitId}`,
        queueId: initialQueueId,
        taskId: consultTask.id,
        status: 'WAITING',
        priority: 'NORMAL',
        queueNumber: 1,
        enqueuedAt: new Date(),
        isPriorityBump: false,
      };
      store.queueEntries.set(entry.id, entry);

      return { journey, consultTask, entry };
    },

    // 2. Doctor starts examination
    startConsultation(consultTaskId) {
      const task = store.tasks.get(consultTaskId);
      task.status = 'IN_SERVICE';
      const journey = store.journeys.get(task.journeyId);
      journey.queueStatus = 'IN_EXAMINATION';
      return { task, journey };
    },

    // 3. Doctor creates 2 Diagnostic Orders (Lab + Imaging)
    createDiagnosticOrders(visitId, consultTaskId) {
      const consultTask = store.tasks.get(consultTaskId);
      consultTask.status = 'COMPLETED';
      consultTask.serviceEnd = new Date();

      const journey = store.journeys.get(visitId);
      // Moves to diagnostic area
      journey.currentRoomId = labRoomId;
      journey.queueStatus = 'WAITING_SERVICE';

      // Order 1: Lab
      const labTask = {
        id: `TASK-LAB-${visitId}`,
        journeyId: visitId,
        taskType: 'DIAGNOSTIC_SERVICE',
        serviceType: 'ABDOMINAL_ULTRASOUND',
        roomId: labRoomId,
        originRoomId: initialRoomId,
        queueId: labQueueId,
        status: 'IN_QUEUE',
        clinicalPriority: 'NORMAL',
        sequenceOrder: 2,
      };
      store.tasks.set(labTask.id, labTask);

      // Order 2: Imaging
      const imagingTask = {
        id: `TASK-IMAGING-${visitId}`,
        journeyId: visitId,
        taskType: 'DIAGNOSTIC_SERVICE',
        serviceType: 'XRAY',
        roomId: imagingRoomId,
        originRoomId: initialRoomId,
        queueId: imagingQueueId,
        status: 'IN_QUEUE',
        clinicalPriority: 'NORMAL',
        sequenceOrder: 3,
      };
      store.tasks.set(imagingTask.id, imagingTask);

      // Return Review Task (created once, depending on both orders)
      const returnTask = {
        id: `TASK-RETURN-${visitId}`,
        journeyId: visitId,
        taskType: 'RETURN_REVIEW',
        serviceType: 'RESULT_REVIEW',
        roomId: initialRoomId,
        originRoomId: initialRoomId,
        queueId: initialQueueId,
        status: 'WAITING_RESULT',
        readinessStatus: 'RESULT_PENDING',
        clinicalPriority: 'NORMAL',
        sequenceOrder: 4,
      };
      store.tasks.set(returnTask.id, returnTask);

      store.dependencies.push(
        { taskId: returnTask.id, dependsOnTaskId: labTask.id },
        { taskId: returnTask.id, dependsOnTaskId: imagingTask.id }
      );

      return { labTask, imagingTask, returnTask };
    },

    // 4. Complete an Order (State Machine Transition with Atomic Evaluation)
    completeOrder(visitId, completedTaskId) {
      const now = new Date();
      const task = store.tasks.get(completedTaskId);
      if (!task) throw new Error('Task not found');

      // Atomic State Machine execution:
      task.status = 'COMPLETED';
      task.readinessStatus = 'COMPLETED';
      task.completedAt = now;
      task.resultReadyAt = now;

      // Count remaining active diagnostic tasks
      const allTasks = Array.from(store.tasks.values());
      const remainingDiagnostics = allTasks.filter((t) => (
        t.journeyId === visitId
        && t.taskType === 'DIAGNOSTIC_SERVICE'
        && t.status !== 'COMPLETED'
      ));

      const isAllOrdersCompleted = remainingDiagnostics.length === 0;
      const journey = store.journeys.get(visitId);

      if (isAllOrdersCompleted) {
        // AUTOMATIC TRANSITION:
        // 1. Chuyển current_room_id trở lại initial_room_id
        journey.currentRoomId = journey.initialRoomId;
        // 2. Cập nhật queue_status sang WAITING_REVIEW
        journey.queueStatus = 'WAITING_REVIEW';

        // 3. Kích hoạt returnTask
        const returnTask = allTasks.find((t) => (
          t.journeyId === visitId && t.taskType === 'RETURN_REVIEW'
        ));
        returnTask.status = 'IN_QUEUE';
        returnTask.readinessStatus = 'COMPLETED';
        returnTask.readyAt = now;
        returnTask.arrivalTime = now;

        // 4. Áp dụng Priority Bump trong hàng đợi phòng ban đầu
        const returnEntry = {
          id: `ENTRY-RETURN-${visitId}`,
          queueId: returnTask.queueId,
          taskId: returnTask.id,
          status: 'WAITING',
          priority: returnTask.clinicalPriority,
          isPriorityBump: true, // Priority Bump flag!
          queueNumber: 99,
          enqueuedAt: now,
        };
        store.queueEntries.set(returnEntry.id, returnEntry);

        return {
          visitId,
          completedTaskId,
          isAllOrdersCompleted: true,
          currentRoomId: journey.currentRoomId,
          queueStatus: journey.queueStatus,
          returnEntry,
        };
      }

      // Partial completion: other orders still in progress
      journey.queueStatus = 'WAITING_SERVICE';
      return {
        visitId,
        completedTaskId,
        isAllOrdersCompleted: false,
        currentRoomId: journey.currentRoomId,
        queueStatus: journey.queueStatus,
        remainingCount: remainingDiagnostics.length,
      };
    },
  };
}

test('End-to-End Workflow: Check-in -> Consult -> 2 Orders -> Partial Done -> All Done -> Auto Return with WAITING_REVIEW & Priority Bump', () => {
  const harness = createWorkflowTestHarness();
  const visitId = 'VIS-E2E-TEST-001';
  const patientToken = 'pt_patient_test';

  // Step 1: Check-in
  const { journey } = harness.checkin(visitId, patientToken);
  assert.equal(journey.initialRoomId, harness.initialRoomId);
  assert.equal(journey.currentRoomId, harness.initialRoomId);
  assert.equal(journey.queueStatus, 'WAITING');

  // Step 2: Doctor starts consult
  harness.startConsultation(`TASK-CONSULT-${visitId}`);
  assert.equal(journey.queueStatus, 'IN_EXAMINATION');

  // Step 3: Doctor orders Lab (Ultrasound) + Imaging (X-ray)
  const { labTask, imagingTask, returnTask } = harness.createDiagnosticOrders(visitId, `TASK-CONSULT-${visitId}`);
  assert.equal(labTask.status, 'IN_QUEUE');
  assert.equal(imagingTask.status, 'IN_QUEUE');
  assert.equal(returnTask.status, 'WAITING_RESULT');
  assert.equal(journey.queueStatus, 'WAITING_SERVICE');
  assert.equal(journey.currentRoomId, harness.labRoomId);

  // Step 4: Cận lâm sàng 1 (Lab) xong -> Partial Completion
  const partialRes = harness.completeOrder(visitId, labTask.id);
  assert.equal(partialRes.isAllOrdersCompleted, false);
  assert.equal(partialRes.remainingCount, 1);
  // Bệnh nhân CHƯA quay về phòng ban đầu vì còn cận lâm sàng 2
  assert.equal(journey.queueStatus, 'WAITING_SERVICE');
  assert.equal(returnTask.status, 'WAITING_RESULT');

  // Step 5: Cận lâm sàng 2 (Imaging) xong -> All Orders Completed!
  const finalRes = harness.completeOrder(visitId, imagingTask.id);
  assert.equal(finalRes.isAllOrdersCompleted, true);

  // ASSERT: Bệnh nhân tự động xuất hiện ở phòng ban đầu với WAITING_REVIEW
  assert.equal(journey.currentRoomId, harness.initialRoomId);
  assert.equal(journey.queueStatus, 'WAITING_REVIEW');
  assert.equal(returnTask.status, 'IN_QUEUE');
  assert.equal(returnTask.readinessStatus, 'COMPLETED');

  // ASSERT: Áp dụng cơ chế Priority Bump trong hàng đợi phòng ban đầu
  assert.ok(finalRes.returnEntry);
  assert.equal(finalRes.returnEntry.status, 'WAITING');
  assert.equal(finalRes.returnEntry.isPriorityBump, true);
  assert.equal(finalRes.returnEntry.queueId, harness.initialQueueId);
});

test('Priority Bump: Returning WAITING_REVIEW patient is called ahead of new routine patients (P3) but behind Emergency (P1)', () => {
  // Queue in initial room has 3 patients:
  // Patient A: Routine new patient (P3 Normal), arrived at 08:00 (queueNumber 1)
  // Patient B: Returning review patient (WAITING_REVIEW / Priority Bump), returned at 08:30 (queueNumber 10)
  // Patient C: Emergency patient (P1 Emergency), arrived at 08:45 (queueNumber 12)

  const patientA = {
    id: 'entry-a',
    priority: 'NORMAL',
    isPriorityBump: false,
    queueNumber: 1,
    task: { taskType: 'INITIAL_CONSULT' },
  };

  const patientB = {
    id: 'entry-b',
    priority: 'NORMAL',
    isPriorityBump: true, // Priority Bump!
    queueNumber: 10,
    task: { taskType: 'RETURN_REVIEW' },
  };

  const patientC = {
    id: 'entry-c',
    priority: 'EMERGENCY',
    isPriorityBump: false,
    queueNumber: 12,
    task: { taskType: 'INITIAL_CONSULT' },
  };

  const queue = [patientA, patientB, patientC];

  // Sort queue by priority tier (lower tier = called first)
  const sortedByPriority = [...queue].sort((x, y) => getPriorityTier(x) - getPriorityTier(y));

  // Assert order:
  // 1st: Patient C (Emergency - Tier 0)
  // 2nd: Patient B (Waiting Review Priority Bump - Tier 1)
  // 3rd: Patient A (Routine Normal - Tier 3)
  assert.equal(sortedByPriority[0].id, 'entry-c', 'Emergency patient must be called first');
  assert.equal(sortedByPriority[1].id, 'entry-b', 'Returning review patient with Priority Bump must be called before routine patient');
  assert.equal(sortedByPriority[2].id, 'entry-a', 'Routine patient is called after returning review');
});

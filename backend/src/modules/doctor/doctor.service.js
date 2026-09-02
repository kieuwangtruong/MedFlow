const crypto = require('node:crypto');
const AppError = require('../../errors/app-error');
const prisma = require('../../lib/prisma');
const patientService = require('../patient/patient.service');
const { emitAiEvents, taskEvent } = require('../shared/ai-events');
const { activeAssignmentFilter, activeRoomFilter } = require('../shared/doctor-assignments');
const { getServiceDefinition } = require('../shared/service-routing');
const {
  currentQueueEntry,
  floorNumber,
  formatQueueNumber,
  patientAge,
  taskTitle,
  toDatabasePriority,
  toFrontendPriority,
  toVisitStatus,
} = require('../shared/presenters');

const activeTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];
const actionableTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];

const queueInclude = {
  task: {
    include: {
      patient: true,
      journey: true,
      department: true,
      specialty: { include: { department: true } },
      room: {
        include: {
          doctor: true,
          doctorAssignments: { where: { status: 'ACTIVE' }, include: { doctor: true } },
          specialty: { include: { department: true } },
        },
      },
      queue: true,
      queueEntries: { orderBy: { enqueuedAt: 'desc' } },
    },
  },
  queue: true,
};

function toQueueEntry(entry) {
  const task = entry.task;
  const patient = task.patient;
  const waitedMinutes = Math.max(0, Math.round((Date.now() - entry.enqueuedAt.getTime()) / 60000));
  return {
    visitId: task.journeyId,
    queueNumber: formatQueueNumber(entry.queueNumber),
    patientName: patient.fullName || `Bệnh nhân ${patient.identificationCode}`,
    age: patientAge(patient.dateOfBirth),
    mainSymptom: task.journey?.symptomDescription || taskTitle(task),
    symptomPayload: task.journey?.symptomPayload || null,
    severityScore: task.journey?.severityScore || null,
    intakeSource: task.journey?.intakeSource || null,
    priority: toFrontendPriority(entry.priority || task.clinicalPriority),
    waitedMinutes,
    status: toVisitStatus(task.status, entry.status),
    department: patientService.taskDepartment(task),
    room: task.room?.code || task.room?.name || 'Chưa phân phòng',
    orderNumber: entry.queueNumber || 0,
    calledAt: entry.calledAt?.toISOString(),
    taskType: task.taskType,
    serviceType: task.serviceType,
    resultValidated: Boolean(task.completedAt && task.resultReadyAt),
  };
}

const queueStatusOrder = {
  IN_EXAMINATION: 0,
  CALLED: 1,
  WAITING_RESULT: 2,
  WAITING: 3,
};

function compareQueueEntries(left, right) {
  const statusDifference = (queueStatusOrder[left.status] ?? 9) - (queueStatusOrder[right.status] ?? 9);
  if (statusDifference) return statusDifference;
  return left.orderNumber - right.orderNumber || left.waitedMinutes - right.waitedMinutes;
}

function doctorRoomScope(auth, now = new Date()) {
  if (auth?.role === 'ADMIN') return {};
  return { room: activeRoomFilter(auth?.sub, now) };
}

async function findAccessibleTask(visitId, auth, statuses = actionableTaskStatuses) {
  return prisma.patientJourneyTask.findFirst({
    where: {
      journeyId: visitId,
      status: { in: statuses },
      ...doctorRoomScope(auth),
    },
    orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

async function getAssignment(auth) {
  if (auth?.role === 'ADMIN') return null;
  const assignment = await prisma.doctorRoomAssignment.findFirst({
    where: activeAssignmentFilter({ doctorId: auth?.sub }),
    include: { room: { include: { specialty: { include: { department: true } } } } },
    orderBy: { shiftStart: 'desc' },
  });
  if (!assignment) return null;
  return {
    id: assignment.id,
    role: assignment.role,
    status: assignment.status,
    shiftStart: assignment.shiftStart.toISOString(),
    shiftEnd: assignment.shiftEnd.toISOString(),
    room: {
      id: assignment.room.id,
      code: assignment.room.code || assignment.room.id,
      name: assignment.room.name,
      floor: floorNumber(assignment.room.floor),
      department: assignment.room.specialty.department.name,
    },
  };
}

async function getQueue(auth) {
  const roomScope = doctorRoomScope(auth);
  const entries = await prisma.patientQueueEntry.findMany({
    where: {
      OR: [
        {
          status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
          ...(auth?.role === 'ADMIN' ? {} : { task: roomScope }),
        },
        {
          status: 'DONE',
          task: {
            taskType: 'DIAGNOSTIC_SERVICE',
            status: 'WAITING_RESULT',
            ...roomScope,
          },
        },
      ],
    },
    include: queueInclude,
    orderBy: [{ queueNumber: 'asc' }, { enqueuedAt: 'asc' }],
  });
  return entries.map(toQueueEntry).sort(compareQueueEntries);
}

async function getVisit(visitId, auth) {
  const accessibleTask = await findAccessibleTask(visitId, auth);
  if (!accessibleTask) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const journey = await patientService.loadJourney(visitId);
  if (!journey) throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  const task = journey.tasks.find((item) => item.id === accessibleTask.id);
  if (!task) throw new AppError('Visit has no tasks', 404, 'VISIT_TASK_NOT_FOUND');
  const entry = currentQueueEntry(task);
  const queue = toQueueEntry({
    ...entry,
    enqueuedAt: entry?.enqueuedAt || journey.checkinAt || journey.createdAt,
    priority: entry?.priority || task.clinicalPriority,
    status: entry?.status || 'WAITING',
    queueNumber: entry?.queueNumber || 0,
    task: { ...task, patient: journey.patient, journey },
  });
  const pathway = await patientService.getPathway(journey.patientToken, visitId);
  const validatedResults = journey.tasks
    .filter((item) => (
      item.taskType === 'DIAGNOSTIC_SERVICE'
      && item.status === 'COMPLETED'
      && item.completedAt
      && item.resultReadyAt
    ))
    .map((item) => ({
      id: item.id,
      serviceName: taskTitle(item),
      room: patientService.taskRoom(item),
      validatedAt: item.resultReadyAt.toISOString(),
      urgency: item.resultUrgency || 'NORMAL',
    }));

  return {
    queue,
    pathway,
    validatedResults,
  };
}

async function getCurrentRoomId(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth);
  if (!task) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  return task.roomId;
}

async function updatePriority(visitId, priority, auth) {
  const databasePriority = toDatabasePriority(priority);
  const task = await findAccessibleTask(visitId, auth);
  if (!task) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: { clinicalPriority: databasePriority, doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub },
    }),
    prisma.patientQueueEntry.updateMany({
      where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { priority: databasePriority },
    }),
  ]);
  const aiSync = await emitAiEvents([
    taskEvent('PRIORITY_CHANGED', task, {
      actorId: auth?.sub,
      metadata: { clinical_priority: databasePriority },
    }),
  ]);
  return { visitId, priority: toFrontendPriority(databasePriority), aiSynced: aiSync.synced };
}

async function callVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth);
  if (!task) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const now = new Date();
  await prisma.patientQueueEntry.updateMany({
    where: { taskId: task.id, status: { in: ['WAITING', 'CALLED'] } },
    data: { status: 'CALLED', calledAt: now },
  });
  const aiSync = await emitAiEvents([
    taskEvent('PATIENT_CALLED', task, { actorId: auth?.sub, eventTime: now }),
  ]);
  return { visitId, status: 'CALLED', calledAt: now.toISOString(), aiSynced: aiSync.synced };
}

async function startVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth);
  if (!task) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const activeEntry = await prisma.patientQueueEntry.findFirst({
    where: { taskId: task.id, status: { in: ['CALLED', 'IN_SERVICE', 'WAITING'] } },
    orderBy: { enqueuedAt: 'desc' },
  });
  if (!activeEntry) {
    throw new AppError('You must call the patient before starting examination', 422, 'MUST_CALL_FIRST');
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'IN_SERVICE',
        doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
        serviceStart: task.serviceStart || now,
      },
    }),
    prisma.patientQueueEntry.updateMany({
      where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { status: 'IN_SERVICE', serviceStartAt: now },
    }),
  ]);
  const aiSync = await emitAiEvents([
    taskEvent('SERVICE_STARTED', task, { actorId: auth?.sub, eventTime: now }),
  ]);
  return { visitId, status: 'IN_EXAMINATION', startedAt: now.toISOString(), aiSynced: aiSync.synced };
}

async function createIntake(payload, auth) {
  const cccd = payload.cccd.trim();
  const normalizedFullName = payload.name.trim().replace(/\s+/g, ' ');
  const existingPatient = await prisma.patient.findUnique({
    where: { identificationCode: cccd },
  });
  const patient = existingPatient
    ? await prisma.patient.update({
      where: { id: existingPatient.id },
      data: {
        status: 'ACTIVE',
        ...(!existingPatient.fullName ? { fullName: normalizedFullName } : {}),
      },
    })
    : await prisma.patient.create({
      data: {
        identificationCode: cccd,
        patientToken: `pt_${crypto.randomBytes(16).toString('hex')}`,
        fullName: normalizedFullName,
        status: 'ACTIVE',
      },
    });

  const checkedIn = await patientService.checkin(patient.patientToken, {
    patientType: payload.symptomReport?.dangerSigns?.length ? 'PRIORITY' : 'NORMAL',
    assignImmediately: false,
    intakeSource: 'STAFF_DESK',
  });
  if (payload.symptomReport) {
    await patientService.submitSymptoms(patient.patientToken, checkedIn.visitId, payload.symptomReport);
  }
  const routing = await patientService.confirmRouting(patient.patientToken, checkedIn.visitId, {
    department: payload.department,
    room: payload.room,
    estimatedWait: payload.estimatedWait,
    source: 'DOCTOR_INTAKE',
  });
  return {
    visitId: checkedIn.visitId,
    queueNumber: routing.queueNumber,
    currentRoom: routing.currentRoom,
    patient: {
      cccd: patient.identificationCode,
      fullName: patient.fullName || normalizedFullName,
    },
  };
}

async function createOrder(visitId, payload, auth) {
  const sourceTask = await findAccessibleTask(visitId, auth);
  if (!sourceTask) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const serviceDefinition = getServiceDefinition(payload.type);
  if (!serviceDefinition) {
    throw new AppError(`Service type '${payload.type}' is not supported`, 422, 'UNSUPPORTED_SERVICE_TYPE');
  }

  const room = await prisma.clinicRoom.findFirst({
    where: {
      isActive: true,
      OR: [
        { id: payload.room },
        { code: payload.room },
        { name: { contains: payload.room, mode: 'insensitive' } },
      ],
    },
    include: {
      specialty: { include: { department: true } },
      queues: { where: { isActive: true }, take: 1 },
    },
  });
  if (!room) throw new AppError(`Target room '${payload.room}' was not found`, 404, 'TARGET_ROOM_NOT_FOUND');

  const now = new Date();
  const databasePriority = toDatabasePriority(payload.priority || sourceTask.clinicalPriority);
  const journey = await patientService.loadJourney(visitId);
  if (!journey) throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const serviceType = serviceDefinition.serviceType;
  const queueId = room.queues[0]?.id || `QUEUE-${room.id}`;
  const diagnosticTaskId = `TASK-${crypto.randomUUID()}`;
  const returnTaskId = `TASK-${crypto.randomUUID()}`;
  if (!sourceTask.roomId || !sourceTask.queueId) {
    throw new AppError('The originating consultation has no room queue', 422, 'ORIGIN_QUEUE_NOT_FOUND');
  }

  const created = await prisma.$transaction(async (tx) => {
    const queue = await tx.serviceQueue.update({
      where: { id: queueId },
      data: { isActive: true },
    });
    const queueNumber = await tx.patientQueueEntry.count({
      where: { queueId: queue.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
    }) + 1;
    const sequenceOrder = await tx.patientJourneyTask.count({ where: { journeyId: visitId } }) + 1;
    await tx.patientJourneyTask.update({
      where: { id: sourceTask.id },
      data: {
        status: 'COMPLETED',
        doctorId: auth?.role === 'ADMIN' ? sourceTask.doctorId : auth?.sub,
        serviceEnd: now,
        completedAt: now,
      },
    });
    await tx.patientQueueEntry.updateMany({
      where: { taskId: sourceTask.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { status: 'DONE', serviceEndAt: now },
    });
    const diagnosticTask = await tx.patientJourneyTask.create({
      data: {
        id: diagnosticTaskId,
        journeyId: visitId,
        journeyStep: 'DIAGNOSTIC_SERVICE',
        parentTaskId: sourceTask.id,
        sourceDependsOnTaskId: sourceTask.id,
        patientToken: journey.patientToken,
        departmentId: room.specialty.departmentId,
        specialtyId: room.specialtyId,
        queueId: queue.id,
        roomId: room.id,
        taskType: 'DIAGNOSTIC_SERVICE',
        status: 'IN_QUEUE',
        serviceType,
        clinicalPriority: databasePriority,
        readinessStatus: 'COMPLETED',
        schedulingMode: 'FAIR_QUEUE',
        assignedAt: now,
        arrivalTime: now,
        readyAt: now,
        sequenceOrder,
      },
    });
    const returnTask = await tx.patientJourneyTask.create({
      data: {
        id: returnTaskId,
        journeyId: visitId,
        journeyStep: 'RETURN_REVIEW',
        parentTaskId: sourceTask.id,
        sourceDependsOnTaskId: diagnosticTaskId,
        patientToken: journey.patientToken,
        departmentId: sourceTask.departmentId,
        specialtyId: sourceTask.specialtyId,
        queueId: sourceTask.queueId,
        roomId: sourceTask.roomId,
        taskType: 'RETURN_REVIEW',
        status: 'WAITING_RESULT',
        serviceType: 'RESULT_REVIEW',
        clinicalPriority: databasePriority,
        readinessStatus: 'RESULT_PENDING',
        schedulingMode: 'FAIR_QUEUE',
        assignedAt: now,
        sequenceOrder: sequenceOrder + 1,
      },
    });
    await tx.patientTaskDependency.create({
      data: { taskId: returnTaskId, dependsOnTaskId: diagnosticTaskId },
    });
    await tx.patientQueueEntry.create({
      data: {
        queueId: queue.id,
        taskId: diagnosticTaskId,
        status: 'WAITING',
        priority: databasePriority,
        queueNumber,
        position: queueNumber,
      },
    });
    return {
      order: {
        id: diagnosticTaskId,
        type: payload.type,
        targetDepartment: room.specialty.department.name,
        priority: toFrontendPriority(databasePriority),
        clinicalNote: payload.clinicalNote,
        specialRequest: payload.specialRequest,
        room: room.id,
        returnRoom: sourceTask.roomId,
        status: 'PENDING',
      },
      diagnosticTask,
      returnTask,
    };
  });

  const aiSync = await emitAiEvents([
    taskEvent('SERVICE_COMPLETED', sourceTask, { actorId: auth?.sub, eventTime: now }),
    taskEvent('SERVICE_ORDERED', created.diagnosticTask, {
      actorId: auth?.sub,
      eventTime: now,
      metadata: {
        service_type: serviceType,
        scheduling_mode: 'FAIR_QUEUE',
        predicted_minutes: serviceType === 'ABDOMINAL_ULTRASOUND' ? 15 : 8,
      },
    }),
    taskEvent('SERVICE_ORDERED', created.returnTask, {
      actorId: auth?.sub,
      eventTime: now,
      metadata: {
        service_type: 'RESULT_REVIEW',
        scheduling_mode: 'FAIR_QUEUE',
        predicted_minutes: 5,
        dependency_task_ids: [diagnosticTaskId],
      },
    }),
    taskEvent('PATIENT_LEFT_FOR_OTHER_SERVICE', created.returnTask, {
      actorId: auth?.sub,
      eventTime: now,
      metadata: {
        destination_queue_id: room.id,
        destination_task_id: diagnosticTaskId,
      },
    }),
  ]);
  return { ...created.order, aiSynced: aiSync.synced };
}

async function completeVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth);
  if (!task) throw new AppError('No assigned active task found', 404, 'ACTIVE_TASK_NOT_FOUND');
  const now = new Date();

  // Handle Diagnostic Service Completion (X-ray, Ultrasound)
  if (task.taskType === 'DIAGNOSTIC_SERVICE') {
    const returnTask = await prisma.patientJourneyTask.findFirst({
      where: {
        journeyId: visitId,
        taskType: 'RETURN_REVIEW',
        OR: [
          { sourceDependsOnTaskId: task.id },
          { parentTaskId: task.parentTaskId },
        ],
      },
      include: { room: true },
    });

    let returnQueueNumber = null;

    await prisma.$transaction(async (tx) => {
      // 1. Complete the diagnostic task
      await tx.patientJourneyTask.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          readinessStatus: 'COMPLETED',
          doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
          serviceEnd: now,
          completedAt: now,
          resultReadyAt: now,
          resultUrgency: ['EMERGENCY', 'URGENT'].includes(task.clinicalPriority) ? 'URGENT' : 'NORMAL',
        },
      });

      // 2. Mark the diagnostic queue entry as DONE
      await tx.patientQueueEntry.updateMany({
        where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
        data: { status: 'DONE', serviceEndAt: now },
      });

      // 3. Immediately activate return review task and route back to originating doctor's queue
      if (returnTask && returnTask.queueId) {
        returnQueueNumber = await tx.patientQueueEntry.count({
          where: {
            queueId: returnTask.queueId,
            status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
          },
        }) + 1;

        await tx.patientJourneyTask.update({
          where: { id: returnTask.id },
          data: {
            status: 'IN_QUEUE',
            readinessStatus: 'COMPLETED',
            readyAt: now,
            arrivalTime: now,
            resultReadyAt: now,
          },
        });

        await tx.patientQueueEntry.create({
          data: {
            queueId: returnTask.queueId,
            taskId: returnTask.id,
            status: 'WAITING',
            priority: returnTask.clinicalPriority,
            queueNumber: returnQueueNumber,
            position: returnQueueNumber,
            enqueuedAt: now,
          },
        });
      }
    });

    const aiEvents = [
      taskEvent('SERVICE_COMPLETED', task, { actorId: auth?.sub, eventTime: now }),
    ];
    if (returnTask) {
      aiEvents.push(
        taskEvent('OTHER_SERVICE_COMPLETED', returnTask, {
          actorId: auth?.sub,
          eventTime: now,
          metadata: { completed_task_id: task.id },
        }),
        taskEvent('RESULT_READY', returnTask, { actorId: auth?.sub, eventTime: now }),
        taskEvent('RETURN_STARTED', returnTask, { actorId: auth?.sub, eventTime: now }),
        taskEvent('RETURN_ARRIVED', returnTask, { actorId: auth?.sub, eventTime: now })
      );
    }
    const aiSync = await emitAiEvents(aiEvents);

    return {
      visitId,
      status: 'WAITING_REVIEW',
      resultValidated: true,
      completedDiagnostic: true,
      returnRoom: returnTask?.room?.code || returnTask?.room?.name || returnTask?.roomId,
      queueNumber: returnQueueNumber ? formatQueueNumber(returnQueueNumber) : undefined,
      aiSynced: aiSync.synced,
    };
  }

  // Handle Regular Visit Completion (Initial Consult / Return Review)
  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        readinessStatus: 'COMPLETED',
        doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
        serviceEnd: now,
        completedAt: now,
      },
    }),
    prisma.patientQueueEntry.updateMany({
      where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { status: 'DONE', serviceEndAt: now },
    }),
  ]);

  const remaining = await prisma.patientJourneyTask.count({
    where: { journeyId: visitId, status: { in: activeTaskStatuses } },
  });
  const aiSync = await emitAiEvents([
    taskEvent('SERVICE_COMPLETED', task, { actorId: auth?.sub, eventTime: now }),
  ]);
  return {
    visitId,
    status: remaining ? 'WAITING_SERVICE' : 'COMPLETED',
    aiSynced: aiSync.synced,
  };
}

async function validateResult(visitId, auth) {
  const task = await prisma.patientJourneyTask.findFirst({
    where: {
      journeyId: visitId,
      taskType: 'DIAGNOSTIC_SERVICE',
      status: { in: ['WAITING_RESULT', 'COMPLETED', 'IN_SERVICE'] },
      ...doctorRoomScope(auth),
    },
    include: { room: true },
    orderBy: [{ sequenceOrder: 'desc' }, { createdAt: 'desc' }],
  });
  if (!task) {
    throw new AppError('No diagnostic result is waiting for validation', 404, 'RESULT_NOT_PENDING_VALIDATION');
  }
  const returnTask = await prisma.patientJourneyTask.findFirst({
    where: {
      journeyId: visitId,
      taskType: 'RETURN_REVIEW',
      sourceDependsOnTaskId: task.id,
    },
    include: { room: true },
  });
  if (!returnTask?.queueId || !returnTask.roomId) {
    throw new AppError('Return-review room is not configured', 422, 'RETURN_REVIEW_ROOM_NOT_FOUND');
  }

  const now = new Date();
  const existingQueueEntry = await prisma.patientQueueEntry.findFirst({
    where: { taskId: returnTask.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
  });

  let queueNumber = existingQueueEntry?.queueNumber;
  if (!queueNumber) {
    queueNumber = await prisma.patientQueueEntry.count({
      where: {
        queueId: returnTask.queueId,
        status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
      },
    }) + 1;
  }

  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        readinessStatus: 'COMPLETED',
        completedAt: task.completedAt || now,
        resultReadyAt: task.resultReadyAt || now,
        resultUrgency: ['EMERGENCY', 'URGENT'].includes(task.clinicalPriority) ? 'URGENT' : 'NORMAL',
      },
    }),
    prisma.patientJourneyTask.update({
      where: { id: returnTask.id },
      data: {
        status: 'IN_QUEUE',
        readinessStatus: 'COMPLETED',
        readyAt: now,
        arrivalTime: now,
        resultReadyAt: now,
      },
    }),
    ...(existingQueueEntry ? [] : [
      prisma.patientQueueEntry.create({
        data: {
          queueId: returnTask.queueId,
          taskId: returnTask.id,
          status: 'WAITING',
          priority: returnTask.clinicalPriority,
          queueNumber,
          position: queueNumber,
          enqueuedAt: now,
        },
      }),
    ]),
  ]);

  const aiSync = await emitAiEvents([
    taskEvent('OTHER_SERVICE_COMPLETED', returnTask, {
      actorId: auth?.sub,
      eventTime: now,
      metadata: { completed_task_id: task.id },
    }),
    taskEvent('RESULT_READY', returnTask, { actorId: auth?.sub, eventTime: now }),
    taskEvent('RETURN_STARTED', returnTask, { actorId: auth?.sub, eventTime: now }),
    taskEvent('RETURN_ARRIVED', returnTask, { actorId: auth?.sub, eventTime: now }),
  ]);
  return {
    visitId,
    status: 'WAITING_REVIEW',
    resultValidated: true,
    validatedAt: now.toISOString(),
    queueNumber: formatQueueNumber(queueNumber),
    room: returnTask.room?.code || returnTask.room?.name || returnTask.roomId,
    aiSynced: aiSync.synced,
  };
}

module.exports = {
  callVisit,
  completeVisit,
  createIntake,
  createOrder,
  getAssignment,
  getCurrentRoomId,
  getQueue,
  getVisit,
  startVisit,
  updatePriority,
  validateResult,
};

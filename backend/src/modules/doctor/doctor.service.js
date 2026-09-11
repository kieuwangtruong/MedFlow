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
const { calculateActualWaitTime, getPriorityTier } = require('../shared/wait-time');

const activeTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];
const actionableTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE'];

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
  const task = entry.task || {};
  const patient = task.patient || {};
  const isReview = Boolean(entry.isPriorityBump || task.taskType === 'RETURN_REVIEW' || task.journey?.queueStatus === 'WAITING_REVIEW');
  const enqueuedTime = entry.enqueuedAt ? entry.enqueuedAt.getTime() : Date.now();
  const waitedMinutes = Math.max(0, Math.round((Date.now() - enqueuedTime) / 60000));
  return {
    visitId: task.journeyId,
    queueNumber: formatQueueNumber(entry.queueNumber),
    patientName: patient.fullName || `Bệnh nhân ${patient.identificationCode || ''}`.trim(),
    age: patientAge(patient.dateOfBirth),
    mainSymptom: task.journey?.symptomDescription || taskTitle(task),
    priority: toFrontendPriority(entry.priority || task.clinicalPriority),
    waitedMinutes,
    status: isReview && entry.status === 'WAITING' ? 'WAITING_REVIEW' : toVisitStatus(task.status, entry.status, isReview),
    isPriorityBump: Boolean(entry.isPriorityBump || task.taskType === 'RETURN_REVIEW'),
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
  WAITING_REVIEW: 2,
  WAITING: 3,
  WAITING_RESULT: 4,
};

function compareQueueEntries(left, right) {
  const statusDifference = (queueStatusOrder[left.status] ?? 9) - (queueStatusOrder[right.status] ?? 9);
  if (statusDifference) return statusDifference;

  const tierLeft = left.priority === 'EMERGENCY' ? 0 : (left.isPriorityBump || left.taskType === 'RETURN_REVIEW' ? 1 : left.priority === 'URGENT' ? 2 : 3);
  const tierRight = right.priority === 'EMERGENCY' ? 0 : (right.isPriorityBump || right.taskType === 'RETURN_REVIEW' ? 1 : right.priority === 'URGENT' ? 2 : 3);
  if (tierLeft !== tierRight) return tierLeft - tierRight;

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
  return { visitId, priority: toFrontendPriority(databasePriority) };
}

async function callVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth, ['PENDING', 'READY', 'IN_QUEUE', 'WAITING_RESULT']);
  if (!task) throw new AppError('No assigned waiting task found', 404, 'WAITING_TASK_NOT_FOUND');
  const entry = await prisma.patientQueueEntry.findFirst({
    where: { taskId: task.id, status: { in: ['WAITING', 'CALLED'] } },
  });
  if (!entry) throw new AppError('Patient is not waiting in this room', 409, 'QUEUE_ENTRY_NOT_WAITING');

  const patient = await prisma.patient.findUnique({ where: { patientToken: task.patientToken } });
  if (entry.status === 'CALLED') {
    return {
      visitId,
      queueNumber: formatQueueNumber(entry.queueNumber),
      patientName: patient?.fullName || `Bệnh nhân ${patient?.identificationCode || ''}`.trim(),
      status: 'CALLED',
      calledAt: entry.calledAt?.toISOString(),
    };
  }

  // Priority-aware calling: check if there are higher priority waiting patients in this queue
  const waitingEntries = await prisma.patientQueueEntry.findMany({
    where: { queueId: entry.queueId, status: 'WAITING' },
    include: { task: true },
  });

  const entryTier = getPriorityTier(entry);
  const higherPriorityEntry = waitingEntries.find((item) => getPriorityTier(item) < entryTier);
  if (higherPriorityEntry && higherPriorityEntry.id !== entry.id) {
    throw new AppError('Call higher priority patients first', 409, 'QUEUE_PRIORITY_VIOLATION');
  }

  const sameTierEarlier = waitingEntries.find((item) => (
    getPriorityTier(item) === entryTier
    && item.id !== entry.id
    && ((item.queueNumber != null && entry.queueNumber != null && item.queueNumber < entry.queueNumber)
      || (item.queueNumber === entry.queueNumber && item.enqueuedAt < entry.enqueuedAt))
  ));
  if (sameTierEarlier) {
    throw new AppError('Call patients in queue-number order', 409, 'QUEUE_ORDER_VIOLATION');
  }

  const now = new Date();
  const actualWait = calculateActualWaitTime(entry.enqueuedAt || task.arrivalTime || task.readyAt, now);

  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'READY',
        actualWaitTime: actualWait,
      },
    }),
    prisma.patientQueueEntry.update({
      where: { id: entry.id },
      data: {
        status: 'CALLED',
        calledAt: now,
      },
    }),
  ]);

  return {
    visitId,
    queueNumber: formatQueueNumber(entry.queueNumber),
    patientName: patient?.fullName || `Bệnh nhân ${patient?.identificationCode || ''}`.trim(),
    status: 'CALLED',
    calledAt: now.toISOString(),
    actualWaitMinutes: actualWait,
  };
}

async function startVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth, ['PENDING', 'READY', 'IN_QUEUE']);
  if (!task) throw new AppError('No assigned waiting task found', 404, 'WAITING_TASK_NOT_FOUND');
  const calledEntry = await prisma.patientQueueEntry.findFirst({
    where: { taskId: task.id, status: 'CALLED' },
  });
  if (!calledEntry) {
    throw new AppError('Call the patient before starting the examination', 409, 'PATIENT_NOT_CALLED');
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'IN_SERVICE',
        serviceStart: now,
        doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
      },
    }),
    prisma.patientQueueEntry.updateMany({
      where: { taskId: task.id, status: 'CALLED' },
      data: { status: 'IN_SERVICE', serviceStartAt: now },
    }),
  ]);
  const aiSync = await emitAiEvents([
    taskEvent('SERVICE_STARTED', task, {
      actorId: auth?.sub,
      eventTime: now,
      metadata: { service_type: task.serviceType },
    }),
  ]);
  return { visitId, status: 'IN_EXAMINATION', aiSynced: aiSync.synced };
}

async function createIntake(payload) {
  const birthYear = new Date().getUTCFullYear() - payload.age;
  const patient = await prisma.patient.upsert({
    where: { identificationCode: payload.cccd },
    create: {
      identificationCode: payload.cccd,
      patientToken: `pt_${crypto.randomBytes(16).toString('hex')}`,
      fullName: payload.name.trim(),
      dateOfBirth: new Date(Date.UTC(birthYear, 0, 1)),
      status: 'ACTIVE',
    },
    update: {
      fullName: payload.name.trim(),
      dateOfBirth: new Date(Date.UTC(birthYear, 0, 1)),
      status: 'ACTIVE',
    },
  });
  const checkedIn = await patientService.checkin(patient.patientToken, {
    examinationType: 'GENERAL',
    patientType: 'INSURANCE',
    intakeSource: 'STAFF_DESK',
  });
  await patientService.submitSymptoms(patient.patientToken, checkedIn.visitId, payload.symptomReport);
  const routing = await patientService.confirmRouting(patient.patientToken, checkedIn.visitId, {
    room: payload.room,
    department: payload.department,
    estimatedWait: payload.estimatedWait,
    source: 'STAFF_DESK_SYMPTOM_ROUTING',
  });
  return {
    patient: {
      cccd: patient.identificationCode,
      fullName: patient.fullName,
    },
    visitId: checkedIn.visitId,
    queueNumber: routing.queueNumber,
    currentRoom: routing.currentRoom,
    existing: Boolean(checkedIn.existing),
  };
}

async function createOrder(visitId, payload, auth) {
  let sourceTask = await findAccessibleTask(visitId, auth);
  if (!sourceTask) {
    sourceTask = await prisma.patientJourneyTask.findFirst({
      where: {
        journeyId: visitId,
        taskType: 'INITIAL_CONSULT',
        ...doctorRoomScope(auth),
      },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  if (!sourceTask) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const service = getServiceDefinition(payload.type);
  if (!service) {
    throw new AppError('This service has no configured destination room', 422, 'UNSUPPORTED_SERVICE');
  }
  if (payload.room && payload.room === sourceTask.roomId) {
    throw new AppError(
      'Destination room must differ from the current examination room',
      422,
      'SAME_ROOM_REASSIGNMENT',
    );
  }
  const journey = await prisma.patientJourney.findUnique({ where: { id: visitId } });
  if (!journey) throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  const databasePriority = toDatabasePriority(payload.priority);
  const now = new Date();
  const staffedRoomWhere = {
    isActive: true,
    doctorAssignments: { some: activeAssignmentFilter({ now }) },
    queues: { some: { isActive: true, serviceType: service.serviceType } },
    specialty: {
      department: { name: { contains: service.department, mode: 'insensitive' } },
    },
  };

  let room = null;
  if (payload.room) {
    room = await prisma.clinicRoom.findFirst({
      where: { id: payload.room, ...staffedRoomWhere },
      include: { specialty: { include: { department: true } }, queues: true },
    });
    if (!room) {
      throw new AppError(
        'The selected room does not support this service',
        422,
        'ROOM_SERVICE_INCOMPATIBLE',
      );
    }
  }
  if (!payload.room) {
    room = await prisma.clinicRoom.findFirst({
      where: {
        ...staffedRoomWhere,
        ...(sourceTask.roomId ? { id: { not: sourceTask.roomId } } : {}),
      },
      include: { specialty: { include: { department: true } }, queues: true },
      orderBy: { code: 'asc' },
    });
  }
  if (!room) {
    throw new AppError(
      'No open room supports this service',
      422,
      'COMPATIBLE_ROOM_NOT_FOUND',
    );
  }

  const serviceQueue = room.queues.find((queue) => (
    queue.isActive && queue.serviceType === service.serviceType
  ));
  if (!serviceQueue) {
    throw new AppError(
      'The selected room has no active queue for this service',
      422,
      'SERVICE_QUEUE_NOT_FOUND',
    );
  }
  const queueId = serviceQueue.id;
  const serviceType = service.serviceType;
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

    // Track originRoomId and initialRoomId, update state machine
    await tx.patientJourney.update({
      where: { id: visitId },
      data: {
        initialRoomId: journey.initialRoomId || sourceTask.roomId,
        currentRoomId: room.id,
        queueStatus: 'WAITING_SERVICE',
      },
    });

    await tx.patientJourneyTask.update({
      where: { id: sourceTask.id },
      data: {
        status: 'COMPLETED',
        originRoomId: sourceTask.roomId,
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
        originRoomId: sourceTask.roomId,
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

    let returnTask = await tx.patientJourneyTask.findFirst({
      where: { journeyId: visitId, taskType: 'RETURN_REVIEW' },
    });

    if (!returnTask) {
      returnTask = await tx.patientJourneyTask.create({
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
          originRoomId: sourceTask.roomId,
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
    }

    await tx.patientTaskDependency.create({
      data: { taskId: returnTask.id, dependsOnTaskId: diagnosticTaskId },
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

  if (task.taskType === 'DIAGNOSTIC_SERVICE') {
    await prisma.$transaction([
      prisma.patientJourneyTask.update({
        where: { id: task.id },
        data: {
          status: 'WAITING_RESULT',
          readinessStatus: 'RESULT_PENDING',
          doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
          serviceEnd: now,
          completedAt: null,
          resultReadyAt: null,
        },
      }),
      prisma.patientQueueEntry.updateMany({
        where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
        data: { status: 'DONE', serviceEndAt: now },
      }),
    ]);
    const aiSync = await emitAiEvents([
      taskEvent('SERVICE_COMPLETED', task, { actorId: auth?.sub, eventTime: now }),
    ]);
    return {
      visitId,
      status: 'WAITING_RESULT',
      resultValidationRequired: true,
      aiSynced: aiSync.synced,
    };
  }

  await prisma.$transaction([
    prisma.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
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

async function completeOrder(visitId, taskId = null, payload = {}, auth = null) {
  const whereTask = {
    journeyId: visitId,
    taskType: 'DIAGNOSTIC_SERVICE',
    ...(taskId ? { id: taskId } : { status: { in: ['WAITING_RESULT', 'IN_SERVICE', 'IN_QUEUE'] } }),
    ...doctorRoomScope(auth),
  };

  const task = await prisma.patientJourneyTask.findFirst({
    where: whereTask,
    include: { room: true },
    orderBy: [{ sequenceOrder: 'desc' }, { createdAt: 'desc' }],
  });

  if (!task) {
    throw new AppError('No diagnostic order is ready for completion/validation', 404, 'ORDER_NOT_FOUND');
  }

  const journey = await prisma.patientJourney.findUnique({ where: { id: visitId } });
  if (!journey) throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const now = new Date();

  // ATOMIC DATABASE TRANSACTION (Req 1.2)
  const completionResult = await prisma.$transaction(async (tx) => {
    // 1. Mark this diagnostic task as COMPLETED with results
    await tx.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        readinessStatus: 'COMPLETED',
        completedAt: now,
        resultReadyAt: now,
        serviceEnd: now,
        doctorId: auth?.role === 'ADMIN' ? task.doctorId : (auth?.sub || task.doctorId),
        resultUrgency: payload.urgency || (['EMERGENCY', 'URGENT'].includes(task.clinicalPriority) ? 'URGENT' : 'NORMAL'),
      },
    });

    // 2. Mark queue entry for this task as DONE
    await tx.patientQueueEntry.updateMany({
      where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { status: 'DONE', serviceEndAt: now },
    });

    // 3. Check condition: Have ALL diagnostic orders for this journey reached COMPLETED?
    const remainingPendingDiagnostics = await tx.patientJourneyTask.count({
      where: {
        journeyId: visitId,
        taskType: 'DIAGNOSTIC_SERVICE',
        id: { not: task.id },
        status: { not: 'COMPLETED' },
      },
    });

    const isAllCompleted = remainingPendingDiagnostics === 0;
    let returnRoom = null;
    let returnQueueNumber = null;

    if (isAllCompleted) {
      // Find return task for this visit
      const returnTask = await tx.patientJourneyTask.findFirst({
        where: {
          journeyId: visitId,
          taskType: 'RETURN_REVIEW',
        },
        include: { room: true },
      });

      const initialRoomId = journey.initialRoomId || returnTask?.originRoomId || returnTask?.roomId;
      returnRoom = returnTask?.room?.code || returnTask?.room?.name || returnTask?.roomId || initialRoomId;

      // 4. Automatically switch current_room_id back to initial_room_id and set status to WAITING_REVIEW
      await tx.patientJourney.update({
        where: { id: visitId },
        data: {
          currentRoomId: initialRoomId,
          queueStatus: 'WAITING_REVIEW',
        },
      });

      if (returnTask && returnTask.queueId) {
        // Activate return review task
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

        // 5. Calculate queue number and apply PRIORITY BUMP in initial room's queue
        returnQueueNumber = await tx.patientQueueEntry.count({
          where: {
            queueId: returnTask.queueId,
            status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
          },
        }) + 1;

        await tx.patientQueueEntry.upsert({
          where: { taskId_queueId: { taskId: returnTask.id, queueId: returnTask.queueId } },
          create: {
            queueId: returnTask.queueId,
            taskId: returnTask.id,
            status: 'WAITING',
            priority: returnTask.clinicalPriority,
            isPriorityBump: true, // Priority Bump flag!
            queueNumber: returnQueueNumber,
            position: returnQueueNumber,
            enqueuedAt: now,
          },
          update: {
            status: 'WAITING',
            isPriorityBump: true, // Priority Bump flag!
            enqueuedAt: now,
          },
        });
      }
    } else {
      // Remaining diagnostic orders are still in progress
      await tx.patientJourney.update({
        where: { id: visitId },
        data: {
          queueStatus: 'WAITING_SERVICE',
        },
      });
    }

    return {
      isAllCompleted,
      remainingPendingDiagnostics,
      returnRoom,
      returnQueueNumber,
    };
  });

  const returnTaskForEvent = await prisma.patientJourneyTask.findFirst({
    where: { journeyId: visitId, taskType: 'RETURN_REVIEW' },
  });

  const aiSync = returnTaskForEvent
    ? await emitAiEvents([
      taskEvent('OTHER_SERVICE_COMPLETED', returnTaskForEvent, {
        actorId: auth?.sub,
        eventTime: now,
        metadata: { completed_task_id: task.id },
      }),
      taskEvent('RESULT_READY', returnTaskForEvent, { actorId: auth?.sub, eventTime: now }),
      ...(completionResult.isAllCompleted
        ? [
          taskEvent('RETURN_STARTED', returnTaskForEvent, { actorId: auth?.sub, eventTime: now }),
          taskEvent('RETURN_ARRIVED', returnTaskForEvent, { actorId: auth?.sub, eventTime: now }),
        ]
        : []),
    ])
    : { synced: true };

  return {
    visitId,
    orderId: task.id,
    status: completionResult.isAllCompleted ? 'WAITING_REVIEW' : 'WAITING_SERVICE',
    allOrdersCompleted: completionResult.isAllCompleted,
    remainingOrdersCount: completionResult.remainingPendingDiagnostics,
    resultValidated: true,
    validatedAt: now.toISOString(),
    queueNumber: completionResult.returnQueueNumber ? formatQueueNumber(completionResult.returnQueueNumber) : undefined,
    room: completionResult.returnRoom,
    aiSynced: aiSync.synced,
  };
}

async function validateResult(visitId, auth) {
  return completeOrder(visitId, null, {}, auth);
}

module.exports = {
  callVisit,
  completeOrder,
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

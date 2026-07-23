const crypto = require('node:crypto');
const AppError = require('../../errors/app-error');
const prisma = require('../../lib/prisma');
const patientService = require('../patient/patient.service');
const { emitAiEvents, taskEvent } = require('../shared/ai-events');
const { activeAssignmentFilter, activeRoomFilter } = require('../shared/doctor-assignments');
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
  const task = entry.task;
  const patient = task.patient;
  const waitedMinutes = Math.max(0, Math.round((Date.now() - entry.enqueuedAt.getTime()) / 60000));
  return {
    visitId: task.journeyId,
    queueNumber: formatQueueNumber(entry.queueNumber),
    patientName: patient.fullName || `Bệnh nhân ${patient.identificationCode}`,
    age: patientAge(patient.dateOfBirth),
    mainSymptom: task.journey?.symptomDescription || taskTitle(task),
    priority: toFrontendPriority(entry.priority || task.clinicalPriority),
    waitedMinutes,
    status: toVisitStatus(task.status, entry.status),
    department: patientService.taskDepartment(task),
    room: task.room?.code || task.room?.name || 'Chưa phân phòng',
  };
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
  const entries = await prisma.patientQueueEntry.findMany({
    where: {
      status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
      ...(auth?.role === 'ADMIN' ? {} : {
        task: doctorRoomScope(auth),
      }),
    },
    include: queueInclude,
    orderBy: [{ priority: 'asc' }, { enqueuedAt: 'asc' }],
  });
  return entries.map(toQueueEntry);
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
  const waitingCount = task.queueId
    ? await prisma.patientQueueEntry.count({
      where: { queueId: task.queueId, status: { in: ['WAITING', 'CALLED'] } },
    })
    : 0;
  const pathway = await patientService.getPathway(journey.patientToken, visitId);

  return {
    queue,
    pathway,
    recommendation: {
      department: patientService.taskDepartment(task),
      room: patientService.taskRoom(task),
      floor: floorNumber(task.room?.floor),
      estimatedWait: Math.round(task.queue?.estimatedWaitMinutes || 0),
      waitingCount,
      reason: 'Đề xuất dựa trên chuyên khoa, trạng thái phòng và hàng đợi hiện tại.',
      confidence: 0.75,
      priority: toFrontendPriority(task.clinicalPriority),
      requiresHumanReview: true,
    },
  };
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

async function startVisit(visitId, auth) {
  const task = await findAccessibleTask(visitId, auth, ['PENDING', 'READY', 'IN_QUEUE']);
  if (!task) throw new AppError('No assigned waiting task found', 404, 'WAITING_TASK_NOT_FOUND');
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
      where: { taskId: task.id, status: { in: ['WAITING', 'CALLED'] } },
      data: { status: 'IN_SERVICE', calledAt: now, serviceStartAt: now },
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

function serviceTypeFor(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('siêu âm')) return 'ABDOMINAL_ULTRASOUND';
  if (normalized.includes('kết quả')) return 'RESULT_REVIEW';
  return 'XRAY';
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
  const sourceTask = await findAccessibleTask(visitId, auth);
  if (!sourceTask) throw new AppError('Visit is not assigned to your active room', 404, 'VISIT_NOT_ASSIGNED');
  const journey = await prisma.patientJourney.findUnique({ where: { id: visitId } });
  if (!journey) throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  const databasePriority = toDatabasePriority(payload.priority);
  const now = new Date();
  const staffedRoomWhere = {
    isActive: true,
    doctorAssignments: { some: activeAssignmentFilter({ now }) },
  };

  let room = null;
  if (payload.room) {
    room = await prisma.clinicRoom.findFirst({
      where: { id: payload.room, ...staffedRoomWhere },
      include: { specialty: { include: { department: true } }, queues: true },
    });
  }
  if (!room) {
    room = await prisma.clinicRoom.findFirst({
      where: {
        ...staffedRoomWhere,
        specialty: { department: { name: { contains: payload.targetDepartment, mode: 'insensitive' } } },
      },
      include: { specialty: { include: { department: true } }, queues: true },
      orderBy: { code: 'asc' },
    });
  }
  if (!room) throw new AppError('No staffed room is available for this service', 422, 'STAFFED_ROOM_NOT_FOUND');

  const queueId = room.queues.find((queue) => queue.isActive)?.id || `QUEUE-${room.id}`;
  const serviceType = serviceTypeFor(payload.type);
  const diagnosticTaskId = `TASK-${crypto.randomUUID()}`;
  const returnTaskId = `TASK-${crypto.randomUUID()}`;
  if (!sourceTask.roomId || !sourceTask.queueId) {
    throw new AppError('The originating consultation has no room queue', 422, 'ORIGIN_QUEUE_NOT_FOUND');
  }

  const created = await prisma.$transaction(async (tx) => {
    const queue = await tx.serviceQueue.upsert({
      where: { id: queueId },
      create: {
        id: queueId,
        name: `Hàng đợi ${room.name}`,
        roomId: room.id,
        serviceType,
        isActive: true,
        estimatedWaitMinutes: 0,
      },
      update: { roomId: room.id, isActive: true },
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

  if (task.taskType === 'DIAGNOSTIC_SERVICE') {
    const returnTask = await prisma.patientJourneyTask.findFirst({
      where: {
        journeyId: visitId,
        taskType: 'RETURN_REVIEW',
        sourceDependsOnTaskId: task.id,
        status: 'WAITING_RESULT',
      },
      include: { room: true },
    });

    if (returnTask?.queueId && returnTask.roomId) {
      const queueNumber = await prisma.patientQueueEntry.count({
        where: {
          queueId: returnTask.queueId,
          status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
        },
      }) + 1;
      await prisma.$transaction([
        prisma.patientJourneyTask.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            doctorId: auth?.role === 'ADMIN' ? task.doctorId : auth?.sub,
            serviceEnd: now,
            completedAt: now,
            resultReadyAt: now,
            resultUrgency: ['EMERGENCY', 'URGENT'].includes(task.clinicalPriority) ? 'URGENT' : 'NORMAL',
          },
        }),
        prisma.patientQueueEntry.updateMany({
          where: { taskId: task.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
          data: { status: 'DONE', serviceEndAt: now },
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
      ]);

      const aiSync = await emitAiEvents([
        taskEvent('SERVICE_COMPLETED', task, { actorId: auth?.sub, eventTime: now }),
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
        queueNumber: formatQueueNumber(queueNumber),
        room: returnTask.room?.code || returnTask.room?.name || returnTask.roomId,
        aiSynced: aiSync.synced,
      };
    }
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

module.exports = {
  completeVisit,
  createIntake,
  createOrder,
  getAssignment,
  getQueue,
  getVisit,
  startVisit,
  updatePriority,
};

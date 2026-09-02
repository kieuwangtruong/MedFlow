const crypto = require('node:crypto');
const AppError = require('../../errors/app-error');
const prisma = require('../../lib/prisma');
const { emitAiEvents, taskEvent } = require('../shared/ai-events');
const { activeAssignmentFilter, activeDoctorForRoom } = require('../shared/doctor-assignments');
const { calculateEWT } = require('../shared/queue-calculations');
const {
  currentQueueEntry,
  floorNumber,
  formatQueueNumber,
  taskTitle,
  toFrontendPriority,
  toStepStatus,
  toVisitStatus,
} = require('../shared/presenters');

const activeTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];

const taskInclude = {
  department: true,
  specialty: { include: { department: true } },
  queue: true,
  room: {
    include: {
      doctor: true,
      doctorAssignments: { where: { status: 'ACTIVE' }, include: { doctor: true } },
      specialty: { include: { department: true } },
    },
  },
  queueEntries: { orderBy: { enqueuedAt: 'desc' } },
};

function createJourneyId() {
  const day = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  return `VIS-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createTaskId() {
  return `TASK-${crypto.randomUUID()}`;
}

function assertPatientJourney(journey, patientToken) {
  if (!journey || journey.patientToken !== patientToken) {
    throw new AppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  }
}

async function loadJourney(visitId) {
  return prisma.patientJourney.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      tasks: {
        include: taskInclude,
        orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
}

function taskDepartment(task) {
  return task.department?.name
    || task.specialty?.department?.name
    || task.room?.specialty?.department?.name
    || 'Đang phân luồng';
}

function taskRoom(task) {
  return task.room?.name || task.room?.code || 'Chưa xác định';
}

async function checkin(patientToken, payload) {
  const patient = await prisma.patient.findUnique({ where: { patientToken } });
  if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

  const existingJourney = await prisma.patientJourney.findFirst({
    where: { patientToken, tasks: { some: { status: { in: activeTaskStatuses } } } },
    include: {
      tasks: {
        where: { status: { in: activeTaskStatuses } },
        include: { queueEntries: { orderBy: { enqueuedAt: 'desc' } }, room: true },
        orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existingJourney?.tasks[0]) {
    const entry = currentQueueEntry(existingJourney.tasks[0]);
    return {
      visitId: existingJourney.id,
      queueNumber: formatQueueNumber(entry?.queueNumber),
      currentRoom: existingJourney.tasks[0].room?.name || null,
      requiresSymptoms: !existingJourney.symptomsSubmittedAt,
      existing: true,
    };
  }

  const now = new Date();
  if (payload.assignImmediately !== true) {
    const priority = payload.patientType === 'PRIORITY' ? 'URGENT' : 'NORMAL';
    const created = await prisma.$transaction(async (tx) => {
      const journeyId = createJourneyId();
      const taskId = createTaskId();
      await tx.patientJourney.create({
        data: {
          id: journeyId,
          patientToken,
          checkinAt: now,
          severityScore: priority === 'URGENT' ? 50 : 10,
          intakeSource: payload.intakeSource || 'PATIENT_SELF',
        },
      });
      const task = await tx.patientJourneyTask.create({
        data: {
          id: taskId,
          journeyId,
          journeyStep: 'INITIAL_CONSULT',
          patientToken,
          taskType: 'INITIAL_CONSULT',
          status: 'PENDING',
          serviceType: 'CLINICAL_CONSULT',
          clinicalPriority: priority,
          assignedAt: now,
          arrivalTime: now,
          readyAt: now,
          sequenceOrder: 1,
        },
      });
      return { visitId: journeyId, task };
    });
    const aiSync = await emitAiEvents([
      taskEvent('PATIENT_CHECKED_IN', created.task, {
        metadata: {
          service_type: created.task.serviceType,
          checkin_at: now.toISOString(),
          physical_arrival_at: now.toISOString(),
          presence_status: 'ARRIVED_AT_HOSPITAL',
        },
      }),
    ]);
    return {
      visitId: created.visitId,
      queueNumber: '--',
      currentRoom: null,
      requiresSymptoms: true,
      aiSynced: aiSync.synced,
    };
  }
  const roomInclude = {
    specialty: { include: { department: true } },
    queues: { where: { isActive: true }, take: 1 },
  };
  const staffedRoomWhere = {
    isActive: true,
    doctorAssignments: { some: activeAssignmentFilter({ now }) },
  };
  let room = await prisma.clinicRoom.findFirst({
    where: {
      ...staffedRoomWhere,
      specialty: { departmentId: 'ER' },
    },
    include: roomInclude,
    orderBy: { code: 'asc' },
  });
  if (!room) room = await prisma.clinicRoom.findFirst({
    where: staffedRoomWhere,
    include: {
      ...roomInclude,
    },
    orderBy: { code: 'asc' },
  });
  if (!room) throw new AppError('No staffed clinic room is available', 503, 'NO_STAFFED_ROOM');

  const queueId = room.queues[0]?.id || `QUEUE-${room.id}`;
  const priority = payload.patientType === 'PRIORITY' ? 'URGENT' : 'NORMAL';

  const created = await prisma.$transaction(async (tx) => {
    const queue = await tx.serviceQueue.upsert({
      where: { id: queueId },
      create: {
        id: queueId,
        name: `Hàng đợi ${room.name}`,
        roomId: room.id,
        serviceType: 'CLINICAL_CONSULT',
        isActive: true,
        estimatedWaitMinutes: 0,
      },
      update: { roomId: room.id, isActive: true },
    });
    const queueNumber = await tx.patientQueueEntry.count({
      where: { queueId: queue.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
    }) + 1;
    const journeyId = createJourneyId();
    const taskId = createTaskId();

    await tx.patientJourney.create({
      data: {
        id: journeyId,
        patientToken,
        checkinAt: now,
        severityScore: priority === 'URGENT' ? 50 : 10,
      },
    });
    const task = await tx.patientJourneyTask.create({
      data: {
        id: taskId,
        journeyId,
        journeyStep: 'INITIAL_CONSULT',
        patientToken,
        departmentId: room.specialty.departmentId,
        specialtyId: room.specialtyId,
        queueId: queue.id,
        roomId: room.id,
        taskType: 'INITIAL_CONSULT',
        status: 'IN_QUEUE',
        serviceType: 'CLINICAL_CONSULT',
        clinicalPriority: priority,
        assignedAt: now,
        arrivalTime: now,
        readyAt: now,
        sequenceOrder: 1,
      },
    });
    await tx.patientQueueEntry.create({
      data: {
        queueId: queue.id,
        taskId,
        status: 'WAITING',
        priority,
        queueNumber,
        position: queueNumber,
        enqueuedAt: now,
      },
    });

    return { visitId: journeyId, queueNumber: formatQueueNumber(queueNumber), task };
  });

  const aiSync = await emitAiEvents([
    taskEvent('PATIENT_CHECKED_IN', created.task, {
      metadata: {
        service_type: created.task.serviceType,
        checkin_at: now.toISOString(),
        physical_arrival_at: now.toISOString(),
        presence_status: 'READY_AT_ROOM',
      },
    }),
  ]);
  return {
    visitId: created.visitId,
    queueNumber: created.queueNumber,
    aiSynced: aiSync.synced,
  };
}

async function submitSymptoms(patientToken, visitId, payload) {
  const journey = await prisma.patientJourney.findUnique({ where: { id: visitId } });
  assertPatientJourney(journey, patientToken);

  const dangerCount = Array.isArray(payload.dangerSigns) ? payload.dangerSigns.length : 0;
  const painLevel = Number(payload.painLevel) || 0;
  const priority = dangerCount > 0 ? 'EMERGENCY' : painLevel >= 8 ? 'URGENT' : 'NORMAL';
  const severityScore = Math.min(100, dangerCount * 40 + painLevel * 5 + 10);

  await prisma.$transaction([
    prisma.patientJourney.update({
      where: { id: visitId },
      data: {
        severityScore,
        symptomDescription: (payload.description || '').trim(),
        symptomPayload: payload,
        symptomsSubmittedAt: new Date(),
        intakeSource: journey.intakeSource || 'PATIENT_SELF',
      },
    }),
    prisma.patientJourneyTask.updateMany({
      where: { journeyId: visitId, status: { in: activeTaskStatuses } },
      data: { clinicalPriority: priority },
    }),
    prisma.patientQueueEntry.updateMany({
      where: { task: { journeyId: visitId }, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      data: { priority },
    }),
  ]);

  return { visitId, priority: toFrontendPriority(priority), severityScore };
}

async function findRoutingRoom(payload, now = new Date()) {
  const roomInclude = {
    specialty: { include: { department: true } },
    queues: { where: { isActive: true } },
  };
  const roomMatch = payload.room
    ? {
      OR: [
        { id: payload.room },
        { code: payload.room },
        { name: { equals: payload.room, mode: 'insensitive' } },
        { name: { contains: payload.room, mode: 'insensitive' } },
      ],
    }
    : {};
  const departmentMatch = payload.department
    ? { specialty: { department: { name: { contains: payload.department, mode: 'insensitive' } } } }
    : {};
  const target = { ...roomMatch, ...departmentMatch };
  let room = await prisma.clinicRoom.findFirst({
    where: {
      isActive: true,
      ...target,
      doctorAssignments: { some: activeAssignmentFilter({ now }) },
    },
    include: roomInclude,
    orderBy: { code: 'asc' },
  });
  if (!room) room = await prisma.clinicRoom.findFirst({
    where: { isActive: true, doctorId: { not: null }, ...target },
    include: roomInclude,
    orderBy: { code: 'asc' },
  });
  if (!room && payload.department) room = await prisma.clinicRoom.findFirst({
    where: { isActive: true, doctorId: { not: null }, ...departmentMatch },
    include: roomInclude,
    orderBy: { code: 'asc' },
  });
  return room;
}

async function confirmRouting(patientToken, visitId, payload) {
  const journey = await prisma.patientJourney.findUnique({ where: { id: visitId } });
  assertPatientJourney(journey, patientToken);
  const task = await prisma.patientJourneyTask.findFirst({
    where: {
      journeyId: visitId,
      taskType: 'INITIAL_CONSULT',
      status: { in: ['PENDING', 'READY', 'IN_QUEUE'] },
    },
    include: { queueEntries: { orderBy: { enqueuedAt: 'desc' } }, room: true },
    orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
  });
  if (!task) throw new AppError('No routable initial consultation task', 404, 'ROUTABLE_TASK_NOT_FOUND');
  const existingEntry = currentQueueEntry(task);
  if (task.roomId && task.queueId && existingEntry) {
    return {
      visitId,
      queueNumber: formatQueueNumber(existingEntry.queueNumber),
      currentRoom: task.room?.name || task.roomId,
      existing: true,
    };
  }

  const room = await findRoutingRoom(payload);
  if (!room) throw new AppError('No clinic room matches the selected routing', 422, 'ROUTING_ROOM_NOT_FOUND');
  const queueId = room.queues.find((queue) => queue.serviceType === 'CLINICAL_CONSULT')?.id
    || room.queues[0]?.id
    || `QUEUE-${room.id}`;
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const queue = await tx.serviceQueue.upsert({
      where: { id: queueId },
      create: {
        id: queueId,
        name: `Hàng đợi ${room.name}`,
        roomId: room.id,
        serviceType: 'CLINICAL_CONSULT',
        isActive: true,
        estimatedWaitMinutes: Number(payload.estimatedWait) || 0,
      },
      update: {
        roomId: room.id,
        isActive: true,
        estimatedWaitMinutes: Number(payload.estimatedWait) || 0,
      },
    });
    const queueNumber = await tx.patientQueueEntry.count({
      where: { queueId: queue.id, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
    }) + 1;
    const updatedTask = await tx.patientJourneyTask.update({
      where: { id: task.id },
      data: {
        departmentId: room.specialty.departmentId,
        specialtyId: room.specialtyId,
        roomId: room.id,
        queueId: queue.id,
        status: 'IN_QUEUE',
        assignedAt: now,
        readyAt: now,
      },
    });
    await tx.patientQueueEntry.upsert({
      where: { taskId_queueId: { taskId: task.id, queueId: queue.id } },
      create: {
        queueId: queue.id,
        taskId: task.id,
        status: 'WAITING',
        priority: task.clinicalPriority,
        queueNumber,
        position: queueNumber,
        enqueuedAt: now,
      },
      update: {
        status: 'WAITING',
        priority: task.clinicalPriority,
        queueNumber,
        position: queueNumber,
        enqueuedAt: now,
      },
    });
    return { queueNumber, updatedTask };
  });
  await emitAiEvents([
    taskEvent('TASK_ASSIGNED', result.updatedTask, {
      eventTime: now,
      metadata: { room_id: room.id, routing_source: payload.source || 'SYMPTOM_ROUTING' },
    }),
  ]);
  return {
    visitId,
    queueNumber: formatQueueNumber(result.queueNumber),
    currentRoom: room.name,
    roomId: room.id,
  };
}

async function kioskCheckin(cccd, fullName, payload) {
  const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
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
  return checkin(patient.patientToken, { ...payload, intakeSource: 'KIOSK' });
}

async function getPathway(patientToken, visitId) {
  const journey = await loadJourney(visitId);
  assertPatientJourney(journey, patientToken);

  const currentTask = journey.tasks.find((task) => activeTaskStatuses.includes(task.status))
    || journey.tasks.at(-1);
  const entry = currentTask ? currentQueueEntry(currentTask) : null;

  let peopleAhead = 0;
  let estimatedWait = 0;

  if (currentTask && currentTask.status !== 'COMPLETED' && currentTask.queueId && entry) {
    peopleAhead = await prisma.patientQueueEntry.count({
      where: {
        queueId: entry.queueId,
        status: 'WAITING',
        queueNumber: { lt: entry.queueNumber },
      },
    });

    const activeInService = await prisma.patientQueueEntry.findFirst({
      where: {
        queueId: entry.queueId,
        status: 'IN_SERVICE',
      },
      orderBy: { serviceStartAt: 'desc' },
    });

    estimatedWait = calculateEWT({
      patientsAhead: peopleAhead,
      currentServiceStart: activeInService?.serviceStartAt || null,
      serviceType: currentTask.serviceType,
      taskType: currentTask.taskType,
    });
  }

  let offsetMinutes = 0;
  const steps = [];

  for (const task of journey.tasks) {
    const queueEntry = currentQueueEntry(task);
    let wait = 0;

    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      wait = 0;
    } else if (task.status === 'IN_SERVICE') {
      wait = 0;
    } else if (task.queueId && queueEntry) {
      const stepAhead = await prisma.patientQueueEntry.count({
        where: {
          queueId: task.queueId,
          status: 'WAITING',
          queueNumber: { lt: queueEntry.queueNumber },
        },
      });

      const stepInService = await prisma.patientQueueEntry.findFirst({
        where: {
          queueId: task.queueId,
          status: 'IN_SERVICE',
        },
        orderBy: { serviceStartAt: 'desc' },
      });

      wait = calculateEWT({
        patientsAhead: stepAhead,
        currentServiceStart: stepInService?.serviceStartAt || null,
        serviceType: task.serviceType,
        taskType: task.taskType,
      });
    }

    offsetMinutes += wait;
    const estimatedStart = new Date(Date.now() + offsetMinutes * 60000).toISOString();

    steps.push({
      id: task.id,
      title: taskTitle(task),
      department: taskDepartment(task),
      room: taskRoom(task),
      doctor: activeDoctorForRoom(task.room)?.fullName || undefined,
      status: toStepStatus(task.status, queueEntry?.status),
      estimatedWait: wait,
      estimatedStart,
      actualTime: task.completedAt?.toISOString(),
      directions: task.room ? `${task.room.floor || 'Tầng 1'} · ${task.room.name}` : 'Theo hướng dẫn của nhân viên',
    });
  }

  return {
    visitId,
    visitStatus: currentTask
      ? toVisitStatus(currentTask.status, entry?.status)
      : 'CHECKED_IN',
    queueNumber: formatQueueNumber(entry?.queueNumber),
    currentRoom: currentTask ? taskRoom(currentTask) : 'Quầy tiếp nhận',
    currentTaskType: currentTask?.taskType,
    waitingForValidatedResult: Boolean(
      currentTask?.taskType === 'DIAGNOSTIC_SERVICE' && currentTask.status === 'WAITING_RESULT'
    ),
    resultValidated: Boolean(
      currentTask?.taskType === 'RETURN_REVIEW'
      && currentTask.readinessStatus === 'COMPLETED'
      && currentTask.resultReadyAt
    ),
    peopleAhead,
    estimatedWait,
    steps,
  };
}

async function getResults(patientToken, visitId) {
  const journey = await loadJourney(visitId);
  assertPatientJourney(journey, patientToken);

  return journey.tasks
    .filter((task) => task.taskType === 'DIAGNOSTIC_SERVICE')
    .map((task) => ({
      id: task.id,
      serviceName: taskTitle(task),
      status: task.completedAt && task.resultReadyAt
        ? 'READY'
        : task.status === 'IN_SERVICE' || task.status === 'WAITING_RESULT' || task.serviceEnd
          ? 'PROCESSING'
          : 'PENDING',
      estimatedAt: (task.resultReadyAt || task.scheduleWindowEnd || new Date(Date.now() + 30 * 60000)).toISOString(),
      doctorConfirmed: Boolean(task.completedAt && task.resultReadyAt),
    }));
}

async function getNotifications(patientToken) {
  const journey = await prisma.patientJourney.findFirst({
    where: { patientToken },
    orderBy: { createdAt: 'desc' },
    include: {
      patient: true,
      tasks: {
        where: { status: { in: activeTaskStatuses } },
        include: taskInclude,
        orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!journey) return [];
  const task = journey.tasks[0];
  const entry = task ? currentQueueEntry(task) : null;
  const now = new Date().toISOString();
  const patientName = journey.patient.fullName || `Bệnh nhân ${journey.patient.identificationCode}`;
  const isCalled = entry?.status === 'CALLED';
  const waitingForResult = task?.taskType === 'DIAGNOSTIC_SERVICE' && task.status === 'WAITING_RESULT';
  const returningForReview = task?.taskType === 'RETURN_REVIEW' && ['IN_QUEUE', 'READY', 'WAITING'].includes(task.status);
  return [
    {
      id: `${journey.id}-queue`,
      title: isCalled
        ? 'Đã đến lượt của bạn'
        : waitingForResult
          ? 'Kết quả đang được kiểm định'
          : returningForReview
            ? 'Kết quả đã hoàn tất'
            : 'Lượt khám đang hoạt động',
      message: isCalled
        ? `Mời ${patientName}, số ${formatQueueNumber(entry.queueNumber)}, vào ${taskRoom(task)}.`
        : waitingForResult
          ? `Vui lòng chờ ${taskRoom(task)} kiểm định kết quả; chưa cần quay lại phòng khám ban đầu.`
          : returningForReview
            ? `Mời quay lại ${taskRoom(task)} theo số ${formatQueueNumber(entry?.queueNumber)} để bác sĩ trả kết quả.`
            : entry
              ? `Số ${formatQueueNumber(entry.queueNumber)} tại ${taskRoom(task)}.`
              : 'Hành trình khám của bạn đã được ghi nhận.',
      createdAt: now,
      read: false,
    },
    ...(task?.room ? [{
      id: `${journey.id}-room`,
      title: 'Phòng tiếp nhận',
      message: `${taskDepartment(task)} · ${taskRoom(task)} · tầng ${floorNumber(task.room.floor)}.`,
      createdAt: now,
      read: false,
    }] : []),
  ];
}

module.exports = {
  checkin,
  confirmRouting,
  getNotifications,
  getPathway,
  getResults,
  kioskCheckin,
  loadJourney,
  submitSymptoms,
  taskDepartment,
  taskInclude,
  taskRoom,
};

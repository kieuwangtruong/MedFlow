const AppError = require('../../errors/app-error');
const prisma = require('../../lib/prisma');
const { requestAi } = require('../ai-gateway/ai-client');
const patientService = require('../patient/patient.service');
const { activeAssignmentFilter, activeDoctorForRoom } = require('../shared/doctor-assignments');
const {
  currentQueueEntry,
  floorNumber,
  formatQueueNumber,
  toFrontendPriority,
  toVisitStatus,
} = require('../shared/presenters');

const activeTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];

const roomInclude = {
  doctor: true,
  doctorAssignments: { where: { status: 'ACTIVE' }, include: { doctor: true } },
  equipments: true,
  specialty: { include: { department: true } },
  queues: {
    include: {
      entries: {
        where: { status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
        orderBy: { enqueuedAt: 'asc' },
      },
    },
  },
};

function roomStatus(room) {
  if (!room.isActive) return 'CLOSED';
  if (!activeDoctorForRoom(room)) return 'CLOSED';
  if (room.equipments.length && room.equipments.every((equipment) => equipment.status === 'INACTIVE')) {
    return 'PAUSED';
  }
  return 'OPEN';
}

function toRoom(room) {
  const entries = room.queues.flatMap((queue) => queue.entries);
  const serving = entries.find((entry) => entry.status === 'IN_SERVICE');
  const averageWait = room.queues.length
    ? Math.round(room.queues.reduce((sum, queue) => sum + queue.estimatedWaitMinutes, 0) / room.queues.length)
    : 0;
  return {
    id: room.id,
    code: room.code || room.id,
    name: room.name,
    department: room.specialty.department.name,
    floor: floorNumber(room.floor),
    doctor: activeDoctorForRoom(room)?.fullName || undefined,
    waitingCount: entries.filter((entry) => ['WAITING', 'CALLED'].includes(entry.status)).length,
    servingPatient: serving ? formatQueueNumber(serving.queueNumber) : undefined,
    averageWait,
    status: roomStatus(room),
  };
}

async function getRooms() {
  const rooms = await prisma.clinicRoom.findMany({
    include: roomInclude,
    orderBy: [{ floor: 'asc' }, { code: 'asc' }],
  });
  return rooms.map(toRoom);
}

async function getDoctors() {
  const doctors = await prisma.staffUser.findMany({
    where: { role: 'DOCTOR' },
    include: {
      roomAssignments: {
        where: activeAssignmentFilter(),
        include: {
          room: {
            include: {
              specialty: { include: { department: true } },
              queues: { include: { entries: true } },
            },
          },
        },
      },
    },
    orderBy: { fullName: 'asc' },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Promise.all(doctors.map(async (doctor) => {
    const assignment = doctor.roomAssignments[0];
    const room = assignment?.room;
    const entries = room?.queues.flatMap((queue) => queue.entries) || [];
    const examinedToday = await prisma.patientJourneyTask.count({
      where: { doctorId: doctor.id, completedAt: { gte: today } },
    });
    const completedDurations = await prisma.patientJourneyTask.findMany({
      where: {
        doctorId: doctor.id,
        completedAt: { gte: today },
        serviceStart: { not: null },
        serviceEnd: { not: null },
      },
      select: { serviceStart: true, serviceEnd: true },
      take: 50,
    });
    const averageMinutes = completedDurations.length
      ? Math.round(completedDurations.reduce((sum, task) => (
        sum + (task.serviceEnd.getTime() - task.serviceStart.getTime()) / 60000
      ), 0) / completedDurations.length)
      : 0;
    const busy = entries.some((entry) => entry.status === 'IN_SERVICE');
    return {
      id: doctor.id,
      fullName: doctor.fullName || doctor.username,
      department: room?.specialty.department.name || 'Chưa phân khoa',
      room: room?.code || room?.name || 'Chưa phân phòng',
      status: doctor.status !== 'ACTIVE' || !assignment ? 'OFFLINE' : busy ? 'BUSY' : 'AVAILABLE',
      examinedToday,
      waitingPatients: entries.filter((entry) => ['WAITING', 'CALLED'].includes(entry.status)).length,
      averageMinutes,
    };
  }));
}

async function getLiveVisits() {
  const journeys = await prisma.patientJourney.findMany({
    where: { tasks: { some: { status: { in: activeTaskStatuses } } } },
    include: {
      patient: true,
      tasks: {
        include: patientService.taskInclude,
        orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { checkinAt: 'desc' },
    take: 200,
  });

  return journeys.map((journey) => {
    const task = journey.tasks.find((item) => activeTaskStatuses.includes(item.status))
      || journey.tasks.at(-1);
    const entry = currentQueueEntry(task);
    const checkinTime = journey.checkinAt || journey.createdAt;
    const waitingMinutes = Math.max(0, Math.round((Date.now() - checkinTime.getTime()) / 60000));
    return {
      id: journey.id,
      patientId: journey.patient.id,
      patientName: journey.patient.fullName || `Bệnh nhân ${journey.patient.identificationCode}`,
      queueNumber: formatQueueNumber(entry?.queueNumber),
      checkinTime: checkinTime.toISOString(),
      priority: toFrontendPriority(task.clinicalPriority),
      status: toVisitStatus(task.status, entry?.status),
      department: patientService.taskDepartment(task),
      room: task.room?.code || task.room?.name || 'Chưa phân phòng',
      doctor: task.room?.doctor?.fullName || undefined,
      waitingMinutes,
      nextStep: task.status === 'WAITING_RESULT' ? 'Nhận kết quả' : 'Thực hiện dịch vụ',
      estimatedCompletion: new Date(Date.now() + (task.queue?.estimatedWaitMinutes || 30) * 60000).toISOString(),
    };
  });
}

async function updateRoomStatus(roomId, status) {
  const room = await prisma.clinicRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.clinicRoom.update({
      where: { id: roomId },
      data: { isActive: status !== 'CLOSED' },
    });
    if (status === 'PAUSED') {
      const count = await tx.equipment.count({ where: { roomId } });
      if (!count) {
        await tx.equipment.create({
          data: {
            name: `Trạng thái vận hành ${room.name}`,
            code: `OPS-${roomId}`.slice(0, 64),
            roomId,
            status: 'INACTIVE',
          },
        });
      } else {
        await tx.equipment.updateMany({ where: { roomId }, data: { status: 'INACTIVE' } });
      }
    } else if (status === 'OPEN') {
      await tx.equipment.updateMany({ where: { roomId }, data: { status: 'ACTIVE' } });
    }
  });
  return { roomId, status };
}

async function getDashboard() {
  const [visits, rooms, doctors, forecastResponse] = await Promise.all([
    getLiveVisits(),
    getRooms(),
    getDoctors(),
    requestAi('/api/v1/forecasts', { method: 'POST', body: { days: 1 } }).catch(() => ({ forecasts: [] })),
  ]);
  return { visits, rooms, doctors, forecasts: forecastResponse.forecasts || [] };
}

module.exports = { getDashboard, getDoctors, getLiveVisits, getRooms, updateRoomStatus };

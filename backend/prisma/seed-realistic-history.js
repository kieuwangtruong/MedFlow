const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log('🔄 Bắt đầu dọn dẹp và chuẩn hóa dữ liệu lịch sử & hàng đợi thực tế...');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);

  // 1. Dọn dẹp các queue entries và tasks cũ từ những ngày trước đang bị kẹt WAITING hoặc CALLED
  console.log('🧹 Dọn dẹp các hàng đợi thử nghiệm cũ...');
  await prisma.patientQueueEntry.updateMany({
    where: {
      status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
      enqueuedAt: { lt: today },
    },
    data: {
      status: 'DONE',
      serviceEndAt: today,
    },
  });

  await prisma.patientJourneyTask.updateMany({
    where: {
      status: { in: ['IN_QUEUE', 'READY', 'IN_SERVICE', 'WAITING_RESULT'] },
      createdAt: { lt: today },
    },
    data: {
      status: 'COMPLETED',
      completedAt: today,
      actualWaitTime: 12.5,
      resultDelayMinutes: 0,
    },
  });

  // 2. Tìm phòng khám tổng quát 101 và bác sĩ Minh Khang
  const room101 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'PK-TQ-101' }, { code: '101' }, { name: { contains: '101' } }] },
    include: { specialty: true, queues: true },
  });

  const room102 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'CC-102' }, { code: '102' }, { name: { contains: '102' } }] },
    include: { specialty: true, queues: true },
  });

  const room501 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'CDHA-501' }, { code: '501' }, { name: { contains: '501' } }] },
    include: { specialty: true, queues: true },
  });

  if (!room101) {
    console.error('Không tìm thấy phòng 101!');
    return;
  }

  const queue101Id = room101.queues[0]?.id || `QUEUE-${room101.id}`;
  const queue102Id = room102?.queues[0]?.id || `QUEUE-${room102?.id || 'CC-102'}`;
  const queue501Id = room501?.queues[0]?.id || `QUEUE-${room501?.id || 'CDHA-501'}`;

  // Đảm bảo ServiceQueue tồn tại và có thông số chuẩn
  await prisma.serviceQueue.upsert({
    where: { id: queue101Id },
    create: {
      id: queue101Id,
      name: `Hàng đợi ${room101.name}`,
      roomId: room101.id,
      serviceType: 'CLINICAL_CONSULT',
      isActive: true,
      estimatedWaitMinutes: 15,
    },
    update: { estimatedWaitMinutes: 15, isActive: true },
  });

  if (room102) {
    await prisma.serviceQueue.upsert({
      where: { id: queue102Id },
      create: {
        id: queue102Id,
        name: `Hàng đợi ${room102.name}`,
        roomId: room102.id,
        serviceType: 'CLINICAL_CONSULT',
        isActive: true,
        estimatedWaitMinutes: 0,
      },
      update: { estimatedWaitMinutes: 0, isActive: true },
    });
  }

  if (room501) {
    await prisma.serviceQueue.upsert({
      where: { id: queue501Id },
      create: {
        id: queue501Id,
        name: `Hàng đợi ${room501.name}`,
        roomId: room501.id,
        serviceType: 'XRAY',
        isActive: true,
        estimatedWaitMinutes: 8,
      },
      update: { estimatedWaitMinutes: 8, isActive: true },
    });
  }

  // 3. Xóa các queue entries hôm nay của phòng 101 để nạp lại bộ dữ liệu chuẩn
  await prisma.patientQueueEntry.deleteMany({
    where: {
      queueId: queue101Id,
      enqueuedAt: { gte: today },
    },
  });

  console.log('🏥 Đang tạo 5 ca khám hoạt động sống động cho Bác sĩ Minh Khang (Phòng 101)...');

  // Danh sách bệnh nhân thực tế cho Phòng 101
  const activeCases = [
    {
      cccd: '001095012341',
      token: 'pt_an_nguyen_active',
      name: 'Nguyễn Văn An',
      dob: '1990-05-12',
      gender: 'Nam',
      symptom: 'Đau tức vùng thượng vị âm ỉ sau ăn, ợ chua kéo dài',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'CALLED',
      entryStatus: 'CALLED',
      queueNum: 1,
      minutesAgo: 10,
      calledAgo: 2,
    },
    {
      cccd: '001198023452',
      token: 'pt_mai_tran_review',
      name: 'Trần Thị Mai',
      dob: '1985-08-22',
      gender: 'Nữ',
      symptom: 'Đau đầu, hoa mắt chóng mặt khi thay đổi tư thế (Đã chụp X-quang)',
      priority: 'NORMAL',
      taskType: 'RETURN_REVIEW',
      isReview: true,
      queueStatus: 'WAITING_REVIEW',
      entryStatus: 'WAITING',
      queueNum: 2,
      minutesAgo: 6,
    },
    {
      cccd: '001088034563',
      token: 'pt_long_le_urgent',
      name: 'Lê Hoàng Long',
      dob: '1988-11-03',
      gender: 'Nam',
      symptom: 'Sốt cao 39.2°C, đau quặn bụng từng cơn, nôn 2 lần',
      priority: 'URGENT',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 3,
      minutesAgo: 8,
    },
    {
      cccd: '001092045674',
      token: 'pt_tuan_pham_normal',
      name: 'Phạm Minh Tuấn',
      dob: '1992-03-15',
      gender: 'Nam',
      symptom: 'Kiểm tra sức khỏe định kỳ & tư vấn huyết áp hơi cao',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 4,
      minutesAgo: 14,
    },
    {
      cccd: '001196056785',
      token: 'pt_lan_vu_normal',
      name: 'Vũ Thị Lan',
      dob: '1996-09-28',
      gender: 'Nữ',
      symptom: 'Đau mỏi vùng vai gáy và tê bì nhẹ đầu ngón tay phải',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 5,
      minutesAgo: 19,
    },
  ];

  for (const c of activeCases) {
    const patient = await prisma.patient.upsert({
      where: { identificationCode: c.cccd },
      create: {
        identificationCode: c.cccd,
        patientToken: c.token,
        fullName: c.name,
        dateOfBirth: new Date(c.dob),
        status: 'ACTIVE',
      },
      update: {
        fullName: c.name,
        patientToken: c.token,
        dateOfBirth: new Date(c.dob),
        status: 'ACTIVE',
      },
    });

    const enqueuedAt = new Date(now.getTime() - c.minutesAgo * 60000);
    const calledAt = c.calledAgo ? new Date(now.getTime() - c.calledAgo * 60000) : null;
    const journeyId = `VIS-${now.toISOString().slice(2, 10).replaceAll('-', '')}-${c.queueNum.toString().padStart(3, '0')}A`;
    const taskId = `TASK-${c.token}-${c.taskType.toLowerCase()}`;

    const journey = await prisma.patientJourney.upsert({
      where: { id: journeyId },
      create: {
        id: journeyId,
        patientToken: patient.patientToken,
        checkinAt: enqueuedAt,
        initialRoomId: room101.id,
        currentRoomId: room101.id,
        queueStatus: c.queueStatus,
        symptomDescription: c.symptom,
        severityScore: c.priority === 'URGENT' ? 50 : 20,
      },
      update: {
        queueStatus: c.queueStatus,
        symptomDescription: c.symptom,
        initialRoomId: room101.id,
        currentRoomId: room101.id,
      },
    });

    const task = await prisma.patientJourneyTask.upsert({
      where: { id: taskId },
      create: {
        id: taskId,
        journeyId: journey.id,
        journeyStep: c.taskType === 'RETURN_REVIEW' ? 'RETURN_REVIEW' : 'INITIAL_CONSULT',
        patientToken: patient.patientToken,
        departmentId: room101.specialty?.departmentId,
        specialtyId: room101.specialtyId,
        queueId: queue101Id,
        roomId: room101.id,
        taskType: c.taskType,
        status: c.entryStatus === 'CALLED' ? 'READY' : 'IN_QUEUE',
        serviceType: c.taskType === 'RETURN_REVIEW' ? 'RESULT_REVIEW' : 'CLINICAL_CONSULT',
        clinicalPriority: c.priority,
        readinessStatus: 'COMPLETED',
        assignedAt: enqueuedAt,
        arrivalTime: enqueuedAt,
        readyAt: enqueuedAt,
        resultReadyAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        completedAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        actualWaitTime: c.calledAgo ? c.minutesAgo - c.calledAgo : c.minutesAgo,
        resultDelayMinutes: c.minutesAgo > 15 ? c.minutesAgo - 15 : 0,
        sequenceOrder: c.queueNum,
      },
      update: {
        status: c.entryStatus === 'CALLED' ? 'READY' : 'IN_QUEUE',
        actualWaitTime: c.calledAgo ? c.minutesAgo - c.calledAgo : c.minutesAgo,
        resultDelayMinutes: c.minutesAgo > 15 ? c.minutesAgo - 15 : 0,
        readyAt: enqueuedAt,
        resultReadyAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        completedAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
      },
    });

    await prisma.patientQueueEntry.upsert({
      where: { taskId_queueId: { taskId: task.id, queueId: queue101Id } },
      create: {
        id: `entry-${task.id}`,
        queueId: queue101Id,
        taskId: task.id,
        status: c.entryStatus,
        priority: c.priority,
        queueNumber: c.queueNum,
        position: c.queueNum,
        isPriorityBump: Boolean(c.isReview),
        enqueuedAt: enqueuedAt,
        calledAt: calledAt,
        serviceStartAt: calledAt,
      },
      update: {
        status: c.entryStatus,
        priority: c.priority,
        queueNumber: c.queueNum,
        position: c.queueNum,
        isPriorityBump: Boolean(c.isReview),
        enqueuedAt: enqueuedAt,
        calledAt: calledAt,
        serviceStartAt: calledAt,
      },
    });
  }

  // 4. Tạo các ca đã hoàn thành khám sáng nay (Historical Completed) với chỉ số thời gian đẹp & chuẩn
  console.log('✅ Đang tạo 4 ca khám đã hoàn thành sáng nay với thời gian chờ chuẩn mực (10 - 15 phút)...');
  const completedCases = [
    { name: 'Đỗ Hùng Dũng', cccd: '001091099881', symptom: 'Viêm họng cấp, sốt nhẹ', waitMin: 11.5, serviceMin: 9.0, hour: 8 },
    { name: 'Nguyễn Thu Hà', cccd: '001193088772', symptom: 'Rối loạn tiêu hóa chức năng', waitMin: 14.0, serviceMin: 11.5, hour: 9 },
    { name: 'Hoàng Văn Nam', cccd: '001089077663', symptom: 'Đau nhức khớp gối mạn', waitMin: 10.0, serviceMin: 13.0, hour: 10 },
    { name: 'Bùi Thị Ngọc', cccd: '001197066554', symptom: 'Cảm cúm thông thường', waitMin: 12.0, serviceMin: 8.5, hour: 11 },
  ];

  for (let i = 0; i < completedCases.length; i++) {
    const item = completedCases[i];
    const checkin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), item.hour, 15, 0);
    const start = new Date(checkin.getTime() + item.waitMin * 60000);
    const end = new Date(start.getTime() + item.serviceMin * 60000);
    const jId = `VIS-${now.toISOString().slice(2, 10).replaceAll('-', '')}-HIST0${i + 1}`;
    const tId = `TASK-HIST-101-0${i + 1}`;

    const pat = await prisma.patient.upsert({
      where: { identificationCode: item.cccd },
      create: {
        identificationCode: item.cccd,
        patientToken: `pt_hist_${i + 1}`,
        fullName: item.name,
        dateOfBirth: new Date('1992-06-15'),
        status: 'ACTIVE',
      },
      update: { fullName: item.name },
    });

    await prisma.patientJourney.upsert({
      where: { id: jId },
      create: {
        id: jId,
        patientToken: pat.patientToken,
        checkinAt: checkin,
        initialRoomId: room101.id,
        currentRoomId: room101.id,
        queueStatus: 'COMPLETED',
        symptomDescription: item.symptom,
        severityScore: 20,
      },
      update: { queueStatus: 'COMPLETED' },
    });

    await prisma.patientJourneyTask.upsert({
      where: { id: tId },
      create: {
        id: tId,
        journeyId: jId,
        journeyStep: 'INITIAL_CONSULT',
        patientToken: pat.patientToken,
        departmentId: room101.specialty?.departmentId,
        specialtyId: room101.specialtyId,
        queueId: queue101Id,
        roomId: room101.id,
        taskType: 'INITIAL_CONSULT',
        status: 'COMPLETED',
        serviceType: 'CLINICAL_CONSULT',
        clinicalPriority: 'NORMAL',
        assignedAt: checkin,
        arrivalTime: checkin,
        readyAt: checkin,
        serviceStart: start,
        serviceEnd: end,
        completedAt: end,
        actualWaitTime: item.waitMin,
        resultDelayMinutes: 0,
        sequenceOrder: i + 1,
      },
      update: {
        status: 'COMPLETED',
        actualWaitTime: item.waitMin,
        resultDelayMinutes: 0,
        serviceStart: start,
        serviceEnd: end,
        completedAt: end,
      },
    });

    await prisma.patientQueueEntry.upsert({
      where: { taskId_queueId: { taskId: tId, queueId: queue101Id } },
      create: {
        id: `entry-${tId}`,
        queueId: queue101Id,
        taskId: tId,
        status: 'DONE',
        priority: 'NORMAL',
        queueNumber: 10 + i,
        enqueuedAt: checkin,
        calledAt: start,
        serviceStartAt: start,
        serviceEndAt: end,
      },
      update: {
        status: 'DONE',
        enqueuedAt: checkin,
        calledAt: start,
        serviceStartAt: start,
        serviceEndAt: end,
      },
    });
  }

  console.log('✨ Hoàn tất! Dữ liệu đã được làm mới: Thời gian chờ thực tế trong khoảng 6 - 19 phút, các ca hoàn thành đạt 10 - 14 phút!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

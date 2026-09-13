const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log('🔄 Bắt đầu hoàn thiện dữ liệu lịch sử hôm qua và tạo mới dữ liệu trực quan cho ngày hôm nay...');

  const now = new Date();
  const dayStr = now.toISOString().slice(2, 10).replaceAll('-', ''); // e.g. 260913
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);

  // 1. Chuyển toàn bộ các queue entries và tasks của ngày hôm trước về trạng thái COMPLETED / DONE
  console.log('📦 Chuẩn hóa các lượt khám của ngày hôm trước thành dữ liệu lịch sử hoàn tất...');
  await prisma.patientQueueEntry.updateMany({
    where: {
      status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
      enqueuedAt: { lt: todayStart },
    },
    data: {
      status: 'DONE',
      serviceEndAt: todayStart,
    },
  });

  await prisma.patientJourneyTask.updateMany({
    where: {
      status: { in: ['PENDING', 'IN_QUEUE', 'READY', 'IN_SERVICE', 'WAITING_RESULT'] },
      createdAt: { lt: todayStart },
    },
    data: {
      status: 'COMPLETED',
      completedAt: todayStart,
      actualWaitTime: 12.0,
      resultDelayMinutes: 0,
    },
  });

  await prisma.patientJourney.updateMany({
    where: {
      createdAt: { lt: todayStart },
      OR: [
        { queueStatus: { not: 'COMPLETED' } },
        { queueStatus: null },
      ],
    },
    data: {
      queueStatus: 'COMPLETED',
    },
  });

  // Chuẩn hóa bất kỳ task nào có actualWaitTime > 60 phút thành giá trị lâm sàng chuẩn
  await prisma.patientJourneyTask.updateMany({
    where: {
      actualWaitTime: { gt: 60 },
    },
    data: {
      actualWaitTime: 14.5,
    },
  });

  // 2. Tìm danh sách các phòng khám chính trong bệnh viện
  const room101 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'PK-TQ-101' }, { code: '101' }, { name: { contains: '101' } }] },
    include: { specialty: true, queues: true },
  });
  const room102 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'CC-102' }, { code: '102' }, { name: { contains: '102' } }] },
    include: { specialty: true, queues: true },
  });
  const room301 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'NK-301' }, { code: '301' }, { name: { contains: '301' } }] },
    include: { specialty: true, queues: true },
  });
  const room303 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'CXK-303' }, { code: '303' }, { name: { contains: '303' } }] },
    include: { specialty: true, queues: true },
  });
  const room501 = await prisma.clinicRoom.findFirst({
    where: { OR: [{ code: 'CDHA-501' }, { code: '501' }, { name: { contains: '501' } }] },
    include: { specialty: true, queues: true },
  });

  if (!room101) {
    console.error('Không tìm thấy phòng khám 101!');
    return;
  }

  // Khởi tạo các hàng đợi (ServiceQueue) chuẩn
  const queue101Id = room101.queues[0]?.id || `QUEUE-${room101.id}`;
  const queue102Id = room102?.queues[0]?.id || `QUEUE-${room102?.id || 'CC-102'}`;
  const queue301Id = room301?.queues[0]?.id || `QUEUE-${room301?.id || 'NK-301'}`;
  const queue303Id = room303?.queues[0]?.id || `QUEUE-${room303?.id || 'CXK-303'}`;
  const queue501Id = room501?.queues[0]?.id || `QUEUE-${room501?.id || 'CDHA-501'}`;

  const queuesToEnsure = [
    { id: queue101Id, room: room101, name: room101.name, serviceType: 'CLINICAL_CONSULT', wait: 15 },
    room102 && { id: queue102Id, room: room102, name: room102.name, serviceType: 'CLINICAL_CONSULT', wait: 0 },
    room301 && { id: queue301Id, room: room301, name: room301.name, serviceType: 'CLINICAL_CONSULT', wait: 10 },
    room303 && { id: queue303Id, room: room303, name: room303.name, serviceType: 'CLINICAL_CONSULT', wait: 12 },
    room501 && { id: queue501Id, room: room501, name: room501.name, serviceType: 'XRAY', wait: 8 },
  ].filter(Boolean);

  for (const q of queuesToEnsure) {
    await prisma.serviceQueue.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        name: `Hàng đợi ${q.name}`,
        roomId: q.room.id,
        serviceType: q.serviceType,
        isActive: true,
        estimatedWaitMinutes: q.wait,
      },
      update: { estimatedWaitMinutes: q.wait, isActive: true },
    });
  }

  // 3. Xóa các queue entries hôm nay của các phòng để nạp lại dữ liệu đồng bộ, không bị trùng lặp
  await prisma.patientQueueEntry.deleteMany({
    where: {
      queueId: { in: queuesToEnsure.map(q => q.id) },
      enqueuedAt: { gte: todayStart },
    },
  });

  // 4. Nạp các ca khám ĐÃ HOÀN THÀNH trong ngày hôm nay (Morning & Afternoon Historical Visits)
  console.log('📈 Đang tạo các ca khám hoàn thành trải đều sáng & chiều hôm nay với chỉ số chuẩn y tế...');
  const todayCompletedCases = [
    // Phòng 101: 6 ca hoàn tất
    { name: 'Đỗ Hùng Dũng', cccd: '001091099881', symptom: 'Viêm họng cấp, sốt nhẹ', waitMin: 10.5, serviceMin: 9.5, hour: 8, room: room101, queueId: queue101Id },
    { name: 'Nguyễn Thu Hà', cccd: '001193088772', symptom: 'Rối loạn tiêu hóa chức năng', waitMin: 13.0, serviceMin: 11.0, hour: 9, room: room101, queueId: queue101Id },
    { name: 'Hoàng Văn Nam', cccd: '001089077663', symptom: 'Đau nhức khớp gối mạn', waitMin: 9.5, serviceMin: 12.5, hour: 10, room: room101, queueId: queue101Id },
    { name: 'Bùi Thị Ngọc', cccd: '001197066554', symptom: 'Cảm cúm thông thường', waitMin: 11.0, serviceMin: 8.5, hour: 11, room: room101, queueId: queue101Id },
    { name: 'Lý Quốc Toàn', cccd: '001084055445', symptom: 'Tái khám tăng huyết áp vô căn', waitMin: 12.0, serviceMin: 10.0, hour: 14, room: room101, queueId: queue101Id },
    { name: 'Mai Phương Thảo', cccd: '001195044336', symptom: 'Viêm dạ dày Hp âm tính', waitMin: 14.5, serviceMin: 12.0, hour: 15, room: room101, queueId: queue101Id },

    // Phòng Cấp cứu 102: 2 ca đã xử trí cấp cứu ban đầu
    room102 && { name: 'Trịnh Quốc Cường', cccd: '001087033227', symptom: 'Đau thắt ngực cấp, khó thở nhẹ', waitMin: 2.0, serviceMin: 25.0, hour: 9, room: room102, queueId: queue102Id, prio: 'EMERGENCY' },
    room102 && { name: 'Ngô Thanh Tùng', cccd: '001093022118', symptom: 'Chấn thương rách da cẳng tay do tai nạn', waitMin: 4.0, serviceMin: 20.0, hour: 14, room: room102, queueId: queue102Id, prio: 'URGENT' },

    // Phòng Chẩn đoán hình ảnh 501: 3 ca đã chụp xong
    room501 && { name: 'Lê Văn Bảy', cccd: '001078011009', symptom: 'Chụp X-quang tim phổi thẳng', waitMin: 6.0, serviceMin: 7.5, hour: 10, room: room501, queueId: queue501Id, serviceType: 'XRAY' },
    room501 && { name: 'Phạm Thu Trang', cccd: '001199000990', symptom: 'Siêu âm ổ bụng tổng quát', waitMin: 8.5, serviceMin: 14.0, hour: 11, room: room501, queueId: queue501Id, serviceType: 'ABDOMINAL_ULTRASOUND' },
  ].filter(Boolean);

  for (let i = 0; i < todayCompletedCases.length; i++) {
    const item = todayCompletedCases[i];
    const checkin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), item.hour, 10 + i * 2, 0);
    const start = new Date(checkin.getTime() + item.waitMin * 60000);
    const end = new Date(start.getTime() + item.serviceMin * 60000);
    const jId = `VIS-${dayStr}-C${(i + 1).toString().padStart(3, '0')}`;
    const tId = `TASK-${dayStr}-C${(i + 1).toString().padStart(3, '0')}`;
    const token = `pt_comp_${dayStr}_${i + 1}`;

    const pat = await prisma.patient.upsert({
      where: { identificationCode: item.cccd },
      create: {
        identificationCode: item.cccd,
        patientToken: token,
        fullName: item.name,
        dateOfBirth: new Date('1990-01-01'),
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
        initialRoomId: item.room.id,
        currentRoomId: item.room.id,
        queueStatus: 'COMPLETED',
        symptomDescription: item.symptom,
        severityScore: item.prio === 'EMERGENCY' ? 80 : item.prio === 'URGENT' ? 50 : 20,
      },
      update: { queueStatus: 'COMPLETED' },
    });

    await prisma.patientJourneyTask.upsert({
      where: { id: tId },
      create: {
        id: tId,
        journeyId: jId,
        journeyStep: item.serviceType ? 'DIAGNOSTIC_SERVICE' : 'INITIAL_CONSULT',
        patientToken: pat.patientToken,
        departmentId: item.room.specialty?.departmentId,
        specialtyId: item.room.specialtyId,
        queueId: item.queueId,
        roomId: item.room.id,
        taskType: item.serviceType ? 'DIAGNOSTIC_SERVICE' : 'INITIAL_CONSULT',
        status: 'COMPLETED',
        serviceType: item.serviceType || 'CLINICAL_CONSULT',
        clinicalPriority: item.prio || 'NORMAL',
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
      where: { taskId_queueId: { taskId: tId, queueId: item.queueId } },
      create: {
        id: `entry-${tId}`,
        queueId: item.queueId,
        taskId: tId,
        status: 'DONE',
        priority: item.prio || 'NORMAL',
        queueNumber: 20 + i,
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

  // 5. Nạp các ca ĐANG CHỜ KHÁM & ĐANG KHÁM SỐNG ĐỘNG (Current Live Queue)
  console.log('⚡ Đang tạo hàng đợi hoạt động sống động cho ca trực hiện tại...');

  const liveQueueList = [
    // Phòng 101: Bác sĩ Minh Khang
    {
      cccd: '001095012341',
      token: `pt_an_${dayStr}`,
      name: 'Nguyễn Văn An',
      dob: '1990-05-12',
      symptom: 'Đau tức vùng thượng vị âm ỉ sau ăn, ợ chua kéo dài',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'CALLED',
      entryStatus: 'CALLED',
      queueNum: 1,
      room: room101,
      queueId: queue101Id,
      minutesAgo: 8,
      calledAgo: 2,
    },
    {
      cccd: '001198023452',
      token: `pt_mai_${dayStr}`,
      name: 'Trần Thị Mai',
      dob: '1985-08-22',
      symptom: 'Đau đầu, hoa mắt chóng mặt khi đổi tư thế (Đã chụp X-quang, có kết quả)',
      priority: 'NORMAL',
      taskType: 'RETURN_REVIEW',
      isReview: true,
      queueStatus: 'WAITING_REVIEW',
      entryStatus: 'WAITING',
      queueNum: 2,
      room: room101,
      queueId: queue101Id,
      minutesAgo: 6,
    },
    {
      cccd: '001088034563',
      token: `pt_long_${dayStr}`,
      name: 'Lê Hoàng Long',
      dob: '1988-11-03',
      symptom: 'Sốt cao 39.2°C, đau quặn bụng từng cơn, nôn 2 lần',
      priority: 'URGENT',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 3,
      room: room101,
      queueId: queue101Id,
      minutesAgo: 9,
    },
    {
      cccd: '001092045674',
      token: `pt_tuan_${dayStr}`,
      name: 'Phạm Minh Tuấn',
      dob: '1992-03-15',
      symptom: 'Kiểm tra sức khỏe định kỳ & tư vấn huyết áp dao động',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 4,
      room: room101,
      queueId: queue101Id,
      minutesAgo: 14,
    },
    {
      cccd: '001196056785',
      token: `pt_lan_${dayStr}`,
      name: 'Vũ Thị Lan',
      dob: '1996-09-28',
      symptom: 'Đau mỏi vai gáy và tê bì nhẹ ngón tay phải',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 5,
      room: room101,
      queueId: queue101Id,
      minutesAgo: 18,
    },

    // Phòng Cấp cứu 102: 1 ca cấp cứu khẩn
    room102 && {
      cccd: '001099088771',
      token: `pt_duc_${dayStr}`,
      name: 'Hoàng Minh Đức',
      dob: '1975-04-10',
      symptom: 'Đau tức ngực trái dữ dội lan vai, khó thở cấp, vã mồ hôi lạnh',
      priority: 'EMERGENCY',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'CALLED',
      entryStatus: 'CALLED',
      queueNum: 1,
      room: room102,
      queueId: queue102Id,
      minutesAgo: 5,
      calledAgo: 1,
    },

    // Phòng Chẩn đoán hình ảnh 501: 1 ca đang chụp X-quang
    room501 && {
      cccd: '001094077662',
      token: `pt_dang_${dayStr}`,
      name: 'Phan Hải Đăng',
      dob: '1994-12-05',
      symptom: 'Chụp X-quang ngực thẳng theo chỉ định của BS Minh Khang',
      priority: 'NORMAL',
      taskType: 'DIAGNOSTIC_SERVICE',
      serviceType: 'XRAY',
      queueStatus: 'IN_SERVICE',
      entryStatus: 'IN_SERVICE',
      queueNum: 1,
      room: room501,
      queueId: queue501Id,
      minutesAgo: 7,
      calledAgo: 3,
    },

    // Phòng Nhi 301: 1 ca chờ khám
    room301 && {
      cccd: '001201066553',
      token: `pt_huy_${dayStr}`,
      name: 'Nguyễn Gia Huy (Bé 3 tuổi)',
      dob: '2023-08-10',
      symptom: 'Sốt nhẹ 38°C, ho đêm và thở khò khè',
      priority: 'NORMAL',
      taskType: 'INITIAL_CONSULT',
      queueStatus: 'WAITING',
      entryStatus: 'WAITING',
      queueNum: 1,
      room: room301,
      queueId: queue301Id,
      minutesAgo: 11,
    },
  ].filter(Boolean);

  for (const c of liveQueueList) {
    const enqueuedAt = new Date(now.getTime() - c.minutesAgo * 60000);
    const calledAt = c.calledAgo ? new Date(now.getTime() - c.calledAgo * 60000) : null;
    const jId = `VIS-${dayStr}-${c.room.code || 'RM'}-${c.queueNum.toString().padStart(2, '0')}`;
    const tId = `TASK-${dayStr}-${c.token}`;

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

    await prisma.patientJourney.upsert({
      where: { id: jId },
      create: {
        id: jId,
        patientToken: patient.patientToken,
        checkinAt: enqueuedAt,
        initialRoomId: c.room.id,
        currentRoomId: c.room.id,
        queueStatus: c.queueStatus,
        symptomDescription: c.symptom,
        severityScore: c.priority === 'EMERGENCY' ? 90 : c.priority === 'URGENT' ? 50 : 20,
      },
      update: {
        queueStatus: c.queueStatus,
        symptomDescription: c.symptom,
        initialRoomId: c.room.id,
        currentRoomId: c.room.id,
      },
    });

    const task = await prisma.patientJourneyTask.upsert({
      where: { id: tId },
      create: {
        id: tId,
        journeyId: jId,
        journeyStep: c.taskType === 'RETURN_REVIEW' ? 'RETURN_REVIEW' : c.taskType === 'DIAGNOSTIC_SERVICE' ? 'DIAGNOSTIC_SERVICE' : 'INITIAL_CONSULT',
        patientToken: patient.patientToken,
        departmentId: c.room.specialty?.departmentId,
        specialtyId: c.room.specialtyId,
        queueId: c.queueId,
        roomId: c.room.id,
        taskType: c.taskType,
        status: c.entryStatus === 'CALLED' ? 'READY' : c.entryStatus === 'IN_SERVICE' ? 'IN_SERVICE' : 'IN_QUEUE',
        serviceType: c.serviceType || (c.taskType === 'RETURN_REVIEW' ? 'RESULT_REVIEW' : 'CLINICAL_CONSULT'),
        clinicalPriority: c.priority,
        readinessStatus: 'COMPLETED',
        assignedAt: enqueuedAt,
        arrivalTime: enqueuedAt,
        readyAt: enqueuedAt,
        serviceStart: calledAt,
        resultReadyAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        completedAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        actualWaitTime: c.calledAgo ? c.minutesAgo - c.calledAgo : c.minutesAgo,
        resultDelayMinutes: c.minutesAgo > 15 ? c.minutesAgo - 15 : 0,
        sequenceOrder: c.queueNum,
      },
      update: {
        status: c.entryStatus === 'CALLED' ? 'READY' : c.entryStatus === 'IN_SERVICE' ? 'IN_SERVICE' : 'IN_QUEUE',
        actualWaitTime: c.calledAgo ? c.minutesAgo - c.calledAgo : c.minutesAgo,
        resultDelayMinutes: c.minutesAgo > 15 ? c.minutesAgo - 15 : 0,
        readyAt: enqueuedAt,
        serviceStart: calledAt,
        resultReadyAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
        completedAt: c.isReview ? new Date(now.getTime() - 8 * 60000) : null,
      },
    });

    await prisma.patientQueueEntry.upsert({
      where: { taskId_queueId: { taskId: task.id, queueId: c.queueId } },
      create: {
        id: `entry-${task.id}`,
        queueId: c.queueId,
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

  // 6. Tạo 2 lượt check-in mới tại bàn Tiếp nhận (Reception)
  console.log('📋 Đang tạo 2 lượt tiếp nhận mới tại Bàn tiếp đón...');
  const newIntakes = [
    { cccd: '001096001122', name: 'Vương Đình Khang', symptom: 'Đau mỏi cổ gáy, muốn khám Cơ xương khớp', token: `pt_khang_${dayStr}` },
    { cccd: '001197002233', name: 'Đặng Ngọc Ánh', symptom: 'Đau mắt đỏ, cộm ngứa mắt trái 2 ngày', token: `pt_anh_${dayStr}` },
  ];

  for (let idx = 0; idx < newIntakes.length; idx++) {
    const intake = newIntakes[idx];
    const pat = await prisma.patient.upsert({
      where: { identificationCode: intake.cccd },
      create: {
        identificationCode: intake.cccd,
        patientToken: intake.token,
        fullName: intake.name,
        dateOfBirth: new Date('1997-03-20'),
        status: 'ACTIVE',
      },
      update: { fullName: intake.name },
    });

    const jId = `VIS-${dayStr}-REC-0${idx + 1}`;
    await prisma.patientJourney.upsert({
      where: { id: jId },
      create: {
        id: jId,
        patientToken: pat.patientToken,
        checkinAt: new Date(now.getTime() - (idx + 1) * 3 * 60000),
        queueStatus: 'CHECKED_IN',
        symptomDescription: intake.symptom,
        severityScore: 10,
      },
      update: {
        queueStatus: 'CHECKED_IN',
        symptomDescription: intake.symptom,
      },
    });
  }

  console.log('🎉 THÀNH CÔNG! Toàn bộ dữ liệu hôm qua đã được lưu vết thành lịch sử hoàn tất, và dữ liệu hôm nay (13/09/2026) đã được nạp đầy đủ, trực quan và sống động!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

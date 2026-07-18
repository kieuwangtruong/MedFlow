const fs = require('node:fs');
const path = require('node:path');

const { Prisma, PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ quiet: true });

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const datasetPaths = {
  departments: path.join(repositoryRoot, 'ai', 'process_input_data', 'data', 'departments.csv'),
  journeyTasks: path.join(
    repositoryRoot,
    'ai',
    'wait_time_module',
    'data',
    'examples',
    'sample_20.csv',
  ),
  checkinSlots: path.join(
    repositoryRoot,
    'ai',
    'peak_hour_prediction',
    'data',
    'checkin_slots_12_months_2025_07_to_2026_06.csv',
  ),
};

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [rawHeaders, ...dataRows] = rows;
  if (!rawHeaders) return [];

  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '') : header,
  );

  return dataRows
    .filter((values) => values.some((value) => value !== ''))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
    );
}

function loadCsv(filePath, requiredColumns) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const columns = new Set(Object.keys(rows[0] || {}));
  const missingColumns = requiredColumns.filter((column) => !columns.has(column));

  if (missingColumns.length > 0) {
    throw new Error(`${path.basename(filePath)} is missing columns: ${missingColumns.join(', ')}`);
  }

  return rows;
}

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1';
}

function parseNullableNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${value}`);
  return parsed;
}

function parseInstant(value) {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+(?=[+-]\d{2}:\d{2}$)/, '$1');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid timestamp: ${value}`);
  return parsed;
}

function parseWallClock(value) {
  if (!value) return null;
  const parsed = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid wall-clock timestamp: ${value}`);
  return parsed;
}

function parseDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

function loadDatasets() {
  const departments = loadCsv(datasetPaths.departments, [
    'department_code',
    'department_name',
    'is_active',
  ]);
  const journeyTasks = loadCsv(datasetPaths.journeyTasks, [
    'journey_id',
    'journey_step',
    'task_id',
    'patient_token',
    'queue_id',
    'task_type',
    'service_type',
  ]);
  const checkinSlots = loadCsv(datasetPaths.checkinSlots, [
    'checkin_time',
    'date',
    'slot_start',
    'slot_index',
    'checkin_count',
  ]);

  return { departments, journeyTasks, checkinSlots };
}

function buildSeedData() {
  const datasets = loadDatasets();
  const patientTokens = [...new Set(datasets.journeyTasks.map((row) => row.patient_token))];
  const journeyIds = [...new Set(datasets.journeyTasks.map((row) => row.journey_id))];
  const taskIds = new Set(datasets.journeyTasks.map((row) => row.task_id));
  const queueServiceTypes = new Map();

  for (const row of datasets.journeyTasks) {
    if (row.parent_task_id && !taskIds.has(row.parent_task_id)) {
      throw new Error(`Task ${row.task_id} references missing parent ${row.parent_task_id}`);
    }
    if (row.depends_on_task_id && !taskIds.has(row.depends_on_task_id)) {
      throw new Error(`Task ${row.task_id} references missing dependency ${row.depends_on_task_id}`);
    }

    const serviceTypes = queueServiceTypes.get(row.queue_id) || new Set();
    serviceTypes.add(row.service_type);
    queueServiceTypes.set(row.queue_id, serviceTypes);
  }

  const queues = [...queueServiceTypes.entries()].map(([id, serviceTypes]) => ({
    id,
    name: id,
    serviceType: serviceTypes.size === 1 ? [...serviceTypes][0] : null,
  }));
  const sequenceByJourney = new Map();
  const queueRows = new Map();

  for (const row of datasets.journeyTasks) {
    const sequence = sequenceByJourney.get(row.journey_id) || 0;
    row.sequence_order = sequence;
    sequenceByJourney.set(row.journey_id, sequence + 1);

    const rows = queueRows.get(row.queue_id) || [];
    rows.push(row);
    queueRows.set(row.queue_id, rows);
  }

  const queueNumberByTask = new Map();
  for (const rows of queueRows.values()) {
    rows
      .slice()
      .sort((left, right) => parseInstant(left.ready_at) - parseInstant(right.ready_at))
      .forEach((row, index) => queueNumberByTask.set(row.task_id, index + 1));
  }

  return {
    ...datasets,
    patientTokens,
    journeyIds,
    queues,
    queueNumberByTask,
  };
}

async function upsertCheckinSlots(prisma, rows) {
  const batchSize = 500;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const values = rows.slice(offset, offset + batchSize).map((row) =>
      Prisma.sql`(
        ${parseWallClock(row.checkin_time)},
        ${parseDate(row.date)},
        ${row.slot_start},
        ${Number(row.slot_index)},
        ${Number(row.day_of_week)},
        ${row.day_name},
        ${Number(row.month)},
        ${parseBoolean(row.is_weekend)},
        ${Number(row.checkin_count)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )`,
    );

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "checkin_slot_statistics" (
        "checkin_time", "date", "slot_start", "slot_index", "day_of_week",
        "day_name", "month", "is_weekend", "checkin_count", "created_at", "updated_at"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("checkin_time") DO UPDATE SET
        "date" = EXCLUDED."date",
        "slot_start" = EXCLUDED."slot_start",
        "slot_index" = EXCLUDED."slot_index",
        "day_of_week" = EXCLUDED."day_of_week",
        "day_name" = EXCLUDED."day_name",
        "month" = EXCLUDED."month",
        "is_weekend" = EXCLUDED."is_weekend",
        "checkin_count" = EXCLUDED."checkin_count",
        "updated_at" = CURRENT_TIMESTAMP
    `);
  }
}

async function seedDatabase(seedData) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the database');

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const row of seedData.departments) {
      await prisma.department.upsert({
        where: { id: row.department_code },
        create: {
          id: row.department_code,
          code: row.department_code,
          name: row.department_name,
          isActive: parseBoolean(row.is_active),
        },
        update: {
          code: row.department_code,
          name: row.department_name,
          isActive: parseBoolean(row.is_active),
        },
      });
    }

    for (const queue of seedData.queues) {
      await prisma.serviceQueue.upsert({
        where: { id: queue.id },
        create: { ...queue, isActive: true },
        update: { name: queue.name, serviceType: queue.serviceType, isActive: true },
      });
    }

    for (const patientToken of seedData.patientTokens) {
      await prisma.patient.upsert({
        where: { patientToken },
        create: {
          identificationCode: `VAIC-${patientToken}`,
          patientToken,
        },
        update: {
          identificationCode: `VAIC-${patientToken}`,
          status: 'ACTIVE',
        },
      });
    }

    for (const journeyId of seedData.journeyIds) {
      const patientToken = seedData.journeyTasks.find((row) => row.journey_id === journeyId).patient_token;
      await prisma.patientJourney.upsert({
        where: { id: journeyId },
        create: { id: journeyId, patientToken },
        update: { patientToken },
      });
    }

    for (const row of seedData.journeyTasks) {
      const readinessStatus = row.readiness_status || null;
      const status = readinessStatus === 'RESULT_PENDING' ? 'WAITING_RESULT' : 'COMPLETED';
      const serviceEnd = parseInstant(row.service_end);
      const task = {
        journeyId: row.journey_id,
        journeyStep: row.journey_step,
        sourceDependsOnTaskId: row.depends_on_task_id || null,
        patientToken: row.patient_token,
        queueId: row.queue_id || null,
        taskType: row.task_type,
        status,
        serviceType: row.service_type,
        clinicalPriority: row.clinical_priority || 'NORMAL',
        readinessStatus,
        schedulingMode: row.scheduling_mode || null,
        doctorId: row.doctor_id || null,
        deviceId: row.device_id || null,
        arrivalTime: parseInstant(row.arrival_time),
        readyAt: parseInstant(row.ready_at),
        serviceStart: parseInstant(row.service_start),
        serviceEnd,
        completedAt: status === 'COMPLETED' ? serviceEnd : null,
        resultReadyAt: parseInstant(row.result_ready_at),
        resultUrgency: row.result_urgency || null,
        resultDelayMinutes: parseNullableNumber(row.result_delay_minutes),
        returnTiming: row.return_timing || null,
        scheduleWindowStart: parseInstant(row.schedule_window_start),
        scheduleWindowEnd: parseInstant(row.schedule_window_end),
        sequenceOrder: row.sequence_order,
        queueLength: parseNullableNumber(row.queue_length),
        arrivalRate15m: parseNullableNumber(row.arrival_rate_15m),
        avgService30m: parseNullableNumber(row.avg_service_30m),
        resourceStatus: row.resource_status || null,
        resourceFailure: parseBoolean(row.resource_failure),
        doctorPause: parseBoolean(row.doctor_pause),
        caseComplexity: row.case_complexity || null,
        activeServiceDuration: parseNullableNumber(row.active_service_duration),
        interruptionDuration: parseNullableNumber(row.interruption_duration),
        elapsedServiceDuration: parseNullableNumber(row.elapsed_service_duration),
        actualWaitTime: parseNullableNumber(row.actual_wait_time),
        noShow: parseBoolean(row.no_show),
        emergencyInsertion: parseBoolean(row.emergency_insertion),
        recentEmergencyCount: parseNullableNumber(row.recent_emergency_count) || 0,
      };

      await prisma.patientJourneyTask.upsert({
        where: { id: row.task_id },
        create: { id: row.task_id, parentTaskId: null, ...task },
        update: task,
      });
    }

    for (const row of seedData.journeyTasks) {
      await prisma.patientJourneyTask.update({
        where: { id: row.task_id },
        data: { parentTaskId: row.parent_task_id || null },
      });

      if (row.depends_on_task_id) {
        await prisma.patientTaskDependency.upsert({
          where: {
            taskId_dependsOnTaskId: {
              taskId: row.task_id,
              dependsOnTaskId: row.depends_on_task_id,
            },
          },
          create: {
            taskId: row.task_id,
            dependsOnTaskId: row.depends_on_task_id,
          },
          update: {},
        });
      }

      await prisma.patientQueueEntry.upsert({
        where: {
          taskId_queueId: {
            taskId: row.task_id,
            queueId: row.queue_id,
          },
        },
        create: {
          id: `seed-${row.task_id}-${row.queue_id}`,
          queueId: row.queue_id,
          taskId: row.task_id,
          status: parseBoolean(row.no_show) ? 'NO_SHOW' : 'DONE',
          priority: row.clinical_priority || 'NORMAL',
          queueNumber: seedData.queueNumberByTask.get(row.task_id),
          enqueuedAt: parseInstant(row.ready_at) || parseInstant(row.arrival_time),
          calledAt: parseInstant(row.service_start),
          serviceStartAt: parseInstant(row.service_start),
          serviceEndAt: parseInstant(row.service_end),
        },
        update: {
          status: parseBoolean(row.no_show) ? 'NO_SHOW' : 'DONE',
          priority: row.clinical_priority || 'NORMAL',
          queueNumber: seedData.queueNumberByTask.get(row.task_id),
          enqueuedAt: parseInstant(row.ready_at) || parseInstant(row.arrival_time),
          calledAt: parseInstant(row.service_start),
          serviceStartAt: parseInstant(row.service_start),
          serviceEndAt: parseInstant(row.service_end),
        },
      });
    }

    await upsertCheckinSlots(prisma, seedData.checkinSlots);

    return {
      departments: await prisma.department.count(),
      serviceQueues: await prisma.serviceQueue.count(),
      patients: await prisma.patient.count(),
      journeys: await prisma.patientJourney.count(),
      journeyTasks: await prisma.patientJourneyTask.count(),
      taskDependencies: await prisma.patientTaskDependency.count(),
      queueEntries: await prisma.patientQueueEntry.count(),
      checkinSlots: await prisma.checkinSlotStatistic.count(),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const seedData = buildSeedData();
  const sourceSummary = {
    departments: seedData.departments.length,
    serviceQueues: seedData.queues.length,
    patients: seedData.patientTokens.length,
    journeys: seedData.journeyIds.length,
    journeyTasks: seedData.journeyTasks.length,
    taskDependencies: seedData.journeyTasks.filter((row) => row.depends_on_task_id).length,
    queueEntries: seedData.journeyTasks.length,
    checkinSlots: seedData.checkinSlots.length,
  };

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, sourceSummary }, null, 2));
    return;
  }

  const databaseCounts = await seedDatabase(seedData);
  console.log(JSON.stringify({ dryRun: false, sourceSummary, databaseCounts }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

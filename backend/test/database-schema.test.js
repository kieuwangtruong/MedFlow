const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = path.join('prisma', 'schema.prisma');
const testDatabaseUrl = 'postgresql://user:password@localhost:5432/vaic_2026_schema_test';

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || testDatabaseUrl,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
  });

  assert.equal(result.status, 0, `Prisma command failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

test('Prisma schema is valid', () => {
  runPrisma(['validate', '--schema', schemaPath]);
});

test('Prisma Client initializes with the PostgreSQL driver adapter', async () => {
  process.env.DATABASE_URL ||= testDatabaseUrl;
  const prisma = require('../src/config/database');

  assert.equal(typeof prisma.$connect, 'function');
  assert.equal(typeof prisma.$disconnect, 'function');
  await prisma.$disconnect();
});

test('seed datasets parse and satisfy their source contract', () => {
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'prisma', 'seed.js'), '--dry-run'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.sourceSummary, {
    departments: 15,
    serviceQueues: 3,
    patients: 6,
    journeys: 5,
    journeyTasks: 20,
    taskDependencies: 15,
    queueEntries: 20,
    checkinSlots: 7300,
  });
});

test('migration SQL contains the documented VAIC module tables and constraints', () => {
  const sql = runPrisma([
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema',
    schemaPath,
    '--script',
  ]);

  const expectedTables = [
    'staff_users',
    'patients',
    'departments',
    'clinical_specialties',
    'clinic_rooms',
    'doctor_room_assignments',
    'service_queues',
    'patient_journeys',
    'patient_journey_tasks',
    'patient_task_dependencies',
    'patient_queue_entries',
    'checkin_slot_statistics',
  ];

  for (const table of expectedTables) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  }

  const expectedUniqueConstraints = [
    'staff_users_username_key',
    'patients_identification_code_key',
    'patients_patient_token_key',
    'clinical_specialties_department_id_name_key',
    'clinic_rooms_specialty_id_name_key',
    'doctor_room_assignments_doctor_id_room_id_shift_start_key',
    'patient_task_dependencies_task_id_depends_on_task_id_key',
    'patient_queue_entries_task_id_queue_id_key',
    'checkin_slot_statistics_checkin_time_key',
    'checkin_slot_statistics_date_slot_index_key',
  ];

  for (const constraint of expectedUniqueConstraints) {
    assert.match(sql, new RegExp(`"${constraint}"`));
  }

  assert.match(sql, /ALTER TABLE "patient_journeys"[\s\S]+FOREIGN KEY \("patient_token"\)/);
  assert.match(sql, /ALTER TABLE "clinic_rooms"[\s\S]+FOREIGN KEY \("doctor_id"\)/);
  assert.match(sql, /ALTER TABLE "doctor_room_assignments"[\s\S]+FOREIGN KEY \("doctor_id"\)/);
  assert.match(sql, /ALTER TABLE "doctor_room_assignments"[\s\S]+FOREIGN KEY \("room_id"\)/);
  assert.match(sql, /ALTER TABLE "patient_journey_tasks"[\s\S]+FOREIGN KEY \("journey_id"\)/);
  assert.match(sql, /ALTER TABLE "patient_task_dependencies"[\s\S]+FOREIGN KEY \("depends_on_task_id"\)/);
  assert.match(sql, /ALTER TABLE "patient_queue_entries"[\s\S]+FOREIGN KEY \("queue_id"\)/);
});

test('shift assignment migration enforces one active room per doctor and room', () => {
  const migrationPath = path.join(
    projectRoot,
    'prisma',
    'migrations',
    '20260721190000_add_doctor_room_shift_assignments',
    'migration.sql',
  );
  const sql = require('node:fs').readFileSync(migrationPath, 'utf8');

  assert.match(sql, /doctor_room_assignments_valid_shift_check/);
  assert.match(sql, /one_active_room_per_doctor_idx/);
  assert.match(sql, /one_active_doctor_per_room_idx/);
});

test('patient intake migration persists symptoms and intake source', () => {
  const migrationPath = path.join(
    projectRoot,
    'prisma',
    'migrations',
    '20260723090000_add_patient_intake_data',
    'migration.sql',
  );
  const sql = require('node:fs').readFileSync(migrationPath, 'utf8');

  assert.match(sql, /symptom_description/);
  assert.match(sql, /symptom_payload/);
  assert.match(sql, /symptoms_submitted_at/);
  assert.match(sql, /intake_source/);
});

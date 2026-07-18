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
    'patient_task_dependencies_task_id_depends_on_task_id_key',
    'patient_queue_entries_task_id_queue_id_key',
    'checkin_slot_statistics_checkin_time_key',
    'checkin_slot_statistics_date_slot_index_key',
  ];

  for (const constraint of expectedUniqueConstraints) {
    assert.match(sql, new RegExp(`"${constraint}"`));
  }

  assert.match(sql, /ALTER TABLE "patient_journeys"[\s\S]+FOREIGN KEY \("patient_token"\)/);
  assert.match(sql, /ALTER TABLE "patient_journey_tasks"[\s\S]+FOREIGN KEY \("journey_id"\)/);
  assert.match(sql, /ALTER TABLE "patient_task_dependencies"[\s\S]+FOREIGN KEY \("depends_on_task_id"\)/);
  assert.match(sql, /ALTER TABLE "patient_queue_entries"[\s\S]+FOREIGN KEY \("queue_id"\)/);
});

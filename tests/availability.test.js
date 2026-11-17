const test = require('node:test');
const assert = require('node:assert/strict');
const { toSingapore, isCovered, findUnavailable, isTemplateCovered, findUnavailableForTemplate } = require('../services/availability');

// 2026-11-16 is a Monday. Singapore is UTC+8, so Monday 18:00 SGT is Monday 10:00 UTC.
const MON_1800 = '2026-11-16T10:00:00Z';
const MON_1930 = '2026-11-16T11:30:00Z';
const slot = (weekday, start, end) => ({ weekday, start_minute: start, end_minute: end });

test('converts to Singapore weekday (0 = Monday) and minute', () => {
  assert.equal(toSingapore(MON_1800).weekday, 0);
  assert.equal(toSingapore(MON_1800).minute, 18 * 60);
  // 17:00 UTC on Sunday is already Monday 01:00 in Singapore
  const t = toSingapore('2026-11-15T17:00:00Z');
  assert.equal(t.weekday, 0);
  assert.equal(t.minute, 60);
});

test('class inside a slot is covered', () => {
  assert.equal(isCovered([slot(0, 17 * 60, 20 * 60)], MON_1800, MON_1930), true);
});

test('wrong weekday is not covered', () => {
  assert.equal(isCovered([slot(1, 17 * 60, 20 * 60)], MON_1800, MON_1930), false);
});

test('class starting before the slot, or ending after it, is not covered', () => {
  assert.equal(isCovered([slot(0, 18 * 60 + 30, 20 * 60)], MON_1800, MON_1930), false);
  assert.equal(isCovered([slot(0, 17 * 60, 19 * 60)], MON_1800, MON_1930), false);
});

test('class across two back-to-back slots is covered', () => {
  assert.equal(isCovered([slot(0, 18 * 60, 19 * 60), slot(0, 19 * 60, 20 * 60)], MON_1800, MON_1930), true);
});

test('a gap between slots is not covered', () => {
  assert.equal(isCovered([slot(0, 18 * 60, 18 * 60 + 30), slot(0, 19 * 60, 20 * 60)], MON_1800, MON_1930), false);
});

test('late-evening class in Singapore uses the Singapore day, not the UTC day', () => {
  // Sunday 23:00-23:59 SGT = Sunday 15:00-15:59 UTC
  assert.equal(isCovered([slot(6, 22 * 60, 24 * 60)], '2026-11-15T15:00:00Z', '2026-11-15T15:59:00Z'), true);
});

test('an instructor with no saved availability is not restricted', async () => {
  const Instructor = { listAvailability: async () => [], findById: async () => ({ name: 'Sensei A' }) };
  assert.deepEqual(await findUnavailable(['a'], MON_1800, MON_1930, Instructor), []);
});

test('findUnavailable names the instructors who are not free', async () => {
  const slots = { a: [slot(0, 17 * 60, 20 * 60)], b: [slot(3, 17 * 60, 20 * 60)] };
  const Instructor = {
    listAvailability: async (id) => slots[id],
    findById: async (id) => ({ name: id === 'b' ? 'Sensei B' : 'Sensei A' }),
  };
  assert.deepEqual(await findUnavailable(['a', 'b'], MON_1800, MON_1930, Instructor), [
    { instructor_id: 'b', name: 'Sensei B' },
  ]);
});

test('a weekly template inside the instructor slot is covered', () => {
  assert.equal(isTemplateCovered([slot(0, 17 * 60, 20 * 60)], 0, 18 * 60 + 30, 19 * 60 + 30), true);
});

test('a weekly template on another weekday or starting too early is not covered', () => {
  assert.equal(isTemplateCovered([slot(0, 17 * 60, 20 * 60)], 1, 18 * 60 + 30, 19 * 60 + 30), false);
  assert.equal(isTemplateCovered([slot(0, 17 * 60, 20 * 60)], 0, 16 * 60 + 30, 18 * 60), false);
});

test('findUnavailableForTemplate names the instructors who are not free', async () => {
  const slots = { a: [slot(0, 17 * 60, 20 * 60)], b: [slot(3, 17 * 60, 20 * 60)] };
  const Instructor = {
    listAvailability: async (id) => slots[id],
    findById: async (id) => ({ name: id === 'b' ? 'Sensei B' : 'Sensei A' }),
  };
  assert.deepEqual(await findUnavailableForTemplate(['a', 'b'], 0, 18 * 60, 19 * 60, Instructor), [
    { instructor_id: 'b', name: 'Sensei B' },
  ]);
});
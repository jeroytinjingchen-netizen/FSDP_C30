// Tests for model/centreModel.js using a stand-in pool (no database).
const test = require('node:test');
const assert = require('node:assert');

const calls = [];
let nextRows = [];
let nextRowCount = 1;
const dbPath = require.resolve('../dbConfig');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => { calls.push({ sql, params }); return { rows: nextRows, rowCount: nextRowCount }; } },
};
const Centre = require('../model/centreModel');
const reset = (rows = [], rowCount = 1) => { calls.length = 0; nextRows = rows; nextRowCount = rowCount; };

test('list hides archived centres by default', async () => {
  reset([]);
  await Centre.list(false);
  assert.match(calls[0].sql, /WHERE c\.is_active/);
});

test('list(true) includes archived centres', async () => {
  reset([]);
  await Centre.list(true);
  assert.doesNotMatch(calls[0].sql, /WHERE c\.is_active/);
});

test('the centre query builds the schedule from class_templates', async () => {
  reset([]);
  await Centre.list(false);
  assert.match(calls[0].sql, /FROM class_templates t WHERE t\.centre_id = c\.id/);
});

test('create stores empty email and phone as NULL', async () => {
  reset([{ id: 'c1' }]);
  await Centre.create({ name: 'A', address: 'B', email: '', phone: '' });
  assert.deepStrictEqual(calls[0].params, ['A', 'B', null, null]);
});

test('update returns null when the centre does not exist', async () => {
  reset([], 0);
  assert.strictEqual(await Centre.update('x', { name: 'A', address: 'B' }), null);
});

test('setActive archives and restores with the right flag', async () => {
  reset([{ id: 'c1' }], 1);
  await Centre.setActive('c1', false);
  assert.deepStrictEqual(calls[0].params, ['c1', false]);
});

test('countStudents returns null for an unknown centre and the count otherwise', async () => {
  reset([]);
  assert.strictEqual(await Centre.countStudents('x'), null);
  reset([{ n: 4 }]);
  assert.strictEqual(await Centre.countStudents('c1'), 4);
});
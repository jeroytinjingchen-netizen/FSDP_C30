// Tests for model/classModel.js. The database is replaced by a stand-in pool
// that records every SQL call, so no real database is needed.
const test = require('node:test');
const assert = require('node:assert');

const calls = [];
let nextRows = [];
let nextRowCount = 1;

// Put the stand-in in require's cache BEFORE the model loads dbConfig.
const dbPath = require.resolve('../dbConfig');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: nextRows, rowCount: nextRowCount };
    },
  },
};
const Class = require('../model/classModel');

function reset(rows = [], rowCount = 1) {
  calls.length = 0;
  nextRows = rows;
  nextRowCount = rowCount;
}

test('list passes the centre id as the only parameter', async () => {
  reset([{ id: 'c1' }]);
  const out = await Class.list('centre-1');
  assert.deepStrictEqual(out, [{ id: 'c1' }]);
  assert.deepStrictEqual(calls[0].params, ['centre-1']);
});

test('list with null means all centres (null is passed, not undefined)', async () => {
  reset([]);
  await Class.list(null);
  assert.deepStrictEqual(calls[0].params, [null]);
  assert.match(calls[0].sql, /\$1::uuid IS NULL/);
});

test('findById returns null when no row matches', async () => {
  reset([]);
  assert.strictEqual(await Class.findById('missing'), null);
});

test('create inserts the five fields in order, then re-reads the new row', async () => {
  reset([{ id: 'new-id', name: 'Beginners' }]);
  const out = await Class.create({
    centre_id: 'c1', name: 'Beginners', weekday: 5, start_minute: 600, end_minute: 660,
  });
  assert.strictEqual(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO class_templates/);
  assert.deepStrictEqual(calls[0].params, ['c1', 'Beginners', 5, 600, 660]);
  assert.deepStrictEqual(calls[1].params, ['new-id']);
  assert.strictEqual(out.name, 'Beginners');
});

test('update returns null when the class does not exist (rowCount 0)', async () => {
  reset([], 0);
  const out = await Class.update('nope', {
    centre_id: 'c1', name: 'x', weekday: 0, start_minute: 0, end_minute: 60,
  });
  assert.strictEqual(out, null);
  assert.strictEqual(calls.length, 1); // no re-read when nothing changed
});

test('update does not touch the instructor column', async () => {
  reset([{ id: 'a' }], 1);
  await Class.update('a', { centre_id: 'c1', name: 'x', weekday: 0, start_minute: 0, end_minute: 60 });
  assert.doesNotMatch(calls[0].sql, /instructor_id/);
});

test('remove returns true when a row was deleted and false when not', async () => {
  reset([], 1);
  assert.strictEqual(await Class.remove('a'), true);
  reset([], 0);
  assert.strictEqual(await Class.remove('b'), false);
});

test('setInstructor with null removes the instructor', async () => {
  reset([{ id: 'a', instructor_id: null }], 1);
  const out = await Class.setInstructor('a', null);
  assert.deepStrictEqual(calls[0].params, ['a', null]);
  assert.strictEqual(out.instructor_id, null);
});

test('setInstructor returns null for an unknown class', async () => {
  reset([], 0);
  assert.strictEqual(await Class.setInstructor('nope', 'i1'), null);
});

test('listByInstructor filters on the instructor id', async () => {
  reset([{ id: 'a' }]);
  await Class.listByInstructor('i1');
  assert.deepStrictEqual(calls[0].params, ['i1']);
  assert.match(calls[0].sql, /t\.instructor_id = \$1/);
});
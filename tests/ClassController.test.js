// Tests for controllers/classController.js: validation and error mapping.
// The model is replaced method by method, so no database is needed.
const test = require('node:test');
const assert = require('node:assert');

const Class = require('../model/classModel');
const ctrl = require('../controllers/classController');

const UUID = '3f2b1c9e-8a4d-4e7b-9c1a-2d5e6f7a8b9c';
const valid = { centre_id: UUID, name: 'Saturday Adults', weekday: 5, start_minute: 600, end_minute: 660 };

// A minimal response object that records status and body.
function fakeRes() {
  return {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

// Replace model methods for one test, then restore them.
function stub(t, methods) {
  for (const [name, fn] of Object.entries(methods)) {
    const original = Class[name];
    Class[name] = fn;
    t.after(() => { Class[name] = original; });
  }
}
// Silence expected console.error output from the 500 paths.
function quiet(t) {
  const orig = console.error;
  console.error = () => {};
  t.after(() => { console.error = orig; });
}

test('create: end time before start time gives 400 and never reaches the model', async (t) => {
  let called = false;
  stub(t, { create: async () => { called = true; } });
  const res = fakeRes();
  await ctrl.create({ body: { ...valid, start_minute: 660, end_minute: 600 } }, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(called, false);
});

test('create: end equal to start is rejected', async (t) => {
  stub(t, { create: async () => ({}) });
  const res = fakeRes();
  await ctrl.create({ body: { ...valid, start_minute: 600, end_minute: 600 } }, res);
  assert.strictEqual(res.statusCode, 400);
});

test('create: weekday 7 and a non-UUID centre are rejected', async (t) => {
  stub(t, { create: async () => ({}) });
  let res = fakeRes();
  await ctrl.create({ body: { ...valid, weekday: 7 } }, res);
  assert.strictEqual(res.statusCode, 400);
  res = fakeRes();
  await ctrl.create({ body: { ...valid, centre_id: 'not-a-uuid' } }, res);
  assert.strictEqual(res.statusCode, 400);
});

test('create: a blank name is rejected', async (t) => {
  stub(t, { create: async () => ({}) });
  const res = fakeRes();
  await ctrl.create({ body: { ...valid, name: '   ' } }, res);
  assert.strictEqual(res.statusCode, 400);
});

test('create: valid body returns 201 with the created class', async (t) => {
  stub(t, { create: async (v) => ({ id: 'new', ...v }) });
  const res = fakeRes();
  await ctrl.create({ body: valid }, res);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.id, 'new');
});

test('create: foreign key error 23503 becomes 400 "Centre not found."', async (t) => {
  stub(t, { create: async () => { const e = new Error('fk'); e.code = '23503'; throw e; } });
  const res = fakeRes();
  await ctrl.create({ body: valid }, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'Centre not found.');
});

test('create: an unexpected error becomes a generic 500', async (t) => {
  quiet(t);
  stub(t, { create: async () => { throw new Error('boom'); } });
  const res = fakeRes();
  await ctrl.create({ body: valid }, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'Failed to create class.');
});

test('update: unknown id gives 404', async (t) => {
  stub(t, { update: async () => null });
  const res = fakeRes();
  await ctrl.update({ params: { id: UUID }, body: valid }, res);
  assert.strictEqual(res.statusCode, 404);
});

test('update: an id that is not a UUID (22P02) gives 404, not 500', async (t) => {
  stub(t, { update: async () => { const e = new Error('bad uuid'); e.code = '22P02'; throw e; } });
  const res = fakeRes();
  await ctrl.update({ params: { id: 'abc' }, body: valid }, res);
  assert.strictEqual(res.statusCode, 404);
});

test('remove: success, not found and bad id', async (t) => {
  stub(t, { remove: async () => true });
  let res = fakeRes();
  await ctrl.remove({ params: { id: UUID } }, res);
  assert.strictEqual(res.body.message, 'Class removed.');

  stub(t, { remove: async () => false });
  res = fakeRes();
  await ctrl.remove({ params: { id: UUID } }, res);
  assert.strictEqual(res.statusCode, 404);

  stub(t, { remove: async () => { const e = new Error('x'); e.code = '22P02'; throw e; } });
  res = fakeRes();
  await ctrl.remove({ params: { id: 'abc' } }, res);
  assert.strictEqual(res.statusCode, 404);
});

test('assignInstructor: null removes the instructor and is passed to the model', async (t) => {
  let received;
  stub(t, { setInstructor: async (id, ins) => { received = ins; return { id, instructor_id: ins }; } });
  const res = fakeRes();
  await ctrl.assignInstructor({ params: { id: UUID }, body: { instructor_id: null } }, res);
  assert.strictEqual(received, null);
  assert.strictEqual(res.statusCode, 200);
});

test('assignInstructor: missing field, bad UUID, unknown class, unknown instructor', async (t) => {
  stub(t, { setInstructor: async () => ({}) });
  let res = fakeRes();
  await ctrl.assignInstructor({ params: { id: UUID }, body: {} }, res);
  assert.strictEqual(res.statusCode, 400); // instructor_id is required (null is allowed, undefined is not)

  res = fakeRes();
  await ctrl.assignInstructor({ params: { id: UUID }, body: { instructor_id: 'nope' } }, res);
  assert.strictEqual(res.statusCode, 400);

  stub(t, { setInstructor: async () => null });
  res = fakeRes();
  await ctrl.assignInstructor({ params: { id: UUID }, body: { instructor_id: UUID } }, res);
  assert.strictEqual(res.statusCode, 404);

  stub(t, { setInstructor: async () => { const e = new Error('fk'); e.code = '23503'; throw e; } });
  res = fakeRes();
  await ctrl.assignInstructor({ params: { id: UUID }, body: { instructor_id: UUID } }, res);
  assert.strictEqual(res.body.error, 'Instructor not found.');
});

test('list: passes req.centreId through and returns the rows', async (t) => {
  let got;
  stub(t, { list: async (c) => { got = c; return [{ id: 'a' }]; } });
  const res = fakeRes();
  await ctrl.list({ centreId: 'centre-9' }, res);
  assert.strictEqual(got, 'centre-9');
  assert.deepStrictEqual(res.body, [{ id: 'a' }]);
});
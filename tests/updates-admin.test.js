const test = require("node:test");
const assert = require("node:assert/strict");
const { makeUpdatesAdmin } = require("../services/updates-admin");

const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function fixture({ existing = null, taken = false } = {}) {
  const calls = { uploads: [], deletes: [], temp: [], creates: [], updates: [] };
  const deps = {
    uploadImage: async (path) => { calls.uploads.push(path); return { public_id: "new-img", url: "https://img/new" }; },
    deleteImage: async (publicId) => { calls.deletes.push(publicId); },
    removeTempFile: async (path) => { calls.temp.push(path); },
    Updates: {
      findOne: async () => (taken ? { _id: "other" } : null),
      findById: async () => existing,
      create: async (doc) => { calls.creates.push(doc); return { _id: id, ...doc }; },
      findByIdAndUpdate: async (_id, update) => { calls.updates.push(update.$set); return { ...existing, ...update.$set }; },
      findByIdAndDelete: async () => existing,
    },
  };
  return { admin: makeUpdatesAdmin(deps), calls };
}
const file = { thumbnail: [{ path: "uploads/x.png" }] };
const body = { title: "  Monsoon retreat ", description: "Three days of yoga", category: "events_retreats" };

test("create validates fields, requires an image, uploads it and cleans the temp file", async () => {
  const { admin, calls } = fixture();
  let res = response();
  await admin.create({ body: { ...body, category: "news" }, files: file }, res);
  assert.equal(res.statusCode, 400);
  res = response();
  await admin.create({ body }, res);
  assert.match(res.body.message, /Thumbnail/);
  res = response();
  await admin.create({ body, files: file }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(calls.creates[0].title, "Monsoon retreat");
  assert.equal(calls.creates[0].thumbnail.url, "https://img/new");
  assert.ok(calls.creates[0].updatedOn instanceof Date);
  assert.equal(calls.temp.length, 2, "temp upload removed whenever a file was sent");
});

test("duplicate titles are refused", async () => {
  const { admin, calls } = fixture({ taken: true });
  const res = response();
  await admin.create({ body, files: file }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(calls.uploads.length, 0);
});

test("edit keeps the old image unless a new one is uploaded, then deletes the old one", async () => {
  const existing = { _id: id, title: "Old", thumbnail: { public_id: "old-img", url: "https://img/old" } };
  let { admin, calls } = fixture({ existing });
  let res = response();
  await admin.edit({ params: { id }, body: { description: "New text" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].thumbnail, undefined);
  assert.equal(calls.updates[0].description, "New text");
  assert.equal(calls.deletes.length, 0);
  ({ admin, calls } = fixture({ existing }));
  res = response();
  await admin.edit({ params: { id }, body: {}, files: file }, res);
  assert.equal(calls.updates[0].thumbnail.public_id, "new-img");
  assert.deepEqual(calls.deletes, ["old-img"]);
});

test("delete removes the record and its image; unknown IDs 404", async () => {
  const { admin, calls } = fixture({ existing: { _id: id, thumbnail: { public_id: "old-img" } } });
  let res = response();
  await admin.remove({ params: { id } }, res);
  assert.equal(res.body.deletedId, id);
  assert.deepEqual(calls.deletes, ["old-img"]);
  const missing = fixture();
  res = response();
  await missing.admin.remove({ params: { id } }, res);
  assert.equal(res.statusCode, 404);
  res = response();
  await missing.admin.remove({ params: { id: "bad" } }, res);
  assert.equal(res.statusCode, 400);
});

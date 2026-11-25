// Local test for articles-api-worker.js. Run: node --test cloudflare/articles-api-worker.test.mjs
// Uses Node's built-in SQLite as a stand-in for D1 (same SQL engine) and a stand-in for
// the Supabase login, so it checks the Worker's own rules end to end.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker, { publishDue } from "./articles-api-worker.js";

class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(readFileSync(new URL("./articles-api.schema.sql", import.meta.url), "utf8"));
  }
  prepare(sql) {
    const db = this.db;
    const stmt = { sql, args: [] };
    stmt.bind = (...args) => ({ ...stmt, args });
    stmt.all = async function () {
      return { results: db.prepare(this.sql).all(...(this.args || [])) };
    };
    stmt.first = async function () {
      return db.prepare(this.sql).get(...(this.args || [])) ?? null;
    };
    stmt.run = async function () {
      return db.prepare(this.sql).run(...(this.args || []));
    };
    return stmt;
  }
  async batch(stmts) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }
}

// Supabase stand-in: admin-token = admin, writer-token = writer, user-token = plain member.
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const auth = init.headers?.Authorization || "";
  const ids = { "Bearer admin-token": "admin-1", "Bearer writer-token": "writer-1", "Bearer writer2-token": "writer-2", "Bearer user-token": "user-1" };
  if (url.includes("/auth/v1/user")) return ids[auth] ? Response.json({ id: ids[auth] }) : new Response("no", { status: 401 });
  if (url.includes("/rest/v1/user_roles")) {
    if (url.includes("admin-1")) return Response.json([{ role: "admin" }]);
    if (url.includes("writer-")) return Response.json([{ role: "writer" }]);
    return Response.json([]);
  }
  throw new Error(`unexpected fetch ${url}`);
};

const env = () => ({ DB: new FakeD1() });
const call = async (e, method, path, { token, body } = {}) => {
  const headers = { "content-type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(
    new Request(`https://articles-api.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    e,
  );
  return { status: res.status, body: await res.json(), headers: res.headers };
};

const article = (over = {}) => ({
  title: "Skubal's First Spring",
  slug: "skubals-first-spring",
  content: "<p>Hello Mets fans, it's a \"big\" day.</p>",
  excerpt: "Short summary",
  category: "Mets News",
  tags: ["Skubal", "Pitching"],
  ...over,
});

test("public lists show only published articles, newest first, with tags as a list", async () => {
  const e = env();
  await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ slug: "a", published: true, published_at: "2026-11-01T10:00:00Z" }) });
  await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ slug: "b", published: true, published_at: "2026-11-02T10:00:00Z" }) });
  await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ slug: "hidden", approval_status: "pending" }) });

  const list = await call(e, "GET", "/posts?limit=10");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.posts.map((p) => p.slug), ["b", "a"]);
  assert.deepEqual(list.body.posts[0].tags, ["Skubal", "Pitching"]);
  assert.equal(list.body.posts[0].published, true);
  assert.equal(list.body.posts[0].content, undefined, "cards leave out the article body");
  assert.match(list.headers.get("cache-control"), /max-age/);

  const one = await call(e, "GET", "/posts/b");
  assert.equal(one.body.post.content, article().content, "quotes and apostrophes survive");
  assert.equal((await call(e, "GET", "/posts/hidden")).status, 404, "pending article is not public");
  assert.equal((await call(e, "GET", "/posts/count")).body.count, 2);
  assert.equal((await call(e, "GET", "/posts/count?since=2026-11-02T00:00:00Z")).body.count, 1);
  assert.deepEqual((await call(e, "GET", "/posts?exclude=" + list.body.posts[0].id)).body.posts.map((p) => p.slug), ["a"]);
});

test("sign-in rules: no token, members, writers and admins", async () => {
  const e = env();
  assert.equal((await call(e, "GET", "/manage/posts")).status, 401);
  assert.equal((await call(e, "GET", "/manage/posts", { token: "bad" })).status, 401);
  assert.equal((await call(e, "GET", "/manage/posts", { token: "user-token" })).status, 403);

  // A writer can only send work for review, never publish.
  const w = await call(e, "POST", "/manage/posts", { token: "writer-token", body: article({ published: true, approval_status: "approved", user_id: "admin-1" }) });
  assert.equal(w.status, 201);
  assert.equal(w.body.post.published, false);
  assert.equal(w.body.post.approval_status, "pending");
  assert.equal(w.body.post.user_id, "writer-1");

  // Another writer cannot see or change it; the admin can.
  assert.equal((await call(e, "GET", `/manage/posts/${w.body.post.id}`, { token: "writer2-token" })).status, 403);
  assert.equal((await call(e, "PATCH", `/manage/posts/${w.body.post.id}`, { token: "writer2-token", body: { title: "Hijack" } })).status, 403);
  assert.equal((await call(e, "GET", "/manage/posts", { token: "writer2-token" })).body.posts.length, 0);
  assert.equal((await call(e, "DELETE", `/manage/posts/${w.body.post.id}`, { token: "writer-token" })).status, 403);

  // Admin approves: goes live with a publish date.
  const ok = await call(e, "PATCH", `/manage/posts/${w.body.post.id}`, { token: "admin-token", body: { published: true, approval_status: "approved" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.post.published, true);
  assert.ok(ok.body.post.published_at);

  // Once live, the writer can no longer edit it.
  assert.equal((await call(e, "PATCH", `/manage/posts/${w.body.post.id}`, { token: "writer-token", body: { title: "Changed" } })).status, 403);
});

test("slugs stay unique and deletes keep a copy", async () => {
  const e = env();
  const a = await call(e, "POST", "/manage/posts", { token: "admin-token", body: article() });
  assert.equal((await call(e, "POST", "/manage/posts", { token: "admin-token", body: article() })).status, 409);
  assert.equal((await call(e, "GET", "/manage/slug-available?slug=skubals-first-spring", { token: "admin-token" })).body.available, false);
  assert.equal((await call(e, "GET", `/manage/slug-available?slug=skubals-first-spring&exclude=${a.body.post.id}`, { token: "admin-token" })).body.available, true);
  assert.equal((await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ slug: "Bad Slug!" }) })).status, 400);

  const del = await call(e, "DELETE", `/manage/posts/${a.body.post.id}`, { token: "admin-token" });
  assert.equal(del.status, 200);
  assert.equal((await call(e, "GET", `/manage/posts/${a.body.post.id}`, { token: "admin-token" })).status, 404);
  const kept = e.DB.db.prepare("SELECT row_json FROM deleted_blog_posts WHERE id = ?").get(a.body.post.id);
  assert.equal(JSON.parse(kept.row_json).title, article().title);
});

test("scheduled articles go live when their time comes", async () => {
  const e = env();
  const s = await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ scheduled_publish_at: "2026-11-25T12:00:00Z" }) });
  assert.equal((await publishDue(e, new Date("2026-11-25T11:59:00Z"))).published, 0);
  assert.equal((await publishDue(e, new Date("2026-11-25T12:01:00Z"))).published, 1);
  const live = await call(e, "GET", "/posts/skubals-first-spring");
  assert.equal(live.status, 200);
  assert.equal(live.body.post.approval_status, "approved");
  assert.equal(live.body.post.id, s.body.post.id);
});

test("sync import upserts rows only with the sync token", async () => {
  const e = env();
  const row = { id: "11111111-2222-3333-4444-555555555555", user_id: "u", title: "T", slug: "t", content: "<p>It's</p>", tags: ["a"], published: true, published_at: "2026-11-01T10:00:00.123456Z", created_at: "2026-11-01T09:00:00Z", approval_status: "approved" };
  const post = (token, body) =>
    worker.fetch(new Request("https://x/sync/import", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }), e);
  assert.equal((await post("s3cret", { rows: [row] })).status, 404, "off without SYNC_TOKEN");
  e.SYNC_TOKEN = "s3cret";
  assert.equal((await post("wrong", { rows: [row] })).status, 401);
  assert.equal((await post("s3cret", { rows: [row] })).status, 200);
  assert.equal((await post("s3cret", { rows: [{ ...row, title: "T2" }] })).status, 200, "second run updates");
  const got = await call(e, "GET", "/posts/t");
  assert.equal(got.body.post.title, "T2");
  assert.equal(got.body.post.content, "<p>It's</p>");
  assert.equal(got.body.post.published_at, "2026-11-01T10:00:00.123Z");
  assert.deepEqual(got.body.post.tags, ["a"]);
});

test("publish-due endpoint publishes only what is due", async () => {
  const e = env();
  await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ scheduled_publish_at: "2020-01-01T00:00:00Z" }) });
  await call(e, "POST", "/manage/posts", { token: "admin-token", body: article({ slug: "later", scheduled_publish_at: "2999-01-01T00:00:00Z" }) });
  const r = await call(e, "POST", "/tasks/publish-due");
  assert.equal(r.body.published, 1);
  assert.equal((await call(e, "GET", "/posts/later")).status, 404);
});

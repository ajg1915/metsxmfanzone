// Local test for drafts-api-worker.js. Run: node --test cloudflare/drafts-api-worker.test.mjs
// Uses an in-memory stand-in for the R2 bucket and a stand-in for Supabase login,
// so it checks the Worker's own rules (who may call, how drafts move, what is rejected).
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./drafts-api-worker.js";

class FakeR2 {
  constructor() {
    this.files = new Map();
  }
  async put(key, value) {
    this.files.set(key, String(value));
  }
  async get(key) {
    if (!this.files.has(key)) return null;
    const text = this.files.get(key);
    return { text: async () => text };
  }
  async delete(key) {
    this.files.delete(key);
  }
  async list({ prefix = "" } = {}) {
    const objects = [...this.files.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key }));
    return { objects, truncated: false };
  }
}

// Stand-in for Supabase: "admin-token" is an admin, "user-token" is a signed-in non-admin.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const auth = init.headers?.Authorization || "";
  const known = auth === "Bearer admin-token" || auth === "Bearer user-token";
  if (url.includes("/auth/v1/user")) {
    return known ? Response.json({ id: auth === "Bearer admin-token" ? "admin-1" : "user-1" }) : new Response("no", { status: 401 });
  }
  if (url.includes("/rest/v1/user_roles")) {
    return Response.json(url.includes("user_id=eq.admin-1") ? [{ role: "admin" }] : []);
  }
  return realFetch(input, init);
};

const call = (env, method, path, { token, body } = {}) =>
  worker.fetch(
    new Request(`https://drafts.test${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env
  );

const goodDraft = (over = {}) => ({
  title: "Test Draft: Mets Bats Wake Up",
  content: "<p>" + "Lindor drives one deep to left and the crowd erupts. ".repeat(6) + "</p>",
  summary: "A short summary for cards and social.",
  meta_description: "Short Google description under the limit.",
  tags: ["Mets", "Offseason"],
  category: "Mets News",
  sources: ["https://example.com/a"],
  ...over,
});

const newEnv = (extra = {}) => ({ DRAFTS: new FakeR2(), INGEST_TOKEN: "secret-ingest", ...extra });

test("health check needs no login", async () => {
  const res = await call(newEnv(), "GET", "/");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).service, "drafts-api");
});

test("missing R2 binding is reported clearly", async () => {
  const res = await call({}, "GET", "/drafts", { token: "admin-token" });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /DRAFTS/);
});

test("admin calls refuse no login and non-admins", async () => {
  const env = newEnv();
  assert.equal((await call(env, "GET", "/drafts")).status, 401);
  assert.equal((await call(env, "GET", "/drafts", { token: "bogus" })).status, 401);
  assert.equal((await call(env, "GET", "/drafts", { token: "user-token" })).status, 401);
  assert.equal((await call(env, "GET", "/drafts", { token: "admin-token" })).status, 200);
});

test("ingest is disabled without a token setting, and guarded with one", async () => {
  const off = newEnv({ INGEST_TOKEN: undefined });
  assert.equal((await call(off, "POST", "/ingest", { token: "x", body: goodDraft() })).status, 503);

  const env = newEnv();
  assert.equal((await call(env, "POST", "/ingest", { body: goodDraft() })).status, 401);
  assert.equal((await call(env, "POST", "/ingest", { token: "wrong", body: goodDraft() })).status, 401);
  assert.equal((await call(env, "POST", "/ingest", { token: "admin-token", body: goodDraft() })).status, 401);
  assert.equal(env.DRAFTS.files.size, 0);
});

test("ingest saves a pending draft once, and checks the fields", async () => {
  const env = newEnv();
  const ok = await call(env, "POST", "/ingest", { token: "secret-ingest", body: goodDraft() });
  assert.equal(ok.status, 201);
  const { id } = await ok.json();
  assert.match(id, /^\d{4}-\d{2}-\d{2}-test-draft-mets-bats-wake-up$/);
  assert.ok(env.DRAFTS.files.has(`drafts/pending/${id}.json`));

  const again = await call(env, "POST", "/ingest", { token: "secret-ingest", body: goodDraft() });
  const dup = await again.json();
  assert.equal(dup.duplicate, true);
  assert.equal(dup.id, id);
  assert.equal(env.DRAFTS.files.size, 1);

  const longMeta = await call(env, "POST", "/ingest", {
    token: "secret-ingest",
    body: goodDraft({ title: "Another Title Here", meta_description: "x".repeat(161) }),
  });
  assert.equal(longMeta.status, 400);
  const noTags = goodDraft({ title: "Third Title Here" });
  delete noTags.tags;
  assert.equal((await call(env, "POST", "/ingest", { token: "secret-ingest", body: noTags })).status, 400);
  assert.equal(env.DRAFTS.files.size, 1);
});

test("list, counts, read, edit, approve, reject and undo", async () => {
  const env = newEnv();
  const ids = [];
  for (const title of ["First Draft Title", "Second Draft Title", "Third Draft Title"]) {
    const r = await call(env, "POST", "/ingest", { token: "secret-ingest", body: goodDraft({ title }) });
    ids.push((await r.json()).id);
  }
  const t = { token: "admin-token" };

  const list = await (await call(env, "GET", "/drafts?status=pending", t)).json();
  assert.equal(list.drafts.length, 3);
  assert.ok(list.drafts[0].word_count > 30);
  assert.equal("content" in list.drafts[0], false);
  assert.equal((await call(env, "GET", "/drafts?status=bogus", t)).status, 400);

  assert.deepEqual(await (await call(env, "GET", "/drafts/counts", t)).json(), { pending: 3, approved: 0, rejected: 0 });

  const one = await (await call(env, "GET", `/drafts/${ids[0]}`, t)).json();
  assert.equal(one.draft.title, "First Draft Title");
  assert.ok(one.draft.content.includes("Lindor"));
  assert.equal((await call(env, "GET", "/drafts/does-not-exist-here", t)).status, 404);
  assert.equal((await call(env, "GET", "/drafts/BAD..ID", t)).status, 400);

  // edit: bad value refused, good value saved
  const tooLong = await call(env, "PUT", `/drafts/${ids[0]}`, { ...t, body: { meta_description: "y".repeat(200) } });
  assert.equal(tooLong.status, 400);
  const edited = await call(env, "PUT", `/drafts/${ids[0]}`, { ...t, body: { title: "First Draft, Edited", tags: ["Edited"] } });
  assert.equal(edited.status, 200);
  const after = await (await call(env, "GET", `/drafts/${ids[0]}`, t)).json();
  assert.equal(after.draft.title, "First Draft, Edited");
  assert.deepEqual(after.draft.tags, ["Edited"]);
  assert.equal(after.draft.slug, "first-draft-title");

  // approve moves the file and keeps the post id
  const approve = await call(env, "POST", `/drafts/${ids[0]}/status`, { ...t, body: { status: "approved", published_post_id: "post-123", published_slug: "first-draft-title-2026-10-12" } });
  assert.equal(approve.status, 200);
  assert.equal(env.DRAFTS.files.has(`drafts/pending/${ids[0]}.json`), false);
  assert.equal(env.DRAFTS.files.has(`drafts/approved/${ids[0]}.json`), true);
  const approved = await (await call(env, "GET", `/drafts/${ids[0]}`, t)).json();
  assert.equal(approved.draft.status, "approved");
  assert.equal(approved.draft.published_post_id, "post-123");
  assert.equal(approved.draft.published_slug, "first-draft-title-2026-10-12");
  // doing it twice is harmless
  assert.equal((await call(env, "POST", `/drafts/${ids[0]}/status`, { ...t, body: { status: "approved" } })).status, 200);

  // approved drafts cannot be edited or rejected
  assert.equal((await call(env, "PUT", `/drafts/${ids[0]}`, { ...t, body: { title: "Nope nope" } })).status, 409);
  assert.equal((await call(env, "POST", `/drafts/${ids[0]}/status`, { ...t, body: { status: "rejected" } })).status, 409);

  // reject, then undo
  assert.equal((await call(env, "POST", `/drafts/${ids[1]}/status`, { ...t, body: { status: "rejected" } })).status, 200);
  assert.equal(env.DRAFTS.files.has(`drafts/rejected/${ids[1]}.json`), true);
  assert.equal((await call(env, "POST", `/drafts/${ids[1]}/status`, { ...t, body: { status: "pending" } })).status, 200);
  assert.equal(env.DRAFTS.files.has(`drafts/pending/${ids[1]}.json`), true);
  assert.equal(env.DRAFTS.files.has(`drafts/rejected/${ids[1]}.json`), false);
  assert.equal((await call(env, "POST", `/drafts/${ids[1]}/status`, { ...t, body: { status: "nonsense" } })).status, 400);

  assert.deepEqual(await (await call(env, "GET", "/drafts/counts", t)).json(), { pending: 2, approved: 1, rejected: 0 });
});


// ---------- originality check ----------
const SOURCE_TEXT =
  "The New York Mets are expected to pursue at least one front line starting pitcher this winter according to people familiar with the planning, and the front office has already begun talking with several agents about the market. ".repeat(2) +
  "Nobody expects a decision before the winter meetings begin in December.";

// Serve a fake source article at https://source.test/a (the Supabase stand-in above handles the rest).
const fetchWithSource = globalThis.fetch;
globalThis.fetch = async (input, init) =>
  String(input).startsWith("https://source.test/a")
    ? new Response(`<html><body><nav>menu</nav><article><p>${SOURCE_TEXT}</p></article></body></html>`)
    : fetchWithSource(input, init);

const check = async (text, sources = ["https://source.test/a"]) => {
  const res = await call(newEnv(), "POST", "/check", { token: "admin-token", body: { text, sources } });
  assert.equal(res.status, 200);
  return res.json();
};

test("check: article copied from a source is flagged", async () => {
  const copied =
    "Here is some of my own opening writing about the team. " +
    "The New York Mets are expected to pursue at least one front line starting pitcher this winter according to people familiar with the planning. " +
    "And here is more original closing writing that goes on for a while longer to pad things out.";
  const r = await check(copied);
  assert.equal(r.level, "review");
  assert.ok(r.longest_run >= 15, `longest run ${r.longest_run}`);
  assert.ok(r.flagged[0].text.startsWith("The New York Mets are expected"));
  assert.equal(r.flagged[0].source, "https://source.test/a");
  assert.equal(r.sources_checked, 1);
});

test("check: original wording passes", async () => {
  const own =
    "Mets ownership has money to spend and a rotation with holes, so expect Queens to be loud once the offseason market opens. " +
    "A couple of arms at the top of the board would change the whole picture for next April, and the club knows it.";
  const r = await check(own);
  assert.equal(r.level, "pass");
  assert.ok(r.overlap < 10);
});

test("check: a source that cannot be read is reported, not hidden", async () => {
  const r = await check("word ".repeat(40), ["https://source.test/a", "https://unreachable.invalid/x"]);
  assert.equal(r.sources_checked, 1);
  assert.deepEqual(r.sources_failed, ["https://unreachable.invalid/x"]);
});

test("check: needs admin, text and usable sources", async () => {
  const env = newEnv();
  assert.equal((await call(env, "POST", "/check", { body: { text: "x" } })).status, 401);
  assert.equal((await call(env, "POST", "/check", { token: "user-token", body: { text: "x" } })).status, 401);
  assert.equal((await call(env, "POST", "/check", { token: "admin-token", body: { text: "short" } })).status, 400);
  const none = await check("word ".repeat(40), ["file:///etc/passwd", "http://localhost/x", "http://10.0.0.1/"]);
  assert.equal(none.level, "no_sources");
});


// ---------- web check (Brave Search stand-in) ----------
const COPIED =
  "The front office has already begun talking with several agents about the market according to people familiar with the planning";
const OWN = "Mets ownership has money to spend and a rotation with holes so expect Queens to be loud once the offseason market opens up again";
const ARTICLE_WEB = [COPIED + ".", OWN + ".", "Another original sentence about the bullpen that goes on long enough to be searched on the web today."].join(" ");

let braveCalls = [];
const fetchBeforeBrave = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (!url.startsWith("https://api.search.brave.com/")) return fetchBeforeBrave(input, init);
  if (init.headers?.["X-Subscription-Token"] === "bad") return new Response("no", { status: 401 });
  const q = decodeURIComponent(new URL(url).searchParams.get("q"));
  braveCalls.push(q);
  const results = q.includes("front office has already begun")
    ? [{ url: "https://news.example.com/mets", title: "Mets plan", description: "The front office has already begun talking with several agents about the market according to people familiar with the planning, a source said." },
       { url: "https://www.metsxmfanzone.com/blog/mine", title: "Own site", description: "The front office has already begun talking with several agents about the market according to people familiar" }]
    : [{ url: "https://other.example.com/x", title: "Unrelated", description: "Something else entirely about baseball trades." }];
  return Response.json({ web: { results } });
};

const web = async (text, env = newEnv({ BRAVE_API_KEY: "key" })) => {
  const res = await call(env, "POST", "/check-web", { token: "admin-token", body: { text } });
  return { status: res.status, body: await res.json() };
};

test("check-web: copied sentence is found, own site is ignored, original text is not flagged", async () => {
  braveCalls = [];
  const { status, body } = await web(ARTICLE_WEB);
  assert.equal(status, 200);
  assert.equal(body.level, "review");
  assert.equal(body.matches.length, 1);
  assert.equal(body.matches[0].url, "https://news.example.com/mets");
  assert.ok(body.matches[0].words >= 8);
  assert.equal(body.sentences_checked, 3);
  assert.ok(braveCalls.every((q) => q.startsWith('"') && q.endsWith('"')), "searched as exact phrases");
}, { timeout: 15000 });

test("check-web: needs admin and a key, reports a rejected key", async () => {
  assert.equal((await call(newEnv(), "POST", "/check-web", { body: { text: "x" } })).status, 401);
  assert.equal((await web(ARTICLE_WEB, newEnv())).body.level, "not_configured");
  assert.equal((await web(ARTICLE_WEB, newEnv({ BRAVE_API_KEY: "bad" }))).body.level, "bad_key");
  assert.equal((await web("short")).status, 400);
});

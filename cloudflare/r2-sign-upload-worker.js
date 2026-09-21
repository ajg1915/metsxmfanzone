// r2-sign-upload — Cloudflare Worker for MetsXMFanZone
// Signs browser uploads (PUT) and deletes (DELETE) straight to your R2 bucket.
// Paste this whole file into: Cloudflare dashboard → Workers & Pages →
// r2-sign-upload → Edit code → replace everything → Deploy.
//
// Settings it reads (Workers → r2-sign-upload → Settings → Variables and Secrets):
//   R2_PUBLIC_BASE_URL    your bucket's public link, e.g. https://media.metsxmfanzone.com (no trailing slash)
//   R2_ACCOUNT_ID         your Cloudflare account ID
//   R2_ACCESS_KEY_ID      R2 API token Access Key ID
//   R2_SECRET_ACCESS_KEY  R2 API token Secret Access Key
//   R2_BUCKET             bucket name, e.g. metsxmfanzone-assets
// (If instead the Worker has an R2 bucket BINDING attached, that is used
// automatically and the four S3 keys above are not needed.)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ---------- S3 SigV4 presigning (used when the Worker has API keys, no binding) ----------
const enc = new TextEncoder();

const toHex = (buf) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(msg) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(msg)));
}

async function hmac(key, msg) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
}

// URI-encode per SigV4 rules.
const uriEncode = (str, encodeSlash = true) =>
  str
    .split("")
    .map((c) => {
      if (/[A-Za-z0-9_.~-]/.test(c)) return c;
      if (c === "/") return encodeSlash ? "%2F" : "/";
      return Array.from(enc.encode(c))
        .map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0"))
        .join("");
    })
    .join("");

async function presign(env, method, key, expiresIn = 900) {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  const host = `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${uriEncode(bucket, false)}/${uriEncode(key, false)}`;

  // NOTE: X-Amz-SignedHeaders MUST be part of the signed query — leaving it
  // out is what made R2 reject uploads with "Required search parameter
  // X-Amz-SignedHeaders missing".
  const params = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = params
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let signingKey = enc.encode(`AWS4${secretAccessKey}`);
  for (const part of [dateStamp, region, service, "aws4_request"]) {
    signingKey = new Uint8Array(await hmac(signingKey, part));
  }
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ---------- request handling ----------
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);

    try {
      const body = await request.json().catch(() => ({}));
      const action = body?.action === "delete" ? "DELETE" : "PUT";
      const rawKey = typeof body?.key === "string" ? body.key : "";
      const key = rawKey.replace(/^\/+/, "").slice(0, 512);
      if (!key || key.includes("..")) return json({ error: "Invalid file name" }, 400);

      const base = String(env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
      if (!base || base === "undefined") {
        return json({ error: "Missing R2_PUBLIC_BASE_URL setting on the Worker" }, 500);
      }

      // Prefer an attached R2 bucket binding (Cloudflare signs for us).
      const binding = Object.values(env).find(
        (v) => v && typeof v === "object" && typeof v.createSignedUrl === "function"
      );

      let uploadUrl;
      if (binding) {
        const signed = await binding.createSignedUrl(key, 900, { method: action });
        uploadUrl = signed.url;
      } else {
        if (
          !env.R2_ACCOUNT_ID ||
          !env.R2_ACCESS_KEY_ID ||
          !env.R2_SECRET_ACCESS_KEY ||
          !env.R2_BUCKET
        ) {
          return json({ error: "Worker is missing its R2 settings" }, 500);
        }
        uploadUrl = await presign(env, action, key);
      }

      const publicUrl =
        base + "/" + key.split("/").map(encodeURIComponent).join("/");

      return json({ uploadUrl, key, publicUrl });
    } catch (err) {
      return json({ error: "Could not prepare the upload" }, 500);
    }
  },
};

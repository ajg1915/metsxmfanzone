// Server-side uploads to Cloudflare R2 (S3 SigV4 presigned PUT).
// Needs secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256Hex = async (m: string) => toHex(await crypto.subtle.digest("SHA-256", enc.encode(m)));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
const uriEncode = (str: string, encodeSlash = true) =>
  str.split("").map((c) => {
    if (/[A-Za-z0-9_.~-]/.test(c)) return c;
    if (c === "/") return encodeSlash ? "%2F" : "/";
    return Array.from(enc.encode(c)).map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
  }).join("");

function cfg() {
  const c = {
    account: Deno.env.get("R2_ACCOUNT_ID") ?? "",
    keyId: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
    secret: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
    bucket: Deno.env.get("R2_BUCKET") ?? "",
    base: (Deno.env.get("R2_PUBLIC_BASE_URL") ?? "").replace(/\/+$/, ""),
  };
  if (!c.account || !c.keyId || !c.secret || !c.bucket || !c.base) throw new Error("R2 is not configured");
  return c;
}

async function presign(method: "PUT" | "DELETE", key: string, expiresIn = 900) {
  const c = cfg();
  const host = `${c.account}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalUri = `/${uriEncode(c.bucket, false)}/${uriEncode(key, false)}`;
  const q = ([
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${c.keyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ] as [string, string][])
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join("&");
  const creq = [method, canonicalUri, q, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(creq)].join("\n");
  let sk: ArrayBuffer | Uint8Array = enc.encode(`AWS4${c.secret}`);
  for (const p of [dateStamp, "auto", "s3", "aws4_request"]) sk = await hmac(sk, p);
  const sig = toHex(await hmac(sk, sts));
  return { url: `https://${host}${canonicalUri}?${q}&X-Amz-Signature=${sig}`, base: c.base };
}

/** Uploads bytes to R2 and returns the public URL. */
export async function uploadBytesToR2(key: string, bytes: Uint8Array | ArrayBuffer, contentType: string): Promise<string> {
  const clean = key.replace(/^\/+/, "");
  const { url, base } = await presign("PUT", clean);
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes as BodyInit });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
  return `${base}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

// Signs uploads (and deletes) for Cloudflare R2 using S3 SigV4 presigned URLs.
// Auth: the app signs users in on the owner's Supabase project, so the Bearer
// token is verified against that project's auth endpoint instead of locally.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const BUCKET = Deno.env.get("R2_BUCKET") ?? "";
const PUBLIC_BASE_URL = (Deno.env.get("R2_PUBLIC_BASE_URL") ?? "").replace(/\/+$/, "");

// Owner project where user accounts live (anon key is public/publishable).
const AUTH_SUPABASE_URL = Deno.env.get("AUTH_SUPABASE_URL") ?? "https://rdmrxeplasttewtlfetc.supabase.co";
const AUTH_SUPABASE_ANON_KEY = Deno.env.get("AUTH_SUPABASE_ANON_KEY") ?? "";

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(msg: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(msg)));
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
}

const uriEncode = (str: string, encodeSlash = true) =>
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

async function presign(method: "PUT" | "DELETE", key: string, expiresIn = 900) {
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${uriEncode(BUCKET, false)}/${uriEncode(key, false)}`;

  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${ACCESS_KEY_ID}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = params
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as [string, string])
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

  let signingKey: ArrayBuffer | Uint8Array = enc.encode(`AWS4${SECRET_ACCESS_KEY}`);
  for (const part of [dateStamp, region, service, "aws4_request"]) {
    signingKey = await hmac(signingKey, part);
  }
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Verify the caller's token against the owner project's auth server.
async function getAuthUser(authHeader: string): Promise<{ id: string } | null> {
  const res = await fetch(`${AUTH_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: AUTH_SUPABASE_ANON_KEY, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ? { id: user.id } : null;
}

// Deletes stay admin-only: check the caller's roles on the owner project.
async function isAdmin(authHeader: string, userId: string): Promise<boolean> {
  const res = await fetch(
    `${AUTH_SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${userId}&role=eq.admin`,
    { headers: { apikey: AUTH_SUPABASE_ANON_KEY, Authorization: authHeader } },
  );
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_BASE_URL) {
      return json({ error: "R2 is not configured" }, 500);
    }
    if (!AUTH_SUPABASE_ANON_KEY) {
      return json({ error: "Auth verification is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

    const user = await getAuthUser(authHeader);
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "delete" ? "delete" : "upload";
    const rawKey = typeof body?.key === "string" ? body.key : "";
    const key = rawKey.replace(/^\/+/, "").slice(0, 512);
    if (!key || key.includes("..")) return json({ error: "Invalid file name" }, 400);

    if (action === "delete" && !(await isAdmin(authHeader, user.id))) {
      return json({ error: "Admin access required" }, 403);
    }

    const url = await presign(action === "delete" ? "DELETE" : "PUT", key);

    return json({
      uploadUrl: url,
      key,
      publicUrl: `${PUBLIC_BASE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`,
    });
  } catch (error) {
    console.error("r2-sign-upload failed:", error instanceof Error ? error.message : error);
    return json({ error: "Could not prepare the upload" }, 500);
  }
});

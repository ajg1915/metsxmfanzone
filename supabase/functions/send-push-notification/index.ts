import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// VAPID keys
const VAPID_PUBLIC_KEY = Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = 'mailto:metsxmfanzone@gmail.com';

// AES-GCM decryption for encrypted push subscription data
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ACTIVITY_LOGS_ENCRYPTION_KEY') ?? '';
  if (!keyString) {
    throw new Error('Encryption key not configured');
  }
  
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(keyString));
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  
  try {
    if (!ciphertext.match(/^[A-Za-z0-9+/]+=*$/)) {
      return ciphertext;
    }
    
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    if (combined.length < 13) {
      return ciphertext;
    }
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch {
    return ciphertext;
  }
}

// Base64 URL encoding/decoding helpers
function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64DecodeAny(str: string): Uint8Array {
  // Handles base64 and base64url (p256dh/auth are typically base64, VAPID keys are base64url)
  return base64UrlDecode(str);
}

function uint16be(value: number): Uint8Array {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function uint32be(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

type U8AB = Uint8Array<ArrayBuffer>;
const toU8AB = (bytes: Uint8Array): U8AB => new Uint8Array(bytes) as unknown as U8AB;
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => toU8AB(bytes).buffer;

async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, toArrayBuffer(dataBytes));
  return new Uint8Array(sig);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  // HKDF-Extract(salt, IKM) = HMAC(salt, IKM)
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // HKDF-Expand(PRK, info, L)
  let t: Uint8Array = new Uint8Array(0);
  let okm: Uint8Array = new Uint8Array(0);
  let counter = 1;

  while (okm.length < length) {
    const input = concatBytes(t, info, new Uint8Array([counter]));
    t = await hmacSha256(prk, input);
    okm = concatBytes(okm, t);
    counter++;
  }

  return okm.slice(0, length);
}

async function encryptWebPushPayloadAes128gcm(
  subscription: { p256dh: string; auth: string },
  payloadText: string
): Promise<{ body: Uint8Array }>{
  const enc = new TextEncoder();

  const clientPublicKeyRaw = base64DecodeAny(subscription.p256dh);
  const authSecretRaw = base64DecodeAny(subscription.auth);

  const { publicKey: serverPublicKey, privateKey: serverPrivateKey } = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverPublicKey));

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(clientPublicKeyRaw),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverPrivateKey,
      256
    )
  );

  const context = concatBytes(
    enc.encode('P-256\0'),
    uint16be(clientPublicKeyRaw.length),
    clientPublicKeyRaw,
    uint16be(serverPublicKeyRaw.length),
    serverPublicKeyRaw
  );

  const prk = await hkdfExtract(authSecretRaw, sharedSecret);
  const ikm = await hkdfExpand(prk, concatBytes(enc.encode('WebPush: info\0'), context), 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hkdfExtract(salt, ikm);

  const cek = await hkdfExpand(prk2, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk2, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', toArrayBuffer(cek), { name: 'AES-GCM' }, false, ['encrypt']);

  // RFC8291: append padding delimiter 0x02
  const plaintext = concatBytes(enc.encode(payloadText), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toU8AB(nonce) }, aesKey, toArrayBuffer(plaintext))
  );

  const rs = 4096;
  const bodyHeader = concatBytes(
    salt,
    uint32be(rs),
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw
  );

  return { body: concatBytes(bodyHeader, ciphertext) };
}

// Create VAPID JWT token
async function createVapidJwt(audience: string): Promise<string> {
  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    throw new Error('VAPID keys not configured');
  }

  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Create JWK for EC private key (P-256)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: VAPID_PRIVATE_KEY,
    x: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const signature = new Uint8Array(signatureBuffer);
  let rawSignature: Uint8Array;

  if (signature.length === 64) {
    rawSignature = signature;
  } else {
    // DER format - extract r and s values
    rawSignature = new Uint8Array(64);
    let offset = 3;
    let rLen = signature[offset];
    offset++;
    if (rLen === 33) {
      rawSignature.set(signature.slice(offset + 1, offset + 33), 0);
      offset += 33;
    } else {
      rawSignature.set(signature.slice(offset + (32 - rLen), offset + rLen), 32 - rLen);
      offset += rLen;
    }
    offset++; // skip 0x02
    let sLen = signature[offset];
    offset++;
    if (sLen === 33) {
      rawSignature.set(signature.slice(offset + 1, offset + 33), 32);
    } else {
      rawSignature.set(signature.slice(offset, offset + sLen), 32 + (32 - sLen));
    }
  }

  const signatureB64 = base64UrlEncode(rawSignature);
  return `${unsignedToken}.${signatureB64}`;
}

// Send push notification using Web Push protocol
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon?: string; url?: string; tag?: string }
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      throw new Error('VAPID keys not configured');
    }

    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    console.log(`Pushing to: ${subscription.endpoint.substring(0, 60)}...`);

    const encrypted = await encryptWebPushPayloadAes128gcm(
      { p256dh: subscription.p256dh, auth: subscription.auth },
      JSON.stringify(payload)
    );

    const vapidJwt = await createVapidJwt(audience);

    const body = toU8AB(encrypted.body);

    const headers: Record<string, string> = {
      'TTL': '86400',
      'Urgency': 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.byteLength),
      'Authorization': `vapid t=${vapidJwt}, k=${VAPID_PUBLIC_KEY}`,
      'Crypto-Key': `p256ecdsa=${VAPID_PUBLIC_KEY}`,
    };

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body,
    });

    const statusCode = response.status;

    if (statusCode === 201 || statusCode === 200) {
      console.log('Push sent successfully');
      return { success: true, statusCode };
    } else if (statusCode === 410 || statusCode === 404) {
      console.log('Subscription expired');
      return { success: false, statusCode, error: 'Subscription expired' };
    } else {
      const errorText = await response.text();
      console.error(`Push failed: ${statusCode} - ${errorText}`);
      return { success: false, statusCode, error: errorText };
    }
  } catch (error) {
    console.error('Push error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendBeamsBroadcast(title: string, body: string, url?: string) {
  const id = Deno.env.get('PUSHER_BEAMS_INSTANCE_ID') ?? '';
  const key = Deno.env.get('PUSHER_BEAMS_SECRET_KEY') ?? '';
  if (!id || !key) return { skipped: true };
  try {
    const res = await fetch(`https://${id}.pushnotifications.pusher.com/publish_api/v1/instances/${id}/publishes/interests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interests: ['hello', 'all-users'],
        web: { notification: { title, body, deep_link: new URL(url || '/', 'https://metsxmfanzone.com').toString() } },
      }),
    });
    const text = await res.text();
    if (!res.ok) console.error(`Beams publish failed [${res.status}]: ${text}`);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('Beams error:', e);
    return { ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isSystemCall = req.headers.get('X-System-Call') === 'true';
    
    if (!isSystemCall) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin verified:', user.id);
    }

    const { title, body, icon, url, tag, targetUsers } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const beams = (!targetUsers || !Array.isArray(targetUsers) || targetUsers.length === 0)
      ? await sendBeamsBroadcast(title, body, url)
      : { skipped: true };

    let query = supabase.from('notification_subscriptions').select('*');
    
    if (targetUsers && Array.isArray(targetUsers) && targetUsers.length > 0) {
      query = query.in('user_id', targetUsers);
    }
    
    const { data: subscriptions, error } = await query;

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active subscriptions', beams }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending to ${subscriptions.length} subscribers, VAPID: ${VAPID_PRIVATE_KEY ? 'yes' : 'no'}`);

    const payload = {
      title,
      body,
      icon: icon || '/logo-192.png',
      url: url || '/',
      tag: tag || 'metsxm-notification',
    };

    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const decryptedEndpoint = await decrypt(subscription.endpoint);
          const decryptedP256dh = await decrypt(subscription.p256dh);
          const decryptedAuth = await decrypt(subscription.auth);

          const result = await sendPushNotification(
            { endpoint: decryptedEndpoint, p256dh: decryptedP256dh, auth: decryptedAuth },
            payload
          );

          if (result.statusCode === 410 || result.statusCode === 404) {
            await supabase.from('notification_subscriptions').delete().eq('id', subscription.id);
          }

          return { ...result, userId: subscription.user_id };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successCount} notifications`,
        total: subscriptions.length,
        successful: successCount,
        failed: subscriptions.length - successCount,
        vapidConfigured: !!VAPID_PRIVATE_KEY,
        beams,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

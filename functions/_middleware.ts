// Cloudflare Pages middleware — applies security headers to EVERY response.
//
// This file only runs when the site is served by Cloudflare Pages.
// While metsxmfanzone.com is hosted on Vercel, the equivalent headers are
// configured in vercel.json (the Vercel-native way). Keep both in sync if
// you edit the header values below.

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'accelerometer=(), gyroscope=(), magnetometer=()',
  // Permissive-by-design CSP: the site embeds PayPal, Google Cast, Firebase,
  // YouTube and Supabase, so sources stay broad over HTTPS while still
  // blocking mixed content, object plugins, framing and form abuse.
  'Content-Security-Policy': [
    "default-src 'self' https: data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss: blob:",
    "frame-src https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
};

interface PagesContext {
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const response = await context.next();
  const secured = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(key, value);
  }
  return secured;
};

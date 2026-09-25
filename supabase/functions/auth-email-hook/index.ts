// Supabase Auth "Send Email" hook → Resend.
//
// Supabase Auth calls this function whenever it needs to send an account email
// (signup confirmation, password reset, magic link, email change, invite,
// reauthentication code). We render the dark-blue MetsXMFanZone template and
// send it through our own Resend account from noreply@metsxmfanzone.com.
//
// Setup (Supabase dashboard → Authentication → Hooks → Send Email hook):
//   type: HTTPS, URL: https://<project>.supabase.co/functions/v1/auth-email-hook
//   Copy the generated secret ("v1,whsec_...") into this function's secrets as
//   SEND_EMAIL_HOOK_SECRET. RESEND_API_KEY must also be set (it already is).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { resendFetch } from '../_shared/resend-fetch.ts'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const SITE_NAME = 'MetsXMFanZone'
const SITE_URL = 'https://metsxmfanzone.com'
const FROM = `${SITE_NAME} <noreply@metsxmfanzone.com>`
const REPLY_TO = 'support@metsxmfanzone.com'

interface HookPayload {
  user: { email: string; new_email?: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const verifyUrl = (tokenHash: string, type: string, redirectTo: string) => {
  const base = Deno.env.get('SUPABASE_URL') ?? ''
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo || SITE_URL })
  return `${base}/auth/v1/verify?${params.toString()}`
}

async function send(to: string, subject: string, element: React.ReactElement, idempotencyKey: string) {
  const html = await renderAsync(element)
  const text = await renderAsync(element, { plainText: true })
  const res = await resendFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''
  if (!rawSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET is not set')
    return json({ error: { http_code: 500, message: 'Email hook is not configured' } }, 500)
  }

  const body = await req.text()
  let payload: HookPayload
  try {
    const wh = new Webhook(rawSecret.replace(/^v1,/, '').replace(/^whsec_/, ''))
    payload = wh.verify(body, Object.fromEntries(req.headers)) as HookPayload
  } catch (err) {
    console.error('Invalid hook signature:', err)
    return json({ error: { http_code: 401, message: 'Invalid signature' } }, 401)
  }

  const { user, email_data: d } = payload
  const type = d.email_action_type
  const id = req.headers.get('webhook-id') ?? crypto.randomUUID()

  try {
    switch (type) {
      case 'signup':
        await send(user.email, 'Confirm your email', React.createElement(SignupEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, recipient: user.email,
          confirmationUrl: verifyUrl(d.token_hash, 'signup', d.redirect_to),
        }), id)
        break
      case 'invite':
        await send(user.email, "You've been invited to MetsXMFanZone", React.createElement(InviteEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL,
          confirmationUrl: verifyUrl(d.token_hash, 'invite', d.redirect_to),
        }), id)
        break
      case 'magiclink':
        await send(user.email, 'Your MetsXMFanZone login link', React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: verifyUrl(d.token_hash, 'magiclink', d.redirect_to),
        }), id)
        break
      case 'recovery':
        await send(user.email, 'Reset your MetsXMFanZone password', React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: verifyUrl(d.token_hash, 'recovery', d.redirect_to),
        }), id)
        break
      case 'email_change': {
        // Supabase naming quirk: token_hash_new pairs with the CURRENT address,
        // token_hash pairs with the NEW address. With "secure email change" on,
        // both are present and both addresses must confirm.
        const newEmail = user.new_email ?? ''
        const props = { siteName: SITE_NAME, oldEmail: user.email, email: user.email, newEmail }
        if (d.token_hash_new) {
          await send(user.email, 'Confirm your email change', React.createElement(EmailChangeEmail, {
            ...props, confirmationUrl: verifyUrl(d.token_hash_new, 'email_change', d.redirect_to),
          }), `${id}-current`)
        }
        if (newEmail) {
          await send(newEmail, 'Confirm your new email', React.createElement(EmailChangeEmail, {
            ...props, confirmationUrl: verifyUrl(d.token_hash, 'email_change', d.redirect_to),
          }), `${id}-new`)
        }
        break
      }
      case 'reauthentication':
        await send(user.email, 'Your MetsXMFanZone verification code', React.createElement(ReauthenticationEmail, {
          token: d.token,
        }), id)
        break
      default:
        console.warn('Unhandled email type:', type)
        return json({ error: { http_code: 400, message: `Unsupported email type: ${type}` } }, 400)
    }
  } catch (err) {
    console.error(`Failed to send ${type} email:`, err)
    return json({ error: { http_code: 500, message: 'Failed to send email' } }, 500)
  }

  return json({})
})

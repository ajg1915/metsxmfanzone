// Sends Resend API requests with your own Resend key, straight to api.resend.com.
// Older code may still pass the retired Lovable gateway address; it is rewritten
// to api.resend.com here so nothing ever routes through Lovable.
const LEGACY_GATEWAY = 'https://connector-gateway.lovable.dev/resend'
const RESEND_API = 'https://api.resend.com'

export const getResendKey = () =>
  Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY') ?? ''

export const resendFetch = (url: string, init: RequestInit = {}) => {
  const resendKey = getResendKey()
  if (!resendKey) throw new Error('RESEND_API_KEY is not configured')
  const headers = new Headers(init.headers)
  headers.delete('X-Connection-Api-Key')
  headers.set('Authorization', `Bearer ${resendKey}`)
  return fetch(url.replace(LEGACY_GATEWAY, RESEND_API), { ...init, headers })
}

// Sends Resend API requests with your own Resend key, straight to api.resend.com.

export const getResendKey = () =>
  Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY') ?? ''

export const resendFetch = (url: string, init: RequestInit = {}) => {
  const resendKey = getResendKey()
  if (!resendKey) throw new Error('RESEND_API_KEY is not configured')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${resendKey}`)
  return fetch(url, { ...init, headers })
}

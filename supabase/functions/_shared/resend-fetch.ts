// Sends Resend API requests. Uses your own Resend key directly against
// api.resend.com (live backend). If a connector gateway key is present
// and the Resend key is a gateway connection key, routes via the gateway.
const GATEWAY = 'https://connector-gateway.lovable.dev/resend'

export const getResendKey = () =>
  Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY') ?? ''

export const resendFetch = (url: string, init: RequestInit = {}) => {
  const resendKey = getResendKey()
  if (!resendKey) throw new Error('RESEND_API_KEY is not configured')
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const headers = new Headers(init.headers)
  const useGateway = Boolean(lovableKey) && !resendKey.startsWith('re_')
  if (useGateway) {
    headers.set('Authorization', `Bearer ${lovableKey}`)
    headers.set('X-Connection-Api-Key', resendKey)
    return fetch(url, { ...init, headers })
  }
  headers.delete('X-Connection-Api-Key')
  headers.set('Authorization', `Bearer ${resendKey}`)
  return fetch(url.replace(GATEWAY, 'https://api.resend.com'), { ...init, headers })
}

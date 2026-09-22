// Shared MetsXMFanZone email branding.
// Colours, logo and footer are read from the `email_template_settings` row
// managed in Admin → Email Template Designer, so every Resend email follows
// whatever branding the admin saved. Falls back to brand defaults.

// deno-lint-ignore no-explicit-any
type ServiceClient = any

export interface EmailBrand {
  logo_url: string
  primary_color: string
  card_bg_color: string
  body_bg_color: string
  heading_color: string
  text_color: string
  footer_text: string
  button_border_radius: string
  logo_width: number
}

export const SITE_URL = 'https://metsxmfanzone.com'

export const DEFAULT_BRAND: EmailBrand = {
  logo_url: `${SITE_URL}/metsxmfanzone-logo.png`,
  primary_color: '#FF5910',
  card_bg_color: '#1a1a2e',
  body_bg_color: '#0a0a0a',
  heading_color: '#ffffff',
  text_color: '#d1d5db',
  footer_text: '© 2026 MetsXMFanZone — The Ultimate Mets Fan Community',
  button_border_radius: '10px',
  logo_width: 85,
}

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match] || match))

let cached: { brand: EmailBrand; at: number } | null = null
const CACHE_MS = 60_000

/** Reads the admin-managed branding (cached for a minute). Never throws. */
export const getEmailBrand = async (supabase?: ServiceClient): Promise<EmailBrand> => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.brand
  if (!supabase) return DEFAULT_BRAND

  try {
    const { data } = await supabase
      .from('email_template_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    const brand: EmailBrand = {
      logo_url: data?.logo_url || DEFAULT_BRAND.logo_url,
      primary_color: data?.primary_color || DEFAULT_BRAND.primary_color,
      card_bg_color: data?.card_bg_color || DEFAULT_BRAND.card_bg_color,
      body_bg_color: data?.body_bg_color || DEFAULT_BRAND.body_bg_color,
      heading_color: data?.heading_color || DEFAULT_BRAND.heading_color,
      text_color: data?.text_color || DEFAULT_BRAND.text_color,
      footer_text: data?.footer_text || DEFAULT_BRAND.footer_text,
      button_border_radius: data?.button_border_radius || DEFAULT_BRAND.button_border_radius,
      logo_width: Number(data?.logo_width) || DEFAULT_BRAND.logo_width,
    }
    cached = { brand, at: Date.now() }
    return brand
  } catch (_error) {
    return DEFAULT_BRAND
  }
}

export interface BrandedEmailOptions {
  /** Short hidden preview line shown in the inbox list. */
  preheader?: string
  /** Main headline, plain text (escaped for you). */
  heading?: string
  /** Body HTML fragment — escape any user data before passing it in. */
  content: string
  cta?: { label: string; url: string }
  /** Small note under the button (plain text). */
  note?: string
  brand?: EmailBrand
}

/** Wraps an HTML fragment in the branded MetsXMFanZone shell. */
export const renderBrandedEmail = ({
  preheader,
  heading,
  content,
  cta,
  note,
  brand = DEFAULT_BRAND,
}: BrandedEmailOptions) => {
  const b = brand
  const buttonHtml = cta
    ? `<tr><td align="center" style="padding: 8px 0 20px;">
         <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${b.primary_color};color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:${b.button_border_radius};font-weight:700;font-size:15px;">${escapeHtml(cta.label)}</a>
       </td></tr>`
    : ''

  const noteHtml = note
    ? `<tr><td style="padding:0 0 14px;color:#8b93a1;font-size:12px;line-height:1.6;text-align:center;">${escapeHtml(note)}</td></tr>`
    : ''

  const headingHtml = heading
    ? `<tr><td style="padding:4px 0 14px;"><h1 style="margin:0;color:${b.heading_color};font-size:22px;line-height:1.3;font-weight:800;text-align:center;">${escapeHtml(heading)}</h1></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
  </head>
  <body style="margin:0;padding:0;background-color:${b.body_bg_color};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${b.body_bg_color};padding:20px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${b.card_bg_color};border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:26px 24px;">
            <tr>
              <td align="center" style="padding-bottom:18px;">
                <a href="${SITE_URL}" style="text-decoration:none;">
                  <img src="${escapeHtml(b.logo_url)}" alt="MetsXMFanZone" width="${b.logo_width}" style="width:${b.logo_width}px;height:auto;border-radius:12px;display:block;margin:0 auto 10px;" />
                  <span style="color:#002D72;font-size:18px;font-weight:800;">Mets</span><span style="color:${b.primary_color};font-size:18px;font-weight:800;">XM</span><span style="color:#ffffff;font-size:18px;font-weight:800;">FanZone</span>
                </a>
              </td>
            </tr>
            ${headingHtml}
            <tr>
              <td style="color:${b.text_color};font-size:15px;line-height:1.65;">
                ${content}
              </td>
            </tr>
            ${buttonHtml}
            ${noteHtml}
            <tr>
              <td style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;text-align:center;">
                <p style="margin:0 0 6px;color:${b.primary_color};font-size:13px;font-weight:700;">Let's Go Mets!</p>
                <p style="margin:0 0 8px;color:#7a828f;font-size:11px;">${escapeHtml(b.footer_text)}</p>
                <a href="${SITE_URL}" style="color:${b.primary_color};font-size:11px;text-decoration:none;">metsxmfanzone.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Convenience: fetch branding and render in one call. */
export const renderBrandedEmailFor = async (
  supabase: ServiceClient,
  options: Omit<BrandedEmailOptions, 'brand'>
) => renderBrandedEmail({ ...options, brand: await getEmailBrand(supabase) })

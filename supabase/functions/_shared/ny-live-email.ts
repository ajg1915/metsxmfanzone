// "LIVE NOW" email for NY Sports events (Giants, Jets, Knicks, Nets, Rangers,
// Islanders). Same branded shell as the Mets gameday emails, plus a matchup row
// with both teams' logos.

import { renderBrandedEmailFor, escapeHtml, SITE_URL } from './email-brand.ts'
import { parseMatchup, teamLogo, type Team } from './team-logos.ts'

// deno-lint-ignore no-explicit-any
type ServiceClient = any

export type NyLiveEvent = {
  id: string
  title: string
  nyPage: string // e.g. "ny-rangers"
  startedAt: string | null // ISO
}

const timeET = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })

const side = (t: Team) => `<td align="center" valign="top" width="120" style="padding:0 6px;">
  <img src="${teamLogo(t)}" alt="${escapeHtml(t.short)}" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 8px;border:0;" />
  <span style="color:#ffffff;font-size:14px;font-weight:700;">${escapeHtml(t.short)}</span></td>`

export const renderNyLiveEmail = async (supabase: ServiceClient, ev: NyLiveEvent) => {
  const m = parseMatchup(ev.title, ev.nyPage)
  const teamName = m?.nyTeam.short ?? 'NY team'
  const title = `🔴 LIVE NOW: ${ev.title.trim()}`
  const url = `${SITE_URL}/live/${ev.id}`
  const started = ev.startedAt ? timeET(ev.startedAt) : null

  const matchup = m?.opponent
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:6px auto 18px;"><tr>
  ${side(m.nyTeam)}
  <td align="center" valign="middle" style="padding:0 8px 22px;color:#FF5910;font-size:18px;font-weight:800;">${m.isHome ? 'VS' : '@'}</td>
  ${side(m.opponent)}
</tr></table>`
    : ''

  const content = `
  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:1px;color:#FF5910;text-align:center;">LIVE NOW · NY SPORTS</p>
  ${matchup}
  <p style="margin:0 0 12px;text-align:center;">The ${escapeHtml(teamName)} are live on MetsXMFanZone. Tune in now! 🗽</p>
  ${started ? `<p style="margin:0 0 16px;text-align:center;color:#9aa3b2;font-size:13px;">Started ${escapeHtml(started)} ET</p>` : ''}`

  const note =
    'Live Giants, Jets, Knicks, Nets, Rangers and Islanders games are part of NY Sports Streaming ($19.99/month). Not a member yet? Join at metsxmfanzone.com/pricing.'

  const html = await renderBrandedEmailFor(supabase, {
    preheader: `The ${teamName} are live now on MetsXMFanZone`,
    heading: title,
    content,
    cta: { label: 'Watch Live', url },
    note,
  })

  const text = [
    title,
    '',
    `The ${teamName} are live on MetsXMFanZone. Tune in now!`,
    m?.opponent ? `${m.nyTeam.short} ${m.isHome ? 'vs' : '@'} ${m.opponent.short}` : '',
    started ? `Started ${started} ET` : '',
    '',
    `Watch live: ${url}`,
    '',
    note,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')

  return { subject: title, html, text, url, teamName }
}

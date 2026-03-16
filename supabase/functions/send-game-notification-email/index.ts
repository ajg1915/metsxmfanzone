import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// MLB team ID mapping for official logos
const MLB_TEAM_IDS: Record<string, number> = {
  'arizona diamondbacks': 109, 'diamondbacks': 109, 'dbacks': 109, 'ari': 109,
  'atlanta braves': 144, 'braves': 144, 'atl': 144,
  'baltimore orioles': 110, 'orioles': 110, 'bal': 110,
  'boston red sox': 111, 'red sox': 111, 'bos': 111,
  'chicago cubs': 112, 'cubs': 112, 'chc': 112,
  'chicago white sox': 145, 'white sox': 145, 'chw': 145, 'cws': 145,
  'cincinnati reds': 113, 'reds': 113, 'cin': 113,
  'cleveland guardians': 114, 'guardians': 114, 'cle': 114,
  'colorado rockies': 115, 'rockies': 115, 'col': 115,
  'detroit tigers': 116, 'tigers': 116, 'det': 116,
  'houston astros': 117, 'astros': 117, 'hou': 117,
  'kansas city royals': 118, 'royals': 118, 'kc': 118,
  'los angeles angels': 108, 'angels': 108, 'laa': 108,
  'los angeles dodgers': 119, 'dodgers': 119, 'lad': 119,
  'miami marlins': 146, 'marlins': 146, 'mia': 146,
  'milwaukee brewers': 158, 'brewers': 158, 'mil': 158,
  'minnesota twins': 142, 'twins': 142, 'min': 142,
  'new york mets': 121, 'mets': 121, 'nym': 121,
  'new york yankees': 147, 'yankees': 147, 'nyy': 147,
  'oakland athletics': 133, 'athletics': 133, 'oak': 133, "a's": 133,
  'philadelphia phillies': 143, 'phillies': 143, 'phi': 143,
  'pittsburgh pirates': 134, 'pirates': 134, 'pit': 134,
  'san diego padres': 135, 'padres': 135, 'sd': 135,
  'san francisco giants': 137, 'giants': 137, 'sf': 137,
  'seattle mariners': 136, 'mariners': 136, 'sea': 136,
  'st. louis cardinals': 138, 'cardinals': 138, 'stl': 138,
  'tampa bay rays': 139, 'rays': 139, 'tb': 139,
  'texas rangers': 140, 'rangers': 140, 'tex': 140,
  'toronto blue jays': 141, 'blue jays': 141, 'tor': 141,
  'washington nationals': 120, 'nationals': 120, 'wsh': 120, 'was': 120,
};

const getTeamLogoUrl = (teamName: string): string => {
  const key = teamName.toLowerCase().trim();
  const teamId = MLB_TEAM_IDS[key];
  if (teamId) {
    return `https://midfield.mlbstatic.com/v1/team/${teamId}/spots/72`;
  }
  return '';
};

interface GameNotificationRequest {
  title: string;
  message: string;
  gameInfo?: {
    opponent?: string;
    date?: string;
    time?: string;
    location?: string;
    homeScore?: number;
    awayScore?: number;
    homeTeam?: string;
    awayTeam?: string;
    result?: string;
  };
  notificationType: 'game_alert' | 'score_update' | 'lineup' | 'news' | 'live_stream' | 'event' | 'general' | 'final_score';
  targetUsers?: string[];
  url?: string;
  imageUrl?: string;
}

const VERIFIED_EMAIL_DOMAIN = 'notify.www.metsxmfanzone.com';
const VERIFIED_FROM_ADDRESS = `MetsXMFanZone <noreply@${VERIFIED_EMAIL_DOMAIN}>`;
const EMAIL_QUEUE_NAME = 'transactional_emails';

const getTemplateName = (notificationType: GameNotificationRequest['notificationType']) =>
  `game_notification_${notificationType}`;

const queueEmail = async (
  supabase: ReturnType<typeof createClient>,
  to: string,
  subject: string,
  html: string,
  notificationType: GameNotificationRequest['notificationType']
) => {
  const messageId = crypto.randomUUID();

  const payload = {
    run_id: crypto.randomUUID(),
    to,
    from: VERIFIED_FROM_ADDRESS,
    sender_domain: VERIFIED_EMAIL_DOMAIN,
    subject,
    html,
    text: subject,
    purpose: 'transactional',
    label: getTemplateName(notificationType),
    idempotency_key: `game-notification:${notificationType}:${to.toLowerCase()}:${messageId}`,
    message_id: messageId,
    queued_at: new Date().toISOString(),
  };

  const { error: queueError } = await supabase.rpc('enqueue_email', {
    queue_name: EMAIL_QUEUE_NAME,
    payload,
  });

  if (queueError) {
    throw queueError;
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: getTemplateName(notificationType),
    recipient_email: to,
    status: 'pending',
    metadata: { notificationType },
  });

  if (logError) {
    console.error('Failed to log queued email:', logError.message);
  }

  return messageId;
};

const DEFAULT_EMOJIS: Record<string, string> = {
  game_day: '⚾',
  writer_approval: '🎉',
  writer_revoked: '📝',
  email_confirm: '✉️',
  sub_expiry: '⏰',
  maintenance: '🔧',
};

const loadSavedEmojis = async (supabase: any): Promise<Record<string, string>> => {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'email_emojis')
      .maybeSingle();
    if (data?.setting_value && typeof data.setting_value === 'object') {
      return { ...DEFAULT_EMOJIS, ...(data.setting_value as Record<string, string>) };
    }
  } catch (err) {
    console.error('Failed to load emoji settings:', err);
  }
  return { ...DEFAULT_EMOJIS };
};

const getNotificationIcon = (type: string, emojis: Record<string, string>): string => {
  switch (type) {
    case 'game_alert': return emojis.game_day || '⚾';
    case 'score_update': return '📊';
    case 'final_score': return '🏆';
    case 'lineup': return '📋';
    case 'live_stream': return '📺';
    case 'news': return '📰';
    case 'event': return emojis.writer_approval || '🎉';
    default: return '🔔';
  }
};

const isGameType = (type: string): boolean => {
  return ['game_alert', 'score_update', 'final_score', 'lineup'].includes(type);
};

const getEmailTemplate = (
  title: string,
  message: string,
  gameInfo?: GameNotificationRequest['gameInfo'],
  notificationType?: string,
  url?: string,
  imageUrl?: string,
  emojis?: Record<string, string>
) => {
  const baseUrl = Deno.env.get('SITE_URL') || 'https://metsxmfanzone.com';
  const actionUrl = url ? `${baseUrl}${url}` : baseUrl;
  const logoUrl = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png';
  const icon = getNotificationIcon(notificationType || 'general', emojis || DEFAULT_EMOJIS);
  const isFinal = notificationType === 'final_score';
  const isGame = isGameType(notificationType || 'general');
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  // Determine opponent for logo display
  const opponentName = gameInfo?.opponent || gameInfo?.awayTeam || gameInfo?.homeTeam || '';
  const opponentLogoUrl = opponentName ? getTeamLogoUrl(opponentName) : '';
  const metsLogoUrl = 'https://midfield.mlbstatic.com/v1/team/121/spots/72';

  // VS header for game-type emails: Mets logo vs Opponent logo
  const vsHeaderHtml = (isGame && opponentLogoUrl) ? `
    <div style="text-align: center; padding: 16px 0 8px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 auto; max-width: 280px;">
        <tr>
          <td width="40%" style="text-align: center; vertical-align: middle;">
            <img src="${metsLogoUrl}" alt="New York Mets" width="64" height="64" style="width: 64px; height: 64px; display: block; margin: 0 auto;" />
            <div style="color: #ffffff; font-size: 11px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;">Mets</div>
          </td>
          <td width="20%" style="text-align: center; vertical-align: middle;">
            <div style="color: #FF4500; font-size: 20px; font-weight: 900; letter-spacing: 2px;">VS</div>
          </td>
          <td width="40%" style="text-align: center; vertical-align: middle;">
            <img src="${escapeHtml(opponentLogoUrl)}" alt="${escapeHtml(opponentName)}" width="64" height="64" style="width: 64px; height: 64px; display: block; margin: 0 auto;" />
            <div style="color: #ffffff; font-size: 11px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(opponentName)}</div>
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  // Score box for final score / score update alerts
  const scoreBoxHtml = (gameInfo && (isFinal || notificationType === 'score_update') && gameInfo.homeTeam && gameInfo.awayTeam) ? `
    <div style="background: #0a0e1a; border: 2px solid ${isFinal ? '#FF4500' : 'rgba(255,69,0,0.4)'}; border-radius: 16px; padding: 24px 16px; margin: 20px 0; text-align: center;">
      ${isFinal ? '<div style="background: #FF4500; color: white; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; display: inline-block; margin-bottom: 16px;">FINAL SCORE</div>' : ''}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
        <tr>
          <td width="42%" style="text-align: center; vertical-align: middle;">
            <div style="color: #9CA3AF; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Away</div>
            <div style="color: white; font-size: 14px; font-weight: 700;">${escapeHtml(gameInfo.awayTeam || '')}</div>
            <div style="color: ${(gameInfo.awayScore ?? 0) > (gameInfo.homeScore ?? 0) ? '#FF4500' : '#D1D5DB'}; font-size: 42px; font-weight: 900; line-height: 1.1; margin-top: 4px;">${gameInfo.awayScore ?? 0}</div>
          </td>
          <td width="16%" style="text-align: center; vertical-align: middle;">
            <div style="color: #4B5563; font-size: 20px; font-weight: 300;">–</div>
          </td>
          <td width="42%" style="text-align: center; vertical-align: middle;">
            <div style="color: #9CA3AF; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Home</div>
            <div style="color: white; font-size: 14px; font-weight: 700;">${escapeHtml(gameInfo.homeTeam || '')}</div>
            <div style="color: ${(gameInfo.homeScore ?? 0) > (gameInfo.awayScore ?? 0) ? '#FF4500' : '#D1D5DB'}; font-size: 42px; font-weight: 900; line-height: 1.1; margin-top: 4px;">${gameInfo.homeScore ?? 0}</div>
          </td>
        </tr>
      </table>
      ${gameInfo.result ? `<div style="color: #FF4500; font-size: 13px; font-weight: 700; margin-top: 14px; letter-spacing: 0.5px;">${escapeHtml(gameInfo.result)}</div>` : ''}
    </div>
  ` : '';

  // Game details card for non-score alerts
  const gameInfoHtml = (gameInfo && !isFinal && notificationType !== 'score_update') ? `
    <div style="background: #0a0e1a; border: 1px solid rgba(255,69,0,0.3); border-radius: 12px; padding: 18px; margin: 20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${gameInfo.opponent ? `<tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Opponent</td><td style="color: white; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">${escapeHtml(gameInfo.opponent)}</td></tr>` : ''}
        ${gameInfo.date ? `<tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Date</td><td style="color: white; font-size: 13px; padding: 4px 0; text-align: right;">${escapeHtml(gameInfo.date)}</td></tr>` : ''}
        ${gameInfo.time ? `<tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">First Pitch</td><td style="color: #FF4500; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 700;">${escapeHtml(gameInfo.time)}</td></tr>` : ''}
        ${gameInfo.location ? `<tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Venue</td><td style="color: white; font-size: 13px; padding: 4px 0; text-align: right;">${escapeHtml(gameInfo.location)}</td></tr>` : ''}
      </table>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${safeTitle}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
</head>
<body style="margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#002D72" style="background-color: #002D72; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <table width="420" cellpadding="0" cellspacing="0" border="0" style="max-width: 420px; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 20px 12px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0 16px 0;">
      <img src="${logoUrl}" alt="MetsXMFanZone" width="85" style="width: 85px; height: auto; display: block; margin: 0 auto 8px auto; border-radius: 12px;" />
      <span style="color: #FF4500; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">MetsXMFanZone</span>
    </div>

    <!-- Main Card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141a2e" style="background-color: #141a2e; border: 1px solid rgba(255,69,0,0.25); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
      <tr>
        <td style="padding: 28px 20px;">
      
      ${vsHeaderHtml}

      <!-- Icon + Title -->
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 36px; margin-bottom: 12px;">${icon}</div>
        <h1 style="color: white; font-size: 20px; font-weight: 800; margin: 0 0 8px 0; line-height: 1.3; letter-spacing: -0.3px;">${safeTitle}</h1>
      </div>

      ${imageUrl ? `<div style="text-align: center; margin: 0 0 18px 0;"><img src="${escapeHtml(imageUrl)}" alt="Alert image" width="360" style="width: 100%; max-width: 360px; height: auto; border-radius: 12px; display: block; margin: 0 auto;" /></div>` : ''}
      
      <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 4px 0;">${safeMessage}</p>

      ${scoreBoxHtml}
      ${gameInfoHtml}

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${escapeHtml(actionUrl)}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="23%" fillcolor="#FF4500"><center style="color:#ffffff;font-family:Arial;font-size:14px;font-weight:bold;">${isFinal ? 'View Full Recap' : 'Open MetsXMFanZone'}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-->
        <a href="${escapeHtml(actionUrl)}" style="display: inline-block; background-color: #FF4500; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
          ${isFinal ? 'View Full Recap' : 'Open MetsXMFanZone'}
        </a>
        <!--<![endif]-->
      </div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.08);">
      <div style="margin-bottom: 12px;">
        <a href="https://facebook.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Facebook</a>
        <span style="color: #374151;">•</span>
        <a href="https://twitter.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Twitter</a>
        <span style="color: #374151;">•</span>
        <a href="https://instagram.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Instagram</a>
        <span style="color: #374151;">•</span>
        <a href="https://youtube.com/@metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">YouTube</a>
      </div>
      <p style="color: #6B7280; font-size: 10px; margin: 0 0 6px 0;">
        You're receiving this because you enabled game notifications on MetsXMFanZone.
      </p>
      <p style="color: #6B7280; font-size: 10px; margin: 0 0 12px 0;">
        <a href="${escapeHtml(baseUrl)}/dashboard" style="color: #FF4500; text-decoration: none;">Manage notification preferences</a>
      </p>
      <p style="color: #4B5563; font-size: 10px; margin: 0;">
        &copy; ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.
      </p>
    </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { title, message, gameInfo, notificationType = 'general', targetUsers, url, imageUrl }: GameNotificationRequest = await req.json();

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: 'Title and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch registered users who are eligible for this notification type
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, email_notifications_enabled, game_notifications_enabled')
      .not('email', 'is', null);

    if (['game_alert', 'score_update', 'lineup', 'final_score'].includes(notificationType)) {
      // Game alerts should reach users who enabled either game alerts or email alerts
      query = query.or('game_notifications_enabled.eq.true,email_notifications_enabled.eq.true');
    } else {
      query = query.eq('email_notifications_enabled', true);
    }

    if (targetUsers && targetUsers.length > 0) {
      query = query.in('id', targetUsers);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // 2. Fetch newsletter subscribers so they also receive all notifications
    const { data: subscribers, error: subscribersError } = await supabase
      .from('newsletter_subscribers')
      .select('email, full_name')
      .eq('is_active', true);

    if (subscribersError) {
      console.error('Error fetching newsletter subscribers:', subscribersError);
    }

    // 3. Merge both lists, deduplicating by email
    const emailMap = new Map<string, { email: string; full_name?: string }>();

    for (const user of users || []) {
      if (user.email) {
        emailMap.set(user.email.toLowerCase(), { email: user.email, full_name: user.full_name || undefined });
      }
    }

    for (const sub of subscribers || []) {
      if (sub.email && !emailMap.has(sub.email.toLowerCase())) {
        emailMap.set(sub.email.toLowerCase(), { email: sub.email, full_name: sub.full_name || undefined });
      }
    }

    const allRecipients = Array.from(emailMap.values());

    if (allRecipients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recipients found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending email notifications to ${allRecipients.length} recipients (${(users || []).length} registered users + ${(subscribers || []).length} newsletter subscribers, deduplicated)`);
    const savedEmojis = await loadSavedEmojis(supabase);
    const emailHtml = getEmailTemplate(title, message, gameInfo, notificationType, url, imageUrl, savedEmojis);

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const results: Array<{ success: boolean; error?: string }> = [];

    for (let i = 0; i < allRecipients.length; i++) {
      const recipient = allRecipients[i];
      let sent = false;
      let lastError = 'Unknown error';

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendEmail(
            resendApiKey,
            recipient.email,
            `${title} - MetsXMFanZone`,
            emailHtml
          );
          sent = true;
          console.log(`Email sent to [REDACTED]`);
          break;
        } catch (error: any) {
          lastError = error?.message || 'Unknown error';
          const isRateLimited =
            lastError.includes('rate_limit_exceeded') ||
            lastError.includes('"statusCode":429');

          if (isRateLimited && attempt < 3) {
            const backoffMs = 700 * attempt;
            console.warn(`Rate limit encountered, retrying [REDACTED] in ${backoffMs}ms (attempt ${attempt + 1}/3)`);
            await delay(backoffMs);
            continue;
          }

          console.error(`Failed to send email to [REDACTED]:`, lastError);
          break;
        }
      }

      results.push(sent ? { success: true } : { success: false, error: lastError });

      // Resend limit is 2 requests/sec; keep well below the threshold.
      if (i < allRecipients.length - 1) {
        await delay(600);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Emails sent: ${successCount}/${allRecipients.length}`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} email notifications`,
        total: allRecipients.length,
        successful: successCount,
        failed: allRecipients.length - successCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in send-game-notification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

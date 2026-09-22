import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor, escapeHtml } from "../_shared/email-brand.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METS_TEAM_ID = 121;

const sendNotifications = async (
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
  title: string,
  message: string,
  opponent: string,
  todayET: string,
  timeStr: string,
  venue: string,
  linkUrl: string,
  notificationType: string = 'game_alert',
  extraGameInfo: Record<string, any> = {},
  triggerType: string = '',
) => {
  // Gameday email — only fires for triggers that are toggled ON in admin
  try {
    if (triggerType === 'pregame_20min' || triggerType === 'pregame_5min') {
      const { data: setting } = await supabase
        .from('gameday_email_settings')
        .select('enabled')
        .eq('trigger_type', triggerType)
        .maybeSingle();

      if (setting?.enabled) {
        // Fetch all opted-in recipients (subscribed users)
        const { data: recipients } = await supabase
          .from('profiles')
          .select('email')
          .not('email', 'is', null);

        const emails = (recipients || [])
          .map((r: any) => r.email)
          .filter((e: string) => !!e);

        const gamedayUrl = linkUrl.startsWith('http') ? linkUrl : `https://metsxmfanzone.com${linkUrl}`;
        const gamedayLabelMap: Record<string, string> = {
          pregame_20min: '20 MINUTES TO FIRST PITCH',
          pregame_5min: '5 MINUTES TO FIRST PITCH',
        };
        const gamedayLabel = gamedayLabelMap[triggerType] || 'GAMEDAY ALERT';
        const gamedayContent = `
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:1px;color:#FF5910;text-align:center;">${escapeHtml(gamedayLabel)}</p>
          <p style="margin:0 0 16px;">${escapeHtml(message)}</p>
          ${opponent ? `<p style="margin:4px 0;"><strong>Opponent:</strong> ${escapeHtml(opponent)}</p>` : ''}
          ${timeStr ? `<p style="margin:4px 0;"><strong>First Pitch:</strong> ${escapeHtml(timeStr)} ET</p>` : ''}
          ${venue ? `<p style="margin:4px 0;"><strong>Venue:</strong> ${escapeHtml(venue)}</p>` : ''}`;
        const gamedayText = `${title}\n\n${message}\n${opponent ? `Opponent: ${opponent}\n` : ''}${timeStr ? `First Pitch: ${timeStr} ET\n` : ''}${venue ? `Venue: ${venue}\n` : ''}\n${gamedayUrl}`;
        const gamedayHtml = await renderBrandedEmailFor(supabase, {
          preheader: title,
          heading: title,
          content: gamedayContent,
          cta: { label: 'Watch Live', url: gamedayUrl },
        });

        for (const to of emails) {
          try {
            await queueTransactionalEmail(supabase, {
              to,
              subject: title,
              html: gamedayHtml,
              text: gamedayText,
              label: 'gameday_alert',
              idempotencyKey: `gameday-${triggerType}-${todayET}-${to}`,
            });
          } catch (e) {
            console.error(`Email send failed for ${to}:`, e);
          }
        }

        await supabase
          .from('game_alerts')
          .update({ email_sent: true })
          .eq('title', title)
          .gte('created_at', `${todayET}T00:00:00Z`);

        console.log(`Gameday emails queued for ${triggerType}: ${emails.length} recipients`);
      } else {
        console.log(`Gameday email skipped — ${triggerType} toggle is OFF`);
      }
    }
  } catch (emailErr) {
    console.error('Gameday email error:', emailErr);
  }

  // Send push notification
  try {
    const pushPayload = { title, body: message, url: linkUrl };
    const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify(pushPayload),
    });
    const pushText = await pushRes.text();
    const pushResult = pushText ? JSON.parse(pushText) : null;

    if (!pushRes.ok) {
      throw new Error(`HTTP ${pushRes.status}: ${pushText}`);
    }

    if (!pushResult?.sent) {
      throw new Error(pushResult?.message || 'No push notifications were sent');
    }

    console.log(`Push sent for "${title}":`, { sent: pushResult.sent });

    await supabase
      .from("game_alerts")
      .update({ push_sent: true })
      .eq("title", title)
      .gte("created_at", `${todayET}T00:00:00Z`);
  } catch (err) {
    console.error(`Push failed for "${title}":`, err instanceof Error ? err.message : err);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { triggerType = "morning" } = await req.json().catch(() => ({}));

    // Get today's date in ET
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = etFormatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    const todayET = `${year}-${month}-${day}`;

    console.log(`Auto Game Alert: Checking for Mets games on ${todayET} (trigger: ${triggerType})`);

    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${todayET}&hydrate=team,venue`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error("MLB API error:", response.status, text);
      return new Response(JSON.stringify({ success: false, error: "MLB API error" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const data = await response.json();

    if (!data.dates || data.dates.length === 0) {
      console.log("No Mets games today.");
      return new Response(JSON.stringify({ success: true, message: "No games today" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const games = data.dates[0].games;
    let alertsCreated = 0;

    for (const game of games) {
      const isHome = game.teams.home.team.id === METS_TEAM_ID;
      const opponent = isHome ? game.teams.away.team.name : game.teams.home.team.name;
      const venue = game.venue?.name || (isHome ? "Citi Field" : "Away");
      const gameType = game.gameType;
      const typeLabel = gameType === 'S' ? 'Spring Training' : gameType === 'R' ? 'Regular Season' : 'Postseason';
      const homeAway = isHome ? "vs" : "@";

      const gameDate = new Date(game.gameDate);
      const timeStr = gameDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
      });

      // Handle final score trigger
      if (triggerType === "final_score") {
        const abstractState = game.status?.abstractGameState;
        if (abstractState !== 'Final') {
          console.log(`Game ${game.gamePk} not Final yet (${abstractState}), skipping final_score.`);
          continue;
        }

        // Fetch live feed for final score details
        const liveFeedUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
        const liveRes = await fetch(liveFeedUrl);
        if (!liveRes.ok) {
          const errText = await liveRes.text();
          console.error("Live feed error:", errText);
          continue;
        }

        const liveData = await liveRes.json();
        const linescore = liveData.liveData?.linescore;
        const homeScore = linescore?.teams?.home?.runs ?? 0;
        const awayScore = linescore?.teams?.away?.runs ?? 0;
        const homeTeamName = liveData.gameData?.teams?.home?.name || game.teams.home.team.name;
        const awayTeamName = liveData.gameData?.teams?.away?.name || game.teams.away.team.name;
        const metsScore = isHome ? homeScore : awayScore;
        const opponentScore = isHome ? awayScore : homeScore;
        const metsWon = metsScore > opponentScore;

        const resultText = metsWon
          ? `Mets WIN ${metsScore}-${opponentScore}! 🎉`
          : `Mets lose ${metsScore}-${opponentScore}`;

        const title = metsWon
          ? `🏆 Mets Win! Final: ${metsScore}-${opponentScore} ${homeAway} ${opponent}`
          : `📊 Final Score: Mets ${metsScore}, ${opponent} ${opponentScore}`;

        const message = metsWon
          ? `What a game! The Mets defeat the ${opponent} ${metsScore}-${opponentScore} at ${venue}. ${typeLabel}. Let's Go Mets! 🟠🔵`
          : `The Mets fall to the ${opponent} ${opponentScore}-${metsScore} at ${venue}. ${typeLabel}. We'll get 'em next time! ⚾`;

        // Dedup
        const { data: existing } = await supabase
          .from("game_alerts")
          .select("id")
          .eq("title", title)
          .gte("created_at", `${todayET}T00:00:00Z`)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Final score alert already exists for game ${game.gamePk}, skipping.`);
          continue;
        }

        const linkUrl = '/mets-scores';

        const { error: insertError } = await supabase
          .from("game_alerts")
          .insert({
            title,
            message,
            alert_type: 'final_score',
            severity: metsWon ? 'info' : 'warning',
            link_url: linkUrl,
            is_active: true,
            push_sent: false,
            email_sent: false,
          });

        if (insertError) {
          console.error("Failed to insert final score alert:", insertError);
          continue;
        }

        console.log(`Created final_score alert: ${title}`);
        alertsCreated++;

        await sendNotifications(
          supabaseUrl, serviceKey, supabase, title, message, opponent, todayET, timeStr, venue, linkUrl, 'final_score',
          {
            homeScore,
            awayScore,
            homeTeam: homeTeamName,
            awayTeam: awayTeamName,
            result: resultText,
          },
          'final_score'
        );
        continue;
      }

      // Handle game-live trigger (notify the moment a game actually goes In Progress)
      if (triggerType === "game_live") {
        const abstractState = game.status?.abstractGameState; // 'Preview' | 'Live' | 'Final'
        if (abstractState !== 'Live') {
          console.log(`Game ${game.gamePk} not Live yet (${abstractState}), skipping game_live.`);
          continue;
        }

        const title = `🔴 LIVE NOW: Mets ${homeAway} ${opponent}`;
        const message = `First pitch is underway! Mets ${homeAway} ${opponent} at ${venue}. Tune in now! 🟠🔵⚾`;
        const linkUrl = gameType === 'S' ? '/spring-training-live' : '/metsxmfanzone';

        // Dedup by exact title within today
        const { data: existing } = await supabase
          .from("game_alerts")
          .select("id")
          .eq("title", title)
          .gte("created_at", `${todayET}T00:00:00Z`)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Live alert already exists for game ${game.gamePk}, skipping.`);
          continue;
        }

        const { error: insertError } = await supabase
          .from("game_alerts")
          .insert({
            title,
            message,
            alert_type: 'game_live',
            severity: 'critical',
            link_url: linkUrl,
            is_active: true,
            push_sent: false,
            email_sent: false,
          });

        if (insertError) {
          console.error("Failed to insert game_live alert:", insertError);
          continue;
        }

        console.log(`Created game_live alert: ${title}`);
        alertsCreated++;

        await sendNotifications(
          supabaseUrl, serviceKey, supabase, title, message, opponent, todayET, timeStr, venue, linkUrl,
          'game_live', {}, 'game_live'
        );
        continue;
      }


      // For time-based triggers, check if game is within the right window
      const nowMs = now.getTime();
      const gameMs = gameDate.getTime();
      const minsUntilGame = (gameMs - nowMs) / 60000;

      if (triggerType === "pregame_20min" && (minsUntilGame < 10 || minsUntilGame > 30)) {
        console.log(`Game ${game.gamePk} is ${Math.round(minsUntilGame)} mins away, skipping 20min alert.`);
        continue;
      }
      if (triggerType === "pregame_5min" && (minsUntilGame < 0 || minsUntilGame > 10)) {
        console.log(`Game ${game.gamePk} is ${Math.round(minsUntilGame)} mins away, skipping 5min alert.`);
        continue;
      }
      if (triggerType === "pregame" && (minsUntilGame < 90 || minsUntilGame > 150)) {
        continue;
      }

      // Build alert content
      let title: string;
      let message: string;
      let severity = "info";

      if (triggerType === "morning") {
        title = `⚾ Game Day! Mets ${homeAway} ${opponent}`;
        message = `${typeLabel}: Mets ${homeAway} ${opponent} today at ${timeStr} ET at ${venue}. Let's go Mets! 🟠🔵`;
      } else if (triggerType === "pregame") {
        title = `🔔 Almost Game Time! Mets ${homeAway} ${opponent}`;
        message = `First pitch in ~2 hours! Mets ${homeAway} ${opponent} at ${timeStr} ET at ${venue}. Get ready! ⚾`;
        severity = "warning";
      } else if (triggerType === "pregame_20min") {
        title = `🔥 20 Minutes to First Pitch! Mets ${homeAway} ${opponent}`;
        message = `Almost time! Mets ${homeAway} ${opponent} at ${timeStr} ET at ${venue}. Tune in now! ⚾🔥`;
        severity = "warning";
      } else if (triggerType === "pregame_5min") {
        title = `🚨 5 Minutes to First Pitch! Mets ${homeAway} ${opponent}`;
        message = `IT'S GAME TIME! Mets ${homeAway} ${opponent} starting NOW at ${venue}! Let's GO Mets! 🟠🔵⚾`;
        severity = "critical";
      } else {
        title = `⚾ Mets ${homeAway} ${opponent}`;
        message = `${typeLabel}: Mets ${homeAway} ${opponent} at ${timeStr} ET at ${venue}.`;
      }

      // Dedup
      const { data: existing } = await supabase
        .from("game_alerts")
        .select("id")
        .eq("title", title)
        .gte("created_at", `${todayET}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Alert already exists for game ${game.gamePk} (${triggerType}), skipping.`);
        continue;
      }

      const linkUrl = gameType === 'S' ? '/spring-training-live' : '/metsxmfanzone';
      const alertTypeDb = gameType === 'S' ? 'spring_training' : 'game_day';

      const { error: insertError } = await supabase
        .from("game_alerts")
        .insert({
          title,
          message,
          alert_type: alertTypeDb,
          severity,
          link_url: linkUrl,
          is_active: true,
          push_sent: false,
          email_sent: false,
        });

      if (insertError) {
        console.error("Failed to insert alert:", insertError);
        continue;
      }

      console.log(`Created ${triggerType} alert: ${title}`);
      alertsCreated++;

      // Send email + push notifications
      await sendNotifications(supabaseUrl, serviceKey, supabase, title, message, opponent, todayET, timeStr, venue, linkUrl, 'game_alert', {}, triggerType);
    }

    // Deactivate old auto-alerts from previous days
    await supabase
      .from("game_alerts")
      .update({ is_active: false })
      .in("alert_type", ["game_day", "spring_training", "final_score"])
      .lt("created_at", `${todayET}T00:00:00Z`);

    return new Response(
      JSON.stringify({ success: true, alertsCreated, date: todayET }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Auto game alerts error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

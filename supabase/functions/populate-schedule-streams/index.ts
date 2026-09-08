import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORAGE_BASE = 'https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/content_uploads/fanart';

// Map opponents to specific fan art thumbnails
const OPPONENT_THUMBNAILS: Record<string, string> = {
  'New York Yankees': `${STORAGE_BASE}/mets-yankees.jpg`,
  'Atlanta Braves': `${STORAGE_BASE}/mets-braves.jpg`,
  'Philadelphia Phillies': `${STORAGE_BASE}/mets-phillies.jpg`,
  'Los Angeles Dodgers': `${STORAGE_BASE}/mets-dodgers.jpg`,
};

function getThumbnail(opponent: string, isHome: boolean, gameType: string): string {
  // Check for specific opponent art first
  if (OPPONENT_THUMBNAILS[opponent]) return OPPONENT_THUMBNAILS[opponent];
  // Spring training
  if (gameType === 'S') return `${STORAGE_BASE}/mets-spring.jpg`;
  // Home vs away
  return isHome ? `${STORAGE_BASE}/mets-home.jpg` : `${STORAGE_BASE}/mets-away.jpg`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch the 2026 schedule
    const METS_TEAM_ID = 121;
    const year = 2026;
    const gameTypes = ['S', 'R'];
    const allGames: any[] = [];

    for (const gameType of gameTypes) {
      let startDate: string;
      let endDate: string;

      if (gameType === 'S') {
        startDate = `${year}-02-20`;
        endDate = `${year}-03-31`;
      } else {
        startDate = `${year}-03-25`;
        endDate = `${year}-10-05`;
      }

      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&startDate=${startDate}&endDate=${endDate}&gameType=${gameType}&hydrate=team,venue`;
      const response = await fetch(url);
      
      if (!response.ok) continue;
      const data = await response.json();

      if (data.dates) {
        for (const dateEntry of data.dates) {
          for (const game of dateEntry.games) {
            const isHome = game.teams.home.team.id === METS_TEAM_ID;
            const opponent = isHome ? game.teams.away.team.name : game.teams.home.team.name;
            
            allGames.push({
              gameId: game.gamePk,
              date: game.gameDate,
              gameType: game.gameType,
              isHome,
              opponent,
              venue: game.venue.name,
            });
          }
        }
      }
    }

    // Sort by date
    allGames.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Found ${allGames.length} games to populate`);

    // Step 2: Check which games already exist (by title pattern)
    const { data: existingStreams } = await supabase
      .from('live_streams')
      .select('title');

    const existingTitles = new Set((existingStreams || []).map((s: any) => s.title));

    // Step 3: Build insert records
    const defaultStreamUrl = 'https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8';
    const newStreams: any[] = [];
    let order = 1;

    for (const game of allGames) {
      const prefix = game.isHome ? 'Mets Vs' : 'Mets @';
      const dateLabel = formatDate(game.date);
      const title = `${prefix} ${game.opponent} ${dateLabel}`;
      
      if (existingTitles.has(title)) continue;

      const gameDate = new Date(game.date);
      const scheduledStart = game.date;
      // Assume ~3.5 hour game
      const endDate = new Date(gameDate.getTime() + 3.5 * 60 * 60 * 1000);
      const scheduledEnd = endDate.toISOString();

      const thumbnail = getThumbnail(game.opponent, game.isHome, game.gameType);

      const description = game.gameType === 'S' 
        ? `Spring Training: ${game.isHome ? 'vs' : '@'} ${game.opponent} at ${game.venue}`
        : `Regular Season: ${game.isHome ? 'vs' : '@'} ${game.opponent} at ${game.venue}`;

      newStreams.push({
        title,
        description,
        stream_url: defaultStreamUrl,
        status: 'scheduled',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        thumbnail_url: thumbnail,
        published: true,
        display_order: order++,
      });
    }

    console.log(`Inserting ${newStreams.length} new streams (${allGames.length - newStreams.length} already existed)`);

    // Step 4: Batch insert (50 at a time to avoid payload limits)
    let inserted = 0;
    const batchSize = 50;
    
    for (let i = 0; i < newStreams.length; i += batchSize) {
      const batch = newStreams.slice(i, i + batchSize);
      const { error } = await supabase.from('live_streams').insert(batch);
      
      if (error) {
        console.error(`Batch insert error at ${i}:`, error.message);
        throw error;
      }
      inserted += batch.length;
      console.log(`Inserted batch: ${inserted}/${newStreams.length}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalGames: allGames.length,
        newStreamsAdded: inserted,
        skippedExisting: allGames.length - newStreams.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error populating streams:', error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPPRESS_REFRESH_PATHS = [
  '/espn-network',
  '/pix11-network',
  '/mlb-network',
  '/metsxmfanzone',
  '/spring-training-live',
  '/msg-network',
  '/sny',
  '/live/',
  '/admin',
];

// Map table names to the React Query keys they should invalidate
const TABLE_QUERY_KEY_MAP: Record<string, string[]> = {
  hero_slides: ['hero-slides'],
  stories: ['stories'],
  live_streams: ['live-streams'],
  live_notifications: ['live-notifications'],
  stream_alerts: ['stream-alerts'],
  blog_posts: ['blog-posts', 'blog_posts'],
  game_alerts: ['game-alerts'],
  podcast_shows: ['podcast-shows', 'podcast_shows'],
  
  podcast_live_stream: ['podcast-live-stream', 'podcast_live_stream'],
};

/**
 * Real-time auto-refresh hook.
 * Subscribes to key Supabase tables via Realtime and invalidates
 * React Query caches so components re-fetch without a hard page reload.
 */
export const useAutoRefresh = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidations = useRef<Set<string>>(new Set());

  const isSuppressedPage = () => {
    return SUPPRESS_REFRESH_PATHS.some(path => location.pathname.startsWith(path));
  };

  useEffect(() => {
    const triggerInvalidation = (tableName: string) => {
      if (isSuppressedPage()) return;

      // Collect table names and batch-invalidate after a short debounce
      const queryKeys = TABLE_QUERY_KEY_MAP[tableName];
      if (queryKeys) {
        queryKeys.forEach(key => pendingInvalidations.current.add(key));
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        const keys = Array.from(pendingInvalidations.current);
        pendingInvalidations.current.clear();

        console.log('[AutoRefresh] Invalidating queries:', keys);
        keys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }, 1500);
    };

    const tables = Object.keys(TABLE_QUERY_KEY_MAP);
    let channel = supabase.channel('auto-refresh-realtime');

    tables.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => triggerInvalidation(table)
      );
    });

    channel.subscribe((status) => {
      console.log('[AutoRefresh] Realtime status:', status);
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.log('[AutoRefresh] Channel lost, reconnecting in 3s...');
        setTimeout(() => {
          supabase.removeChannel(channel);
          // Re-create channel
          let newChannel = supabase.channel('auto-refresh-realtime-' + Date.now());
          tables.forEach(table => {
            newChannel = newChannel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table },
              () => triggerInvalidation(table)
            );
          });
          newChannel.subscribe((s) => {
            console.log('[AutoRefresh] Reconnected status:', s);
          });
          channelRef = newChannel;
        }, 3000);
      }
    });

    let channelRef = channel;

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      supabase.removeChannel(channelRef);
    };
  }, []);
};

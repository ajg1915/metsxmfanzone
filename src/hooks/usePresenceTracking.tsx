import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('presence_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('presence_session_id', sessionId);
  }
  return sessionId;
};

const getPageType = (path: string): string => {
  if (path.startsWith('/blog/') || path === '/blog') return 'blog';
  if (path.includes('live') || path.includes('stream') || path.includes('network') || path === '/metsxmfanzone') return 'stream';
  if (path === '/community') return 'community';
  if (path.startsWith('/admin')) return 'admin';
  return 'general';
};

const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
};

const getReferrerSource = (): string => {
  const referrer = document.referrer.toLowerCase();
  const storedSource = sessionStorage.getItem('referrer_source');
  if (storedSource) return storedSource;

  let source = 'direct';
  if (!referrer) {
    source = 'direct';
  } else if (referrer.includes('google.') || referrer.includes('bing.') || referrer.includes('yahoo.') || referrer.includes('duckduckgo.') || referrer.includes('baidu.')) {
    source = 'search';
  } else if (referrer.includes('facebook.') || referrer.includes('twitter.') || referrer.includes('x.com') || referrer.includes('instagram.') || referrer.includes('tiktok.') || referrer.includes('linkedin.') || referrer.includes('reddit.') || referrer.includes('youtube.')) {
    source = 'social';
  } else if (!referrer.includes(window.location.hostname)) {
    source = 'referral';
  }
  sessionStorage.setItem('referrer_source', source);
  return source;
};

type Geo = { country: string | null; region: string | null; city: string | null };

const getGeo = async (): Promise<Geo> => {
  const cached = sessionStorage.getItem('visitor_geo');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }
  const empty: Geo = { country: null, region: null, city: null };
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return empty;
    const json = await res.json();
    const geo: Geo = {
      country: json.country_name || json.country || null,
      region: json.region || null,
      city: json.city || null,
    };
    sessionStorage.setItem('visitor_geo', JSON.stringify(geo));
    return geo;
  } catch {
    return empty;
  }
};

const getEntryPage = (): string => {
  let entry = sessionStorage.getItem('entry_page');
  if (!entry) {
    entry = window.location.pathname;
    sessionStorage.setItem('entry_page', entry);
  }
  return entry;
};

export const usePresenceTracking = () => {
  const location = useLocation();
  const sessionId = useRef(getSessionId());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<string | null>(null);
  const geoRef = useRef<Geo>({ country: null, region: null, city: null });

  // Resolve user + geo once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      userRef.current = user?.id || null;
    }).catch(() => {});
    getGeo().then((geo) => { geoRef.current = geo; });
    getEntryPage();
  }, []);

  // Presence heartbeat for EVERY visitor (anonymous included)
  useEffect(() => {
    const updatePresence = async () => {
      // Don't write while the tab is in the background — these rows only matter
      // for "who is on the site right now".
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await supabase.from('realtime_presence').upsert({
          session_id: sessionId.current,
          current_page: location.pathname,
          page_type: getPageType(location.pathname),
          user_id: userRef.current,
          is_authenticated: !!userRef.current,
          user_agent: navigator.userAgent,
          device_type: getDeviceType(),
          entry_page: getEntryPage(),
          referrer_url: document.referrer || null,
          country: geoRef.current.country,
          region: geoRef.current.region,
          city: geoRef.current.city,
          stream_title: document.title || null,
          last_seen_at: new Date().toISOString(),
          referrer_source: getReferrerSource(),
        }, { onConflict: 'session_id' });
      } catch {
        // Silently fail
      }
    };

    const timer = setTimeout(() => {
      updatePresence();
      intervalRef.current = setInterval(updatePresence, 120000);
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [location.pathname]);

  // Click-path tracking (throttled so rapid clicking can't flood the database)
  useEffect(() => {
    let lastClickLoggedAt = 0;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('a,button,[role="button"]') as HTMLElement | null;
      if (!target) return;

      const now = Date.now();
      if (now - lastClickLoggedAt < 1500) return;
      lastClickLoggedAt = now;

      const label = (target.getAttribute('aria-label') || target.innerText || '').trim().slice(0, 120);
      const href = target.getAttribute('href');

      supabase.from('visitor_clicks').insert({
        session_id: sessionId.current,
        user_id: userRef.current,
        page_path: window.location.pathname,
        element_label: label || null,
        element_href: href || null,
        element_type: target.tagName.toLowerCase(),
        country: geoRef.current.country,
        city: geoRef.current.city,
      }).then(undefined, () => {});
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      supabase.from('realtime_presence').delete().eq('session_id', sessionId.current).then(undefined, () => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
};

// Hook for tracking blog views
export const useBlogViewTracking = (blogPostId: string | undefined) => {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!blogPostId || hasTracked.current) return;

    const trackView = async () => {
      try {
        const sessionId = getSessionId();
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('blog_views').insert({
          blog_post_id: blogPostId,
          user_id: user?.id || null,
          session_id: sessionId,
        });
        hasTracked.current = true;
      } catch {
        // silent
      }
    };
    trackView();
  }, [blogPostId]);
};

// Hook for tracking stream views
export const useStreamViewTracking = (streamId: string | undefined) => {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!streamId || hasTracked.current) return;

    const trackView = async () => {
      try {
        const sessionId = getSessionId();
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('stream_views').insert({
          stream_id: streamId,
          user_id: user?.id || null,
          session_id: sessionId,
        });
        hasTracked.current = true;
      } catch {
        // silent
      }
    };
    trackView();
  }, [streamId]);
};

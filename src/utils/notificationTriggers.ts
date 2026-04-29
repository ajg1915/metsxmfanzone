import { supabase } from "@/integrations/supabase/client";

// Helper to check if user is admin before sending admin-only notifications
const isCurrentUserAdmin = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    return !!data;
  } catch {
    return false;
  }
};

// Helper to send SMS notifications (admin only - silently skips if not admin)
const sendSMSNotification = async (message: string) => {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await supabase.functions.invoke('send-sms-notification', {
      body: { message, sendToAll: true }
    });
  } catch (error) {
    console.error('Failed to send SMS notification:', error);
  }
};

// Helper to send push notifications
const sendPushNotification = async (
  title: string, 
  body: string, 
  url: string = '/',
  tag?: string
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    await supabase.functions.invoke('send-push-notification', {
      body: {
        title,
        body,
        icon: '/logo-192.png',
        url,
        tag: tag || 'metsxm-notification'
      },
      headers: session?.access_token ? {
        'X-System-Call': 'true'
      } : undefined
    });
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
};

// Helper to send email notifications
const sendEmailNotification = async (
  title: string,
  message: string,
  notificationType: 'game_alert' | 'score_update' | 'lineup' | 'news' | 'live_stream' | 'event' | 'general',
  url?: string,
  gameInfo?: {
    opponent?: string;
    date?: string;
    time?: string;
    location?: string;
  }
) => {
  try {
    await supabase.functions.invoke('send-game-notification-email', {
      body: { title, message, notificationType, url, gameInfo }
    });
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
};

// Show browser notification if permission granted
const showBrowserNotification = (title: string, body: string, icon: string = '/logo-192.png') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon, badge: '/logo-192.png' });
  }
};

// Debounce handler to avoid rapid-fire notifications
let notificationDebounce: ReturnType<typeof setTimeout> | null = null;
const pendingNotifications: Array<() => Promise<void>> = [];

const queueNotification = (handler: () => Promise<void>) => {
  pendingNotifications.push(handler);
  if (notificationDebounce) clearTimeout(notificationDebounce);
  notificationDebounce = setTimeout(async () => {
    const batch = pendingNotifications.splice(0, pendingNotifications.length);
    for (const fn of batch) {
      await fn();
    }
  }, 2000);
};

// Route change events to appropriate handlers
const handleRealtimeEvent = (table: string, eventType: string, payload: any) => {
  const newRecord = payload.new as any;
  const oldRecord = payload.old as any;

  switch (table) {
    case 'mets_news_tracker':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '🔥 Breaking Mets News!';
          await sendPushNotification(title, newRecord.title, '/#news', 'mets-news');
          await sendSMSNotification(`🔥 Breaking Mets News: ${newRecord.title}`);
          await sendEmailNotification(title, newRecord.details || newRecord.title, 'news', '/#news');
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'live_streams':
      if (eventType === 'INSERT' && newRecord?.published && newRecord?.status === 'live') {
        queueNotification(async () => {
          const title = '🔴 LIVE NOW!';
          await sendPushNotification(title, newRecord.title, '/metsxmfanzone', 'live-stream');
          await sendSMSNotification(`🔴 LIVE NOW: ${newRecord.title}`);
          await sendEmailNotification(title, newRecord.description || newRecord.title, 'live_stream', '/metsxmfanzone');
          showBrowserNotification(title, newRecord.title);
        });
      } else if (eventType === 'UPDATE') {
        if (oldRecord?.status !== 'live' && newRecord?.status === 'live' && newRecord?.published) {
          queueNotification(async () => {
            const title = '🔴 LIVE NOW!';
            await sendPushNotification(title, newRecord.title, '/metsxmfanzone', 'live-stream');
            await sendSMSNotification(`🔴 LIVE NOW: ${newRecord.title}`);
            await sendEmailNotification(title, newRecord.description || newRecord.title, 'live_stream', '/metsxmfanzone');
            showBrowserNotification(title, newRecord.title);
          });
        } else if (oldRecord?.status === 'live' && (newRecord?.status === 'ended' || newRecord?.status === 'offline')) {
          queueNotification(async () => {
            const title = '📴 Stream Ended';
            const message = `${newRecord.title} has ended. Thanks for watching!`;
            await sendPushNotification(title, message, '/', 'stream-ended');
            showBrowserNotification(title, message);
          });
        }
      }
      break;

    case 'stream_alerts':
      if (eventType === 'UPDATE' && !oldRecord?.is_active && newRecord?.is_active) {
        queueNotification(async () => {
          const title = '⚠️ Stream Alert';
          await sendPushNotification(title, newRecord.message, '/metsxmfanzone', 'stream-alert');
          showBrowserNotification(title, newRecord.message);
        });
      }
      break;

    case 'blog_posts':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '📰 New Article Published!';
          const blogUrl = `/blog/${newRecord.slug}`;
          const message = `${newRecord.title}\n\n${newRecord.excerpt || 'Check out our latest article!'}\n\nRead it now on MetsXMFanZone Blog!`;
          await sendPushNotification(title, newRecord.title, blogUrl, 'blog-post');
          await sendSMSNotification(`📰 New Article: ${newRecord.title} - Read it at metsxmfanzone.com${blogUrl}`);
          await sendEmailNotification(title, message, 'news', blogUrl);
          showBrowserNotification(title, newRecord.title);
        });
      } else if (eventType === 'UPDATE' && !oldRecord?.published && newRecord?.published) {
        queueNotification(async () => {
          const title = '📰 New Article Published!';
          const blogUrl = `/blog/${newRecord.slug}`;
          const message = `${newRecord.title}\n\n${newRecord.excerpt || 'Check out our latest article!'}\n\nRead it now on MetsXMFanZone Blog!`;
          await sendPushNotification(title, newRecord.title, blogUrl, 'blog-post');
          await sendSMSNotification(`📰 New Article: ${newRecord.title} - Read it at metsxmfanzone.com${blogUrl}`);
          await sendEmailNotification(title, message, 'news', blogUrl);
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'events':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '📅 New Event Added!';
          await sendPushNotification(title, newRecord.title, '/events', 'event');
          await sendSMSNotification(`📅 New Event: ${newRecord.title}`);
          await sendEmailNotification(title, newRecord.description || newRecord.title, 'event', '/events', {
            date: newRecord.event_date,
            location: newRecord.location
          });
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'stories':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '📱 New Story!';
          await sendPushNotification(title, newRecord.title, '/', 'story');
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'podcasts':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '🎙️ New Podcast Episode!';
          await sendPushNotification(title, newRecord.title, '/podcast', 'podcast');
          await sendSMSNotification(`🎙️ New Podcast: ${newRecord.title}`);
          await sendEmailNotification(title, newRecord.description || newRecord.title, 'general', '/podcast');
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'podcast_live_stream':
      if (eventType === 'UPDATE' && !oldRecord?.is_live && newRecord?.is_live) {
        queueNotification(async () => {
          const title = '🎙️ Podcast LIVE NOW!';
          await sendPushNotification(title, newRecord.title, '/community-podcast', 'podcast-live');
          await sendSMSNotification(`🎙️ Podcast LIVE: ${newRecord.title}`);
          await sendEmailNotification(title, newRecord.description || newRecord.title, 'live_stream', '/community-podcast');
          showBrowserNotification(title, newRecord.title);
        });
      }
      break;

    case 'live_notifications':
      if (eventType === 'UPDATE' && !oldRecord?.is_active && newRecord?.is_active) {
        queueNotification(async () => {
          const title = '📢 Important Update!';
          await sendPushNotification(title, newRecord.message, newRecord.link_url || '/', 'announcement');
          await sendEmailNotification(title, newRecord.message, 'general', newRecord.link_url || '/');
          showBrowserNotification(title, newRecord.message);
        });
      }
      break;

    case 'lineup_cards':
      if (eventType === 'INSERT' && newRecord?.published) {
        queueNotification(async () => {
          const title = '📋 Game Lineup Posted!';
          const message = `Lineup for ${newRecord.opponent} on ${newRecord.game_date} is now available!`;
          await sendPushNotification(title, message, '/mets-lineup-card', 'lineup');
          await sendSMSNotification(`📋 ${message}`);
          await sendEmailNotification(title, message, 'lineup', '/mets-lineup-card', {
            opponent: newRecord.opponent,
            date: newRecord.game_date,
            time: newRecord.game_time,
            location: newRecord.location
          });
          showBrowserNotification(title, message);
        });
      }
      break;
  }
};

/**
 * Consolidated notification listener — uses ONE realtime channel for all tables.
 * Previously used 13+ separate channels which caused massive backend load.
 */
export const setupNotificationListeners = () => {
  const tables = [
    'mets_news_tracker',
    'live_streams',
    'stream_alerts',
    'blog_posts',
    'events',
    'stories',
    'podcasts',
    'podcast_live_stream',
    'live_notifications',
    'lineup_cards',
  ];

  let channel = supabase.channel('notifications-consolidated');

  tables.forEach(table => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => handleRealtimeEvent(table, payload.eventType, payload)
    );
  });

  channel.subscribe((status) => {
    console.log('[Notifications] Realtime status:', status);
  });

  return () => {
    supabase.removeChannel(channel);
  };
};

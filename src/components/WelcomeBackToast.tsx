import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseISO, isAfter } from "date-fns";
import { Newspaper, Radio, Zap } from "lucide-react";

interface NewContent {
  blogPosts: { title: string; slug: string }[];
  liveStreams: { title: string; status: string }[];
}

const LAST_VISIT_KEY = 'metsxm_last_visit';

export const WelcomeBackToast = () => {
  const { user } = useAuth();
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const checkAndShowWelcome = async () => {
      if (hasShown) return;

      const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
      const now = new Date();

      // Always update last visit time
      localStorage.setItem(LAST_VISIT_KEY, now.toISOString());

      // If no previous visit, this is their first time - don't show welcome back
      if (!lastVisit) return;

      const lastVisitDate = parseISO(lastVisit);
      
      // Only show if they've been away for at least 1 hour
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      if (isAfter(lastVisitDate, hourAgo)) return;

      setHasShown(true);

      try {
        // Fetch new content since last visit
        const newContent: NewContent = {
          blogPosts: [],
          liveStreams: [],
        };

        // Fetch new blog posts
        const { data: blogPosts } = await supabase
          .from('blog_posts')
          .select('title, slug')
          .eq('published', true)
          .gt('created_at', lastVisit)
          .order('created_at', { ascending: false })
          .limit(3);

        if (blogPosts) newContent.blogPosts = blogPosts;

        // Fetch active or upcoming live streams
        const { data: liveStreams } = await supabase
          .from('live_streams')
          .select('title, status')
          .eq('published', true)
          .in('status', ['live', 'scheduled'])
          .order('created_at', { ascending: false })
          .limit(2);

        if (liveStreams) newContent.liveStreams = liveStreams;

        const totalNew = newContent.blogPosts.length + newContent.liveStreams.length;

        // No new content to show
        if (totalNew === 0) return;

        // Check for live streams first - highest priority
        const hasLiveStream = newContent.liveStreams.some(s => s.status === 'live');
        
        // Try to get AI-generated message (skip if credits are depleted)
        let aiMessage: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke('generate-welcome-prompt', {
            body: { newContent }
          });
          
          if (!error && data?.message && !data?.fallback) {
            aiMessage = data.message;
          }
        } catch {
          // AI unavailable, silently use fallback
        }

        // Show the news alert toast
        if (hasLiveStream) {
          const liveStream = newContent.liveStreams.find(s => s.status === 'live');
          toast(
            <div className="flex items-center gap-3">
              <div className="relative">
                <Radio className="h-5 w-5 text-red-500" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-[#ff4500]">🔴 LIVE NOW</p>
                <p className="text-sm">{aiMessage || liveStream?.title || "A stream is live!"}</p>
              </div>
            </div>,
            {
              duration: 8000,
              action: {
                label: "Watch Live",
                onClick: () => window.location.href = "/metsxmfanzone",
              },
            }
          );
        } else if (newContent.blogPosts.length > 0) {
          toast(
            <div className="flex items-center gap-3">
              <div className="bg-[#ff4500]/20 p-2 rounded-full">
                <Newspaper className="h-5 w-5 text-[#ff4500]" />
              </div>
              <div>
                <p className="font-bold text-[#ff4500] flex items-center gap-1">
                  <Zap className="h-4 w-4" /> News Alert
                </p>
                <p className="text-sm">{aiMessage || `New: "${newContent.blogPosts[0].title}"`}</p>
              </div>
            </div>,
            {
              duration: 6000,
              action: {
                label: "Read Now",
                onClick: () => window.location.href = `/blog/${newContent.blogPosts[0].slug}`,
              },
            }
          );
        } else if (newContent.liveStreams.length > 0) {
          toast(
            <div className="flex items-center gap-3">
              <div className="bg-[#002D72]/20 p-2 rounded-full">
                <Radio className="h-5 w-5 text-[#002D72]" />
              </div>
              <div>
                <p className="font-bold text-[#002D72]">Upcoming Stream</p>
                <p className="text-sm">{aiMessage || newContent.liveStreams[0].title}</p>
              </div>
            </div>,
            {
              duration: 6000,
              action: {
                label: "View Schedule",
                onClick: () => window.location.href = "/metsxmfanzone",
              },
            }
          );
        }

      } catch (error) {
        console.error('Error fetching new content:', error);
      }
    };

    // Small delay to let the page load first
    const timer = setTimeout(checkAndShowWelcome, 1500);
    return () => clearTimeout(timer);
  }, [hasShown]);

  return null; // This component doesn't render anything visible
};

export default WelcomeBackToast;

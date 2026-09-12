import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Play, BarChart3, Heart, MessageCircle, Share2, Send, X, Trash2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { AdminEditBadge } from "@/components/admin/AdminEditBadge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getStoryBgStyle } from "@/lib/storyBackgrounds";

interface Story {
  id: string;
  title: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text';
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
  link_url: string | null;
  text_content: string | null;
  text_bg_style?: string | null;
}

interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface StoryStats {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

const StoriesSection = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [storyStats, setStoryStats] = useState<Record<string, StoryStats>>({});
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchStories();

    const refreshStories = () => {
      if (document.visibilityState === "visible") fetchStories();
    };
    const intervalId = window.setInterval(refreshStories, 20_000);
    document.addEventListener("visibilitychange", refreshStories);

    const channel = supabase
      .channel("public-stories-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => fetchStories(),
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshStories);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (stories.length > 0) {
      fetchAllStoryStats();
    }
  }, [stories, user]);

  useEffect(() => {
    if (selectedStory && showComments) {
      fetchComments(selectedStory.id);
    }
  }, [selectedStory, showComments]);

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("published", true)
        .neq("media_type", "text")
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      // Stories bucket is public — use getPublicUrl instead of signed URLs (no network requests!)
      const storiesWithUrls = (data || []).map((story) => {
        let publicMediaUrl: string | null = null;
        if (story.media_url && typeof story.media_url === 'string') {
          const fileName = story.media_url.split('/stories/')[1] || story.media_url;
          const { data: urlData } = supabase.storage
            .from('stories')
            .getPublicUrl(fileName);
          publicMediaUrl = urlData?.publicUrl || story.media_url;
        }

        let thumbnailUrl: string | null = story.thumbnail_url ?? null;
        if (thumbnailUrl && typeof thumbnailUrl === 'string') {
          const thumbFileName = thumbnailUrl.split('/stories/')[1] || thumbnailUrl;
          const { data: thumbData } = supabase.storage
            .from('stories')
            .getPublicUrl(thumbFileName);
          thumbnailUrl = thumbData?.publicUrl || thumbnailUrl;
        }

        return {
          ...story,
          media_type: (story.media_type || 'text') as 'image' | 'video' | 'text',
          media_url: publicMediaUrl,
          thumbnail_url: thumbnailUrl,
          text_content: (story as any).text_content ?? null,
          text_bg_style: (story as any).text_bg_style ?? null,
        };
      });
      setStories(storiesWithUrls);

    } catch (error) {
      console.error("Error fetching stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStoryStats = async () => {
    if (stories.length === 0) return;
    
    const storyIds = stories.map(s => s.id);
    
    // Batch fetch all likes and comments counts in single queries
    const [likesResult, commentsResult, userLikesResult] = await Promise.all([
      supabase
        .from("story_likes")
        .select("story_id")
        .in("story_id", storyIds),
      supabase
        .from("story_comments")
        .select("story_id")
        .in("story_id", storyIds),
      user 
        ? supabase
            .from("story_likes")
            .select("story_id")
            .in("story_id", storyIds)
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] })
    ]);

    // Count likes per story
    const likeCounts: Record<string, number> = {};
    (likesResult.data || []).forEach(like => {
      likeCounts[like.story_id] = (likeCounts[like.story_id] || 0) + 1;
    });

    // Count comments per story
    const commentCounts: Record<string, number> = {};
    (commentsResult.data || []).forEach(comment => {
      commentCounts[comment.story_id] = (commentCounts[comment.story_id] || 0) + 1;
    });

    // Track user's liked stories
    const userLikedStories = new Set((userLikesResult.data || []).map(l => l.story_id));

    // Build stats object
    const stats: Record<string, StoryStats> = {};
    stories.forEach(story => {
      stats[story.id] = {
        likesCount: likeCounts[story.id] || 0,
        commentsCount: commentCounts[story.id] || 0,
        isLiked: userLikedStories.has(story.id)
      };
    });
    
    setStoryStats(stats);
  };

  const fetchComments = async (storyId: string) => {
    const { data, error } = await supabase
      .from("story_comments")
      .select("*")
      .eq("story_id", storyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    // Fetch profiles for each comment
    const commentsWithProfiles = await Promise.all(
      (data || []).map(async (comment) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", comment.user_id)
          .maybeSingle();
        
        return {
          ...comment,
          profile: profile || { full_name: null, avatar_url: null }
        };
      })
    );

    setComments(commentsWithProfiles);
  };

  const handleLike = async (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast.error("Please sign in to like stories");
      return;
    }

    const currentStats = storyStats[storyId];
    const isCurrentlyLiked = currentStats?.isLiked;

    // Optimistic update
    setStoryStats(prev => ({
      ...prev,
      [storyId]: {
        ...prev[storyId],
        isLiked: !isCurrentlyLiked,
        likesCount: isCurrentlyLiked 
          ? (prev[storyId]?.likesCount || 1) - 1 
          : (prev[storyId]?.likesCount || 0) + 1
      }
    }));

    try {
      if (isCurrentlyLiked) {
        await supabase
          .from("story_likes")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("story_likes")
          .insert({ story_id: storyId, user_id: user.id });
      }
    } catch (error) {
      // Revert on error
      setStoryStats(prev => ({
        ...prev,
        [storyId]: currentStats
      }));
      toast.error("Failed to update like");
    }
  };

  const handleComment = async () => {
    if (!user) {
      toast.error("Please sign in to comment");
      return;
    }

    if (!newComment.trim() || !selectedStory) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from("story_comments")
        .insert({
          story_id: selectedStory.id,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      await fetchComments(selectedStory.id);
      
      // Update comment count
      setStoryStats(prev => ({
        ...prev,
        [selectedStory.id]: {
          ...prev[selectedStory.id],
          commentsCount: (prev[selectedStory.id]?.commentsCount || 0) + 1
        }
      }));
      
      toast.success("Comment added!");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedStory) return;
    
    try {
      const { error } = await supabase
        .from("story_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      setStoryStats(prev => ({
        ...prev,
        [selectedStory.id]: {
          ...prev[selectedStory.id],
          commentsCount: Math.max(0, (prev[selectedStory.id]?.commentsCount || 1) - 1)
        }
      }));
      
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleShare = async (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}?story=${story.id}`;
    const shareData = {
      title: story.title,
      text: `Check out this story on MetsXMFanZone: ${story.title}`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      }
    }
  };

  if (loading || stories.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full mt-2 sm:mt-3 relative">
        <AdminEditBadge to="/admin/stories" label="Edit Stories" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div 
            className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                MetsXMFanZone Feed
              </h2>
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-primary cursor-pointer hover:text-primary/80 transition-colors" onClick={async () => {
                // Clear all caches and service workers
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map(name => caches.delete(name)));
                }
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(registrations.map(r => r.unregister()));
                }
                window.location.reload();
              }} />
            </div>
            <Link 
              to="/mets-scores" 
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Mets Scores</span>
              <span className="sm:hidden">Scores</span>
            </Link>
          </div>
          
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full max-w-7xl mx-auto"
          >
            <CarouselContent className="-ml-3 md:-ml-6">
              {stories.map((story, index) => {
                const handleClick = () => {
                  if (story.link_url) {
                    window.open(story.link_url, '_blank', 'noopener,noreferrer');
                  } else {
                    setSelectedStory(story);
                    setShowComments(false);
                  }
                };

                const stats = storyStats[story.id] || { likesCount: 0, commentsCount: 0, isLiked: false };

                return (
                  <CarouselItem 
                    key={story.id} 
                    className="pl-3 md:pl-6 basis-1/2 sm:basis-1/3 lg:basis-1/4"
                  >
                    <GlassCard
                      variant="interactive"
                      glow="blue"
                      delay={index * 0.05}
                      className="h-56 sm:h-72 md:h-80 lg:h-96 cursor-pointer group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_20px_45px_-12px_hsl(var(--primary)/0.55)] hover:ring-2 hover:ring-primary/50"
                    >
                      <div 
                        className="relative w-full h-full overflow-hidden"
                        onClick={handleClick}
                      >
                        {story.media_type === 'text' || !story.media_url ? (() => {
                          const bg = getStoryBgStyle(story.text_bg_style);
                          return (
                            <div className={`w-full h-full flex items-center justify-center p-3 transition-transform duration-700 ease-out group-hover:scale-105 ${bg.className}`}>
                              <p className={`text-xs sm:text-base font-bold text-center line-clamp-6 leading-snug ${bg.textClassName || "text-foreground"}`}>
                                {story.text_content || story.title}
                              </p>
                            </div>
                          );
                        })() : (
                          <img
                            src={story.media_type === 'video' && story.thumbnail_url ? story.thumbnail_url : (story.media_url || '')}
                            alt={story.title}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          />
                        )}
                        {/* Shine sweep on hover */}
                        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-full" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent transition-opacity duration-300 group-hover:from-background/95" />
                        
                        {story.media_type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out">
                            <div className="w-12 h-12 rounded-full bg-primary/95 backdrop-blur-sm flex items-center justify-center shadow-xl ring-4 ring-primary/30">
                              <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                            </div>
                          </div>
                        )}
                        
                        
                        {/* Interactive buttons overlay */}
                        <div 
                          className="absolute top-2 right-2 flex flex-col gap-1.5 z-10"
                          onClick={e => e.stopPropagation()}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
                            onClick={(e) => handleLike(story.id, e)}
                          >
                            <Heart 
                              className={`h-4 w-4 transition-colors ${stats.isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} 
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStory(story);
                              setShowComments(true);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 text-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
                            onClick={(e) => handleShare(story, e)}
                          >
                            <Share2 className="h-4 w-4 text-foreground" />
                          </Button>
                        </div>

                        {/* Stats display */}
                        <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                          {stats.likesCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                              <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                              {stats.likesCount}
                            </span>
                          )}
                          {stats.commentsCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                              <MessageCircle className="h-3 w-3" />
                              {stats.commentsCount}
                            </span>
                          )}
                        </div>
                        
                        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                          <p className="text-foreground text-[10px] sm:text-xs font-semibold truncate">
                            {story.title}
                          </p>
                          <p className="text-muted-foreground text-[9px] sm:text-[10px]">
                            {new Date(story.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </GlassCard>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4 h-8 w-8 glass-card border-border/30 hover:border-primary/50" />
            <CarouselNext className="hidden md:flex -right-4 h-8 w-8 glass-card border-border/30 hover:border-primary/50" />
          </Carousel>
        </div>
      </div>

      <Dialog open={!!selectedStory} onOpenChange={() => { setSelectedStory(null); setShowComments(false); }}>
        <DialogContent className="w-[92vw] max-w-lg max-h-[85vh] p-0 overflow-hidden glass-card border-border/30">
          {selectedStory && (
            <div className="relative bg-background/80 w-full animate-scale-in flex flex-col max-h-[85vh]">
              {/* Media section */}
              <div className="relative flex-shrink-0">
                {selectedStory.media_type === 'text' || !selectedStory.media_url ? (() => {
                  const bg = getStoryBgStyle(selectedStory.text_bg_style);
                  return (
                    <div className={`w-full px-5 py-12 min-h-[260px] flex items-center justify-center ${bg.className}`}>
                      <p className={`text-xl sm:text-2xl font-bold text-center whitespace-pre-wrap leading-snug ${bg.textClassName || "text-foreground"}`}>
                        {selectedStory.text_content || selectedStory.title}
                      </p>
                    </div>
                  );
                })() : selectedStory.media_type === 'video' ? (
                  <video
                    src={selectedStory.media_url}
                    controls
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-auto max-h-[40vh] object-contain"
                  />
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt={selectedStory.title}
                    className="w-full h-auto max-h-[40vh] object-contain"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent p-2 sm:p-3">
                  <h3 className="text-foreground text-xs sm:text-sm font-bold truncate">
                    {selectedStory.title}
                  </h3>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={(e) => handleLike(selectedStory.id, e)}
                >
                  <Heart 
                    className={`h-5 w-5 transition-colors ${storyStats[selectedStory.id]?.isLiked ? 'fill-red-500 text-red-500' : ''}`} 
                  />
                  <span>{storyStats[selectedStory.id]?.likesCount || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center gap-2 ${showComments ? 'bg-accent' : ''}`}
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{storyStats[selectedStory.id]?.commentsCount || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={(e) => handleShare(selectedStory, e)}
                >
                  <Share2 className="h-5 w-5" />
                  <span>Share</span>
                </Button>
              </div>

              {/* Comments section */}
              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    <ScrollArea className="flex-1 max-h-[25vh] px-4 py-2">
                      {comments.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          No comments yet. Be the first to comment!
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {comments.map((comment) => (
                            <div key={comment.id} className="flex gap-2 group">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={comment.profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {comment.profile?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium truncate">
                                    {comment.profile?.full_name || 'Anonymous'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                  </span>
                                  {user?.id === comment.user_id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                      onClick={() => handleDeleteComment(comment.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                                <p className="text-sm text-foreground break-words">
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Comment input */}
                    <div className="p-3 border-t border-border/30 flex-shrink-0">
                      {user ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                            className="flex-1 text-sm"
                          />
                          <Button
                            size="icon"
                            onClick={handleComment}
                            disabled={!newComment.trim() || submittingComment}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center">
                          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to comment
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StoriesSection;
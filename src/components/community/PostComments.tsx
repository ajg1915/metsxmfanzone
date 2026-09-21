import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Trash2, MessageCircle, Image as ImageIcon, Film, X } from "lucide-react";
import { toast } from "sonner";
import GifPicker from "@/components/community/GifPicker";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
  } | null;
  isAdmin?: boolean;
}

interface PostCommentsProps {
  postId: string;
  isCurrentUserAdmin: boolean;
}

const PostComments = ({ postId, isCurrentUserAdmin }: PostCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    fetchCommentCount();
  }, [postId]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, postId]);

  const fetchCommentCount = async () => {
    const { count } = await supabase
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    setCommentCount(count || 0);
  };

  const fetchComments = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

    const { data, error } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, content, media_url, media_type, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const commentsWithProfiles = data.map((comment) => ({
        ...comment,
        profile: profiles?.find((p) => p.id === comment.user_id) || null,
        isAdmin: adminIds.has(comment.user_id),
      }));

      setComments(commentsWithProfiles);
    } else {
      setComments([]);
    }
  };

  const handleSelectGif = (gifUrl: string) => {
    setSelectedGif(gifUrl);
    setSelectedVideo(null);
    setShowGifPicker(false);
  };

  const handleSelectVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 25 * 1024 * 1024; // 25MB
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];

      if (file.size > maxSize) {
        toast.error("Video must be less than 25MB");
        return;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only MP4, WebM, and MOV videos are allowed");
        return;
      }

      setSelectedVideo(file);
      setSelectedGif(null);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) return;
    if (!newComment.trim() && !selectedGif && !selectedVideo) {
      toast.error("Add a comment, GIF, or video");
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (selectedGif) {
        mediaUrl = selectedGif;
        mediaType = "gif";
      } else if (selectedVideo) {
        setUploadingVideo(true);
        const { publicUrl } = await uploadToR2(selectedVideo, `comments/${user.id}`);
        mediaUrl = publicUrl;
        mediaType = "video";
        setUploadingVideo(false);
      }

      const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content: newComment.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
      });

      if (error) throw error;

      setNewComment("");
      setSelectedGif(null);
      setSelectedVideo(null);
      fetchComments();
      fetchCommentCount();
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
      setUploadingVideo(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      fetchComments();
      fetchCommentCount();
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowComments(!showComments)}
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="w-4 h-4 mr-1" />
        {commentCount > 0 ? `${commentCount} Comment${commentCount > 1 ? "s" : ""}` : "Comment"}
      </Button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {/* Existing comments */}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 group">
              <Avatar className="w-6 h-6 flex-shrink-0 mt-0.5">
                <AvatarFallback className="text-[10px]">
                  {comment.isAdmin
                    ? "A"
                    : comment.profile?.full_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="bg-muted/50 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">
                    {comment.isAdmin
                      ? "Admin"
                      : comment.profile?.full_name?.split(" ")[0] || "Fan"}
                  </p>
                  {comment.content && (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                  {comment.media_url && comment.media_type === "gif" && (
                    <img
                      src={comment.media_url}
                      alt="GIF"
                      className="mt-1 rounded-md max-w-[200px] max-h-[150px] object-contain"
                      loading="lazy"
                    />
                  )}
                  {comment.media_url && comment.media_type === "video" && (
                    <video
                      src={comment.media_url}
                      controls
                      className="mt-1 rounded-md max-w-full max-h-[200px]"
                      preload="metadata"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 px-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {(comment.user_id === user?.id || isCurrentUserAdmin) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* New comment input */}
          {user && (
            <div className="space-y-2">
              {/* Media preview */}
              {selectedGif && (
                <div className="relative inline-block">
                  <img
                    src={selectedGif}
                    alt="Selected GIF"
                    className="rounded-md max-w-[150px] max-h-[100px] object-contain"
                  />
                  <button
                    onClick={() => setSelectedGif(null)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedVideo && (
                <div className="relative inline-block">
                  <div className="bg-muted rounded-md px-3 py-2 flex items-center gap-2 text-sm">
                    <Film className="w-4 h-4 text-primary" />
                    <span className="truncate max-w-[200px]">{selectedVideo.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="text-sm h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  {/* GIF button - available to all users */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-primary"
                    onClick={() => setShowGifPicker(!showGifPicker)}
                    title="Add GIF"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>

                  {/* Video button - admin only */}
                  {isCurrentUserAdmin && (
                    <>
                      <Input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleSelectVideo}
                        className="hidden"
                        id={`video-upload-${postId}`}
                      />
                      <label htmlFor={`video-upload-${postId}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-primary"
                          asChild
                          title="Add Video (Admin)"
                        >
                          <span className="cursor-pointer">
                            <Film className="w-4 h-4" />
                          </span>
                        </Button>
                      </label>
                    </>
                  )}

                  <Button
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleSubmitComment}
                    disabled={submitting || uploadingVideo || (!newComment.trim() && !selectedGif && !selectedVideo)}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {showGifPicker && (
                <GifPicker onSelect={handleSelectGif} onClose={() => setShowGifPicker(false)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostComments;

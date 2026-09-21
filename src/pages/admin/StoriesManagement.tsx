import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Eye, EyeOff, Image as ImageIcon, Video, Sparkles, Download, FileText, Link2, Share2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateFile, generateSafeFilename, FileType } from "@/utils/fileValidation";
import { SocialShareDialog } from "@/components/SocialShareDialog";
import { STORY_BG_STYLES, getStoryBgStyle } from "@/lib/storyBackgrounds";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
}

interface Story {
  id: string;
  title: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text';
  thumbnail_url: string | null;
  duration: number | null;
  display_order: number;
  published: boolean;
  created_at: string;
  link_url: string | null;
  blog_post_id: string | null;
  text_content: string | null;
  text_bg_style?: string | null;
}

const MAX_STORY_VIDEO_MB = 25;
const MAX_STORY_IMAGE_MB = 10;

const getUploadErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("jwt") || normalized.includes("unauthorized") || normalized.includes("not authenticated")) {
    return "Your sign-in expired. Sign in again, then retry the upload.";
  }
  if (normalized.includes("row-level security") || normalized.includes("policy")) {
    return "Your account does not have permission to upload this video. Sign in with an admin account.";
  }
  if (normalized.includes("maximum allowed size") || normalized.includes("too large") || normalized.includes("payload too large")) {
    return `This video is too large. Choose a video under ${MAX_STORY_VIDEO_MB}MB.`;
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("timeout")) {
    return "The upload lost its connection. Keep this page open and try again on a stable connection.";
  }

  return message || "The video could not be uploaded. Please try again.";
};

const StoriesManagement = () => {
  const { toast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkType, setLinkType] = useState<"blog" | "custom">("blog");
  const [textOnlyMode, setTextOnlyMode] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    display_order: 0,
    published: true,
    link_url: "",
    blog_post_id: "",
    text_content: "",
    text_bg_style: "gradient",
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);

  // AI Image Generation states
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareStory, setShareStory] = useState<Story | null>(null);

  useEffect(() => {
    fetchStories();
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBlogPosts(data || []);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
    }
  };

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStories((data || []).map(story => ({
        ...story,
        media_type: story.media_type as 'image' | 'video'
      })));
    } catch (error) {
      console.error("Error fetching stories:", error);
      toast({
        title: "Error",
        description: "Failed to fetch stories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasText = formData.text_content.trim().length > 0;

    if (!mediaFile && !editingStory && !hasText) {
      toast({
        title: "Error",
        description: "Add a media file or text content",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("Not authenticated");
      }

      let mediaUrl: string | null = editingStory?.media_url || null;
      let thumbnailUrl = editingStory?.thumbnail_url || null;
      let mediaType: 'image' | 'video' | 'text' =
        (editingStory?.media_type as any) || "image";

      if (mediaFile) {
        mediaType = mediaFile.type.startsWith("video/") ? "video" : "image";
        const { publicUrl } = await uploadToR2(mediaFile, "stories");
        mediaUrl = publicUrl;
      } else if (!editingStory && hasText) {
        // Brand new text-only story
        mediaType = "text";
        mediaUrl = null;
      } else if (editingStory && hasText && !editingStory.media_url) {
        mediaType = "text";
        mediaUrl = null;
      }

      if (thumbnailFile) {
        const { publicUrl } = await uploadToR2(thumbnailFile, "stories/thumbnails");
        thumbnailUrl = publicUrl;
      }

      // Determine link_url based on link type
      let finalLinkUrl = null;
      if (linkType === "blog" && formData.blog_post_id) {
        const selectedBlog = blogPosts.find(b => b.id === formData.blog_post_id);
        if (selectedBlog) {
          finalLinkUrl = `/blog/${selectedBlog.slug}`;
        }
      } else if (linkType === "custom" && formData.link_url) {
        finalLinkUrl = formData.link_url;
      }

      const storyData = {
        title: formData.title,
        media_url: mediaUrl,
        media_type: mediaType,
        thumbnail_url: thumbnailUrl,
        display_order: formData.display_order,
        published: formData.published,
        link_url: finalLinkUrl,
        blog_post_id: linkType === "blog" ? formData.blog_post_id || null : null,
        text_content: hasText ? formData.text_content.trim() : null,
        text_bg_style: mediaType === "text" ? formData.text_bg_style : null,
      };

      if (editingStory) {
        const { error } = await supabase
          .from("stories")
          .update(storyData)
          .eq("id", editingStory.id);

        if (error) throw error;
        
        // Send push notification if story was just published
        if (storyData.published && !editingStory.published) {
          sendStoryNotification(storyData.title);
        }
        toast({ title: "Success", description: "Story updated successfully" });
      } else {
        const { error } = await supabase.from("stories").insert(storyData);

        if (error) throw error;
        
        // Send push notification if new story is published
        if (storyData.published) {
          sendStoryNotification(storyData.title);
        }
        toast({ title: "Success", description: "Story created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchStories();
    } catch (error: any) {
      console.error("Error saving story:", error);
      toast({
        title: "Upload failed",
        description: getUploadErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, mediaUrl: string | null) => {
    if (!confirm("Are you sure you want to delete this story?")) return;

    try {
      if (mediaUrl) {
        const fileName = mediaUrl.split('/stories/')[1] || mediaUrl;
        await supabase.storage.from("stories").remove([fileName]);
      }

      const { error } = await supabase.from("stories").delete().eq("id", id);

      if (error) throw error;

      toast({ title: "Success", description: "Story deleted successfully" });
      fetchStories();
    } catch (error: any) {
      console.error("Error deleting story:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendStoryNotification = async (title: string) => {
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "📸 New Story on MetsXMFanZone!",
          body: title,
          icon: "/logo-192.png",
          url: "/",
          tag: "new-story",
        },
      });
    } catch (error) {
      console.debug("Push notification error:", error);
    }
  };

  const togglePublished = async (story: Story) => {
    try {
      const { error } = await supabase
        .from("stories")
        .update({ published: !story.published })
        .eq("id", story.id);

      if (error) throw error;

      // Send notification when publishing
      if (!story.published) {
        sendStoryNotification(story.title);
      }

      toast({
        title: "Success",
        description: `Story ${!story.published ? "published" : "unpublished"}`,
      });
      fetchStories();
    } catch (error: any) {
      console.error("Error updating story:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (story: Story) => {
    setEditingStory(story);
    setFormData({
      title: story.title,
      display_order: story.display_order,
      published: story.published,
      link_url: story.link_url || "",
      blog_post_id: story.blog_post_id || "",
      text_content: story.text_content || "",
      text_bg_style: story.text_bg_style || "gradient",
    });
    // Set link type based on existing data
    setLinkType(story.blog_post_id ? "blog" : "custom");
    setIsDialogOpen(true);
  };

  const generateVideoFrames = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames: string[] = [];
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const frameTimes = [
          duration * 0.1,
          duration * 0.3,
          duration * 0.5,
          duration * 0.7,
          duration * 0.9
        ];
        
        let currentFrameIndex = 0;
        
        const captureFrame = () => {
          if (currentFrameIndex >= frameTimes.length) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }
          
          video.currentTime = frameTimes[currentFrameIndex];
        };
        
        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              frames.push(URL.createObjectURL(blob));
              currentFrameIndex++;
              captureFrame();
            }
          }, 'image/jpeg', 0.8);
        };
        
        captureFrame();
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video'));
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const handleMediaFileChange = async (file: File | null) => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    }
    
    videoFrames.forEach(frame => URL.revokeObjectURL(frame));
    setVideoFrames([]);
    setSelectedFrameIndex(0);
    
    if (!file) {
      setMediaFile(null);
      return;
    }
    
    // Determine file type and validate
    const fileType: FileType = file.type.startsWith('video/') ? 'video' : 'image';
    const maxSize = fileType === 'video' ? MAX_STORY_VIDEO_MB : MAX_STORY_IMAGE_MB;
    
    const validation = await validateFile(file, fileType, maxSize);
    if (!validation.valid) {
      toast({
        title: "Error",
        description: validation.error || "Invalid file",
        variant: "destructive",
      });
      return;
    }
    
    setMediaFile(file);
    
    if (file.type.startsWith('image/')) {
      setMediaPreview(URL.createObjectURL(file));
    } else if (file.type.startsWith('video/')) {
      try {
        const frames = await generateVideoFrames(file);
        setVideoFrames(frames);
        setMediaPreview(frames[0]);
      } catch (error) {
        console.error('Error generating video frames:', error);
      }
    }
  };

  const handleFrameSelect = async (index: number) => {
    setSelectedFrameIndex(index);
    setMediaPreview(videoFrames[index]);
    
    const response = await fetch(videoFrames[index]);
    const blob = await response.blob();
    const file = new File([blob], `thumbnail_${Date.now()}.jpg`, { type: 'image/jpeg' });
    setThumbnailFile(file);
    setThumbnailPreview(videoFrames[index]);
  };

  const handleThumbnailFileChange = async (file: File | null) => {
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
      setThumbnailPreview(null);
    }
    
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    
    // Validate thumbnail as image
    const validation = await validateFile(file, 'image', 5);
    if (!validation.valid) {
      toast({
        title: "Error",
        description: validation.error || "Invalid thumbnail",
        variant: "destructive",
      });
      return;
    }
    
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setFormData({ title: "", display_order: 0, published: true, link_url: "", blog_post_id: "", text_content: "", text_bg_style: "gradient" });
    setLinkType("blog");
    setMediaFile(null);
    setThumbnailFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    videoFrames.forEach(frame => URL.revokeObjectURL(frame));
    setMediaPreview(null);
    setThumbnailPreview(null);
    setVideoFrames([]);
    setSelectedFrameIndex(0);
    setEditingStory(null);
    setTextOnlyMode(false);
  };

  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-story-image", {
        body: { prompt: aiPrompt },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedImageUrl(data.imageUrl);
      toast({
        title: "Success",
        description: "Image generated! Click 'Use Image' to add it as a story.",
      });
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleUseGeneratedImage = async () => {
    if (!generatedImageUrl) return;

    try {
      // Convert base64 to blob
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `ai_generated_${Date.now()}.png`, { type: 'image/png' });

      // Upload to Supabase storage
      const fileName = `ai_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create story with the generated image
      const storyData = {
        title: aiPrompt.slice(0, 50) + (aiPrompt.length > 50 ? "..." : ""),
        media_url: fileName,
        media_type: "image",
        thumbnail_url: null,
        display_order: 0,
        published: false,
        link_url: null,
      };

      const { error } = await supabase.from("stories").insert(storyData);
      if (error) throw error;

      toast({ title: "Success", description: "AI-generated story created!" });
      
      // Reset AI generator
      setAiPrompt("");
      setGeneratedImageUrl(null);
      fetchStories();
    } catch (error: any) {
      console.error("Error saving generated image:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadGeneratedImage = async () => {
    if (!generatedImageUrl) return;

    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai_generated_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Image downloaded!" });
    } catch (error: any) {
      console.error("Error downloading image:", error);
      toast({
        title: "Error",
        description: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-full px-2 py-3 space-y-4 overflow-x-hidden">
      <div className="flex justify-between items-center">
        <h1 className="text-lg sm:text-xl font-bold">Stories</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              resetForm();
              setTextOnlyMode(true);
              setIsDialogOpen(true);
            }}
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Add Text
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => setTextOnlyMode(false)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-xs sm:max-w-sm p-3 gap-2">
              <DialogHeader>
                <DialogTitle>{editingStory ? "Edit Story" : textOnlyMode ? "Add Text Story" : "Add New Story"}</DialogTitle>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              {!textOnlyMode && (
                <div>
                  <Label htmlFor="media">Media File (Optional — leave empty for text-only post)</Label>
                  <Input
                    id="media"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    MP4, MOV, or WebM video up to {MAX_STORY_VIDEO_MB}MB. Images up to {MAX_STORY_IMAGE_MB}MB.
                  </p>
                  {mediaFile && (
                    <p className="mt-1 text-xs font-medium text-foreground">
                      Selected: {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(1)}MB)
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="text_content">Text Content {textOnlyMode ? "" : "(Optional)"}</Label>
                <Textarea
                  id="text_content"
                  placeholder="Write a text-only update for the feed..."
                  value={formData.text_content}
                  onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                  className="min-h-[100px] text-sm"
                  required={textOnlyMode}
                />
              </div>

              {(textOnlyMode || (!mediaFile && !editingStory?.media_url && formData.text_content.trim().length > 0)) && (
                <div>
                  <Label className="text-xs">Background Style</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {STORY_BG_STYLES.map((s) => {
                      const active = formData.text_bg_style === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, text_bg_style: s.id })}
                          className={`relative h-16 rounded-md overflow-hidden border-2 transition-all ${s.className} ${active ? "border-primary ring-2 ring-primary/40" : "border-border/40 hover:border-primary/50"}`}
                          title={s.label}
                        >
                          <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${s.textClassName || "text-foreground"}`}>
                            Aa
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className={`mt-2 rounded-lg p-4 min-h-[100px] flex items-center justify-center ${getStoryBgStyle(formData.text_bg_style).className}`}>
                    <p className={`text-center font-bold text-base leading-snug whitespace-pre-wrap ${getStoryBgStyle(formData.text_bg_style).textClassName || "text-foreground"}`}>
                      {formData.text_content}
                    </p>
                  </div>
                </div>
              )}


              <div className="hidden">{/* legacy preview slot */}</div>
              <div>

                {mediaPreview && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-border">
                    <img 
                      src={mediaPreview} 
                      alt="Media preview" 
                       className="w-full h-36 sm:h-40 max-h-[30vh] object-cover"
                    />
                  </div>
                )}
                
                {videoFrames.length > 0 && (
                  <div className="mt-3">
                    <Label className="text-sm">Select Thumbnail Frame</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {videoFrames.map((frame, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleFrameSelect(index)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                            selectedFrameIndex === index 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <img 
                            src={frame} 
                            alt={`Frame ${index + 1}`}
                            className="w-full h-16 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Link Story To (Optional)</Label>
                <Tabs value={linkType} onValueChange={(v) => setLinkType(v as "blog" | "custom")} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="blog" className="text-xs flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Blog Post
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5" />
                      Custom URL
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="blog" className="mt-2">
                    <Select
                      value={formData.blog_post_id || "__none__"}
                      onValueChange={(value) => setFormData({ ...formData, blog_post_id: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a blog post" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="__none__">None</SelectItem>
                        {blogPosts.map((post) => (
                          <SelectItem key={post.id} value={post.id}>
                            {post.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="custom" className="mt-2">
                    <Input
                      type="url"
                      placeholder="https://example.com/article"
                      value={formData.link_url}
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label htmlFor="published">Published</Label>
              </div>

              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? "Uploading..." : editingStory ? "Update Story" : "Create Story"}
              </Button>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {/* AI Image Generator Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Image Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Create unique story images using AI. Describe what you want to see!
          </p>
          
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., A dramatic baseball scene with the New York Mets celebrating a home run at Citi Field under stadium lights..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isGeneratingImage}
              className="min-h-[80px] text-sm"
            />
            
            <Button
              onClick={handleGenerateImage}
              disabled={!aiPrompt.trim() || isGeneratingImage}
              className="w-full sm:w-auto"
              size="sm"
            >
              {isGeneratingImage ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
          
          {generatedImageUrl && (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg overflow-hidden border-2 border-primary/30">
                <img
                  src={generatedImageUrl}
                  alt="AI generated"
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadGeneratedImage}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={handleUseGeneratedImage}
                  variant="default"
                  size="sm"
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Use as Story
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">Loading stories...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{story.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {story.media_type === 'video' ? (
                        <Video className="w-4 h-4 text-primary" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-sm text-muted-foreground capitalize">
                        {story.media_type}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(story.created_at).toLocaleDateString()}
                    </div>
                    {story.blog_post_id && (
                      <div className="flex items-center gap-1 mt-1">
                        <FileText className="w-3 h-3 text-primary" />
                        <span className="text-xs text-primary">
                          Linked to blog
                        </span>
                      </div>
                    )}
                    {story.link_url && (
                      <a 
                        href={story.link_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 block truncate"
                      >
                        {story.blog_post_id ? "View Blog Post →" : "View Article →"}
                      </a>
                    )}
                  </div>
                  <Button
                    variant={story.published ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePublished(story)}
                  >
                    {story.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(story)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShareStory(story); setShareDialogOpen(true); }}
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    Share
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(story.id, story.media_url)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && stories.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No stories yet. Create your first story!
          </CardContent>
        </Card>
      )}
      {shareStory && (
        <SocialShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          storyId={shareStory.id}
          storyTitle={shareStory.title}
          mediaUrl={shareStory.media_url || ''}
        />
      )}
    </div>
  );
};

export default StoriesManagement;

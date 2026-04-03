import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, FileText, Sparkles, Upload, Music, Copy, CheckCircle, XCircle, Clock, ShieldAlert, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { validateFile, generateSafeFilename } from "@/utils/fileValidation";

const blogPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200, "Title must be less than 200 characters"),
  slug: z.string().trim().max(250, "Slug too long").regex(/^[a-z0-9-]*$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  content: z.string().trim().min(10, "Content must be at least 10 characters").max(50000, "Content must be less than 50,000 characters"),
  excerpt: z.string().trim().max(500, "Excerpt must be less than 500 characters").optional(),
  featured_image_url: z.string().trim().max(2000, "Image URL too long").optional(),
  category: z.string().trim().min(1, "Category is required").max(100, "Category too long"),
  tags: z.string().trim().max(200, "Tags must be less than 200 characters").optional(),
  published: z.boolean(),
});

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url?: string;
  audio_url?: string;
  category: string;
  tags: string[];
  published: boolean;
  published_at?: string;
  created_at: string;
  approval_status?: string;
  user_id?: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function BlogManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const formInitialized = useRef(false);

  const ADMIN_DRAFT_KEY = "admin-blog-draft";

  const defaultFormData = {
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    featured_image_url: "",
    audio_url: "",
    category: "General",
    tags: "",
    published: false,
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingExcerpt, setGeneratingExcerpt] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [checkingAI, setCheckingAI] = useState<string | null>(null);
  const [aiCheckResult, setAiCheckResult] = useState<{
    postId: string;
    isPlagiarized: boolean;
    originalityScore: number;
    brandVoiceScore: number;
    overallScore: number;
    summary: string;
    plagiarismFlags: string[];
    grammarIssues: any[];
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<BlogPost | null>(null);

  // Auto-save draft to localStorage
  const saveDraft = useCallback(() => {
    if (editingPost || !formInitialized.current) return;
    if (!formData.title && !formData.content) return;
    try {
      localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify({ ...formData, savedAt: Date.now() }));
    } catch {}
  }, [formData, editingPost]);

  useEffect(() => {
    if (editingPost) return;
    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(interval);
  }, [saveDraft, editingPost]);

  useEffect(() => {
    if (editingPost) return;
    const handleBeforeUnload = () => saveDraft();
    const handleVisibility = () => { if (document.visibilityState === 'hidden') saveDraft(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveDraft, editingPost]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(ADMIN_DRAFT_KEY); } catch {}
  }, []);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000) {
          setFormData({
            title: draft.title || "",
            slug: draft.slug || "",
            content: draft.content || "",
            excerpt: draft.excerpt || "",
            featured_image_url: draft.featured_image_url || "",
            audio_url: draft.audio_url || "",
            category: draft.category || "General",
            tags: draft.tags || "",
            published: draft.published || false,
          });
          setDraftRestored(true);
          setIsDialogOpen(true);
        }
      }
    } catch {}
    formInitialized.current = true;
  }, []);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Failed to load blog posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (post: BlogPost) => {
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ 
          approval_status: "approved", 
          published: true,
          published_at: new Date().toISOString()
        })
        .eq("id", post.id);

      if (error) throw error;

      // Send push notification for the published article
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            title: "📰 New Article on MetsXMFanZone!",
            body: post.title,
            url: `/blog/${post.slug}`,
            icon: "/logo-192.png",
            tag: `blog-${post.id}`,
          },
        });
      } catch (pushErr) {
        console.error("Push notification failed:", pushErr);
      }

      toast({
        title: "Approved & Published",
        description: "Article has been approved and is now live on the blog.",
      });
      fetchPosts();
    } catch (error) {
      console.error("Error approving:", error);
      toast({
        title: "Error",
        description: "Failed to approve article",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (post: BlogPost) => {
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ approval_status: "rejected", published: false })
        .eq("id", post.id);

      if (error) throw error;

      toast({
        title: "Rejected",
        description: "Article has been rejected.",
      });
      fetchPosts();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({
        title: "Error",
        description: "Failed to reject article",
        variant: "destructive",
      });
    }
  };

  const handleCheckAI = async (post: BlogPost) => {
    if (!post.content || post.content.length < 50) {
      toast({
        title: "Error",
        description: "Article content is too short to analyze",
        variant: "destructive",
      });
      return;
    }

    setCheckingAI(post.id);
    try {
      const { data, error } = await supabase.functions.invoke('check-ai-content', {
        body: { content: post.content, title: post.title }
      });

      if (error) throw error;

      if (data.isPlagiarized || data.originalityScore < 50) {
        setAiCheckResult({
          postId: post.id,
          isPlagiarized: data.isPlagiarized,
          originalityScore: data.originalityScore,
          brandVoiceScore: data.brandVoiceScore,
          overallScore: data.overallScore,
          summary: data.summary,
          plagiarismFlags: data.plagiarismFlags || [],
          grammarIssues: data.grammarIssues || [],
          strengths: data.strengths || [],
          improvements: data.improvements || [],
        });
        setRevokeTarget(post);
        setShowRevokeDialog(true);
      } else {
        toast({
          title: "Content Verified ✓",
          description: `Originality: ${data.originalityScore}% · Brand Voice: ${data.brandVoiceScore}% · Overall: ${data.overallScore}%`,
        });
      }
    } catch (error: any) {
      console.error("Error checking AI content:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to check article content",
        variant: "destructive",
      });
    } finally {
      setCheckingAI(null);
    }
  };

  const handleRevokeWriter = async () => {
    if (!revokeTarget || !aiCheckResult) return;

    try {
      // 1. Delete the article
      const { error: deleteError } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", revokeTarget.id);

      if (deleteError) throw deleteError;

      // 2. Remove writer role from user
      if (revokeTarget.user_id) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", revokeTarget.user_id)
          .eq("role", "writer");

        if (roleError) {
          console.error("Error removing writer role:", roleError);
        }
      }

      // 3. Send revocation email
      const writerName = revokeTarget.profiles?.full_name || revokeTarget.profiles?.email || "Writer";
      const writerEmail = revokeTarget.profiles?.email;

      if (writerEmail) {
        const reasons: string[] = [];
        if (aiCheckResult.isPlagiarized) {
          reasons.push("Content appears to be plagiarized or copied from other sources");
        }
        if (aiCheckResult.originalityScore < 50) {
          reasons.push(`Low originality score: ${aiCheckResult.originalityScore}%`);
        }
        if (aiCheckResult.plagiarismFlags.length > 0) {
          reasons.push(...aiCheckResult.plagiarismFlags);
        }

        await supabase.functions.invoke('send-writer-revoked-email', {
          body: {
            email: writerEmail,
            name: writerName,
            articleTitle: revokeTarget.title,
            reasons
          }
        });
      }

      toast({
        title: "Writer Access Revoked",
        description: "Article deleted, writer role removed, and notification email sent.",
      });

      setShowRevokeDialog(false);
      setRevokeTarget(null);
      setAiCheckResult(null);
      fetchPosts();
    } catch (error: any) {
      console.error("Error revoking writer:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to revoke writer access",
        variant: "destructive",
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      // Validate form data with Zod
      const validationResult = blogPostSchema.safeParse(formData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
        return;
      }

      const slug = formData.slug || generateSlug(formData.title);
      
      // Validate individual tags
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(t => t);
      if (tagsArray.some(tag => tag.length > 50)) {
        toast({
          title: "Validation Error",
          description: "Individual tags must be less than 50 characters",
          variant: "destructive",
        });
        return;
      }
      
      const postData = {
        ...formData,
        slug,
        tags: tagsArray,
        user_id: user.id,
        published_at: formData.published ? new Date().toISOString() : null,
      };

      if (editingPost) {
        const { error } = await supabase
          .from("blog_posts")
          .update(postData)
          .eq("id", editingPost.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Blog post updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("blog_posts")
          .insert([postData]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Blog post created successfully",
        });
      }

      clearDraft();
      setIsDialogOpen(false);
      resetForm();
      fetchPosts();
    } catch (error: any) {
      console.error("Error saving post:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save blog post",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || "",
      featured_image_url: post.featured_image_url || "",
      audio_url: post.audio_url || "",
      category: post.category,
      tags: post.tags.join(", "),
      published: post.published,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const { error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
      
      fetchPosts();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete blog post",
        variant: "destructive",
      });
    }
  };

  const handleGenerateContent = async () => {
    if (!formData.title) {
      toast({
        title: "Error",
        description: "Please enter a blog title first",
        variant: "destructive",
      });
      return;
    }

    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-blog-content', {
        body: { 
          title: formData.title,
          category: formData.category,
          excerpt: formData.excerpt
        }
      });

      if (error) throw error;

      if (data?.content) {
        setFormData({ ...formData, content: data.content });
        toast({
          title: "Success",
          description: "Article content generated successfully!",
        });
      }
    } catch (error: any) {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleGenerateExcerpt = async () => {
    if (!formData.title && !formData.content) {
      toast({
        title: "Error",
        description: "Please enter a title or content first to generate an excerpt",
        variant: "destructive",
      });
      return;
    }

    setGeneratingExcerpt(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-excerpt', {
        body: { 
          title: formData.title,
          content: formData.content,
          category: formData.category
        }
      });

      if (error) throw error;

      if (data?.excerpt) {
        setFormData({ ...formData, excerpt: data.excerpt });
        toast({
          title: "Success",
          description: "Excerpt generated successfully!",
        });
      }
    } catch (error: any) {
      console.error("Error generating excerpt:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate excerpt",
        variant: "destructive",
      });
    } finally {
      setGeneratingExcerpt(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Comprehensive file validation
    const validation = await validateFile(file, 'image', 5);
    if (!validation.valid) {
      toast({
        title: "Error",
        description: validation.error || "Invalid file",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileName = generateSafeFilename(file.name);
      const filePath = `blog-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content_uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content_uploads')
        .getPublicUrl(filePath);

      setFormData({ ...formData, featured_image_url: publicUrl });
      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Comprehensive file validation
    const validation = await validateFile(file, 'audio', 50);
    if (!validation.valid) {
      toast({
        title: "Error",
        description: validation.error || "Invalid file",
        variant: "destructive",
      });
      return;
    }

    setUploadingAudio(true);
    try {
      const fileName = generateSafeFilename(file.name);
      const filePath = `blog-audio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('podcasts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('podcasts')
        .getPublicUrl(filePath);

      setFormData({ ...formData, audio_url: publicUrl });
      toast({
        title: "Success",
        description: "Audio uploaded successfully!",
      });
    } catch (error: any) {
      console.error("Error uploading audio:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload audio",
        variant: "destructive",
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const resetForm = () => {
    setEditingPost(null);
    setFormData(defaultFormData);
    setDraftRestored(false);
    clearDraft();
  };

  const handleCopyForSharing = async (post: BlogPost) => {
    // Format content for sharing on other platforms
    const shareContent = `${post.title}

${post.excerpt || ""}

${post.content}

${post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : ""}
`.trim();

    try {
      await navigator.clipboard.writeText(shareContent);
      toast({
        title: "Copied!",
        description: "Article copied to clipboard - ready to paste on other platforms",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden px-1">
      <div className="flex justify-between items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-primary" />
          <h1 className="text-sm sm:text-base font-bold">Blog Management</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-[10px] px-2">
              <Plus className="w-3 h-3 mr-1" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-3 sm:p-4">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm sm:text-base">{editingPost ? "Edit Post" : "Create New Post"}</DialogTitle>
              <DialogDescription className="text-[10px] sm:text-xs">
                {editingPost ? "Update your blog post" : "Create a new blog post"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-2">
              {draftRestored && !editingPost && (
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-[10px]">
                  <span className="text-foreground">✨ Draft restored.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(true);
                    }}
                  >
                    Discard Draft
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="sm:col-span-2 space-y-0.5">
                  <Label htmlFor="title" className="text-[10px]">Title</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className="h-7 text-[11px]" />
                </div>
                
                <div className="space-y-0.5">
                  <Label htmlFor="slug" className="text-[10px]">Slug (URL)</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="Auto-generated" className="h-7 text-[11px]" />
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="category" className="text-[10px]">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="h-7 text-[11px]" />
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <Label htmlFor="tags" className="text-[10px]">Tags (comma separated)</Label>
                  <Input id="tags" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="sports, baseball, news" className="h-7 text-[11px]" />
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="excerpt" className="text-[10px]">Excerpt</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={handleGenerateExcerpt} disabled={generatingExcerpt || (!formData.title && !formData.content)} className="h-5 text-[9px] px-1">
                      {generatingExcerpt ? <><Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />Gen...</> : <><Sparkles className="h-2.5 w-2.5 mr-0.5" />Auto</>}
                    </Button>
                  </div>
                  <Textarea id="excerpt" value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} rows={2} className="text-[11px] min-h-[40px]" placeholder="Brief summary..." />
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <Label htmlFor="featured_image" className="text-[10px]">Featured Image URL</Label>
                  <Input id="featured_image" value={formData.featured_image_url} onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })} placeholder="https://..." className="h-7 text-[11px]" />
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input id="image_upload" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="cursor-pointer text-[10px] h-7" />
                    {uploadingImage && <Upload className="w-2.5 h-2.5 animate-pulse" />}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <Label htmlFor="audio_url" className="text-[10px]">Audio (Listen Version)</Label>
                  <Input id="audio_url" value={formData.audio_url} onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })} placeholder="https://... or upload" className="h-7 text-[11px]" />
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input id="audio_upload" type="file" accept="audio/*" onChange={handleAudioUpload} disabled={uploadingAudio} className="cursor-pointer text-[10px] h-7" />
                    {uploadingAudio && <Music className="w-2.5 h-2.5 animate-pulse" />}
                  </div>
                  {formData.audio_url && (
                    <audio controls className="w-full h-7 mt-0.5"><source src={formData.audio_url} type="audio/mpeg" /></audio>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content" className="text-[10px]">Content</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateContent} disabled={generatingContent || !formData.title} className="h-5 text-[9px] px-1">
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                      {generatingContent ? "Gen..." : "AI Generate"}
                    </Button>
                  </div>
                  <Textarea id="content" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={6} required className="text-[11px] font-mono min-h-[80px]" />
                </div>

                <div className="sm:col-span-2 flex items-center space-x-1.5 pt-1">
                  <Switch id="published" checked={formData.published} onCheckedChange={(checked) => setFormData({ ...formData, published: checked })} className="scale-75" />
                  <Label htmlFor="published" className="text-[10px]">Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} className="h-7 text-[10px]">Cancel</Button>
                <Button type="submit" size="sm" className="h-7 text-[10px]">{editingPost ? "Update" : "Create"} Post</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-1.5">
        {posts.length === 0 ? (
          <Card className="border-border/30">
            <CardContent className="py-4 text-center text-[10px] text-muted-foreground">
              No blog posts yet. Create your first post!
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className={`border-border/30 ${post.approval_status === "pending" ? "border-yellow-500/50" : ""}`}>
              <CardContent className="p-2 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <FileText className="w-3 h-3 flex-shrink-0 text-primary" />
                      <span className="text-[11px] font-medium truncate">{post.title}</span>
                      {post.approval_status === "pending" && (
                        <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 py-0 rounded flex items-center gap-0.5">
                          <Clock className="w-2 h-2" /> Pending
                        </span>
                      )}
                      {post.approval_status === "approved" && post.published && (
                        <span className="text-[8px] bg-green-500 text-white px-1 py-0 rounded">Published</span>
                      )}
                      {post.approval_status === "approved" && !post.published && (
                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 py-0 rounded">Approved</span>
                      )}
                      {post.approval_status === "rejected" && (
                        <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0 rounded">Rejected</span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {post.category} • {new Date(post.created_at).toLocaleDateString()}
                      {post.profiles && <span> • {post.profiles.full_name || post.profiles.email}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" className="h-6 px-1 text-[8px] text-yellow-500 border-yellow-500/50" onClick={() => handleCheckAI(post)} disabled={checkingAI === post.id}>
                      {checkingAI === post.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                    </Button>
                    {post.approval_status === "pending" && (
                      <>
                        <Button variant="outline" size="sm" className="h-6 px-1 text-green-500 border-green-500/50" onClick={() => handleApprove(post)}>
                          <CheckCircle className="w-2.5 h-2.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-1 text-red-500 border-red-500/50" onClick={() => handleReject(post)}>
                          <XCircle className="w-2.5 h-2.5" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="h-6 px-1" onClick={() => handleCopyForSharing(post)}><Copy className="w-2.5 h-2.5" /></Button>
                    <Button variant="outline" size="sm" className="h-6 px-1" onClick={() => handleEdit(post)}><Edit className="w-2.5 h-2.5" /></Button>
                    <Button variant="destructive" size="sm" className="h-6 px-1" onClick={() => handleDelete(post.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground line-clamp-1">
                  {post.excerpt || post.content.substring(0, 100)}...
                </p>
                {post.tags.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap">
                    {post.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[8px] bg-muted px-1 py-0 rounded">{tag}</span>
                    ))}
                    {post.tags.length > 4 && <span className="text-[8px] text-muted-foreground">+{post.tags.length - 4}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* AI Detection Revocation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-sm p-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              AI/Plagiarism Detected
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>This article has been flagged for the following issues:</p>
                
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
                  {aiCheckResult?.isPlagiarized && (
                    <p className="text-red-400 font-medium">• Plagiarized Content Detected</p>
                  )}
                  {aiCheckResult?.originalityScore !== undefined && aiCheckResult.originalityScore < 50 && (
                    <p className="text-red-400 font-medium">• Low Originality Score: {aiCheckResult.originalityScore}%</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Originality: {aiCheckResult?.originalityScore}% · Brand Voice: {aiCheckResult?.brandVoiceScore}% · Overall: {aiCheckResult?.overallScore}%
                  </p>
                  {aiCheckResult?.plagiarismFlags && aiCheckResult.plagiarismFlags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Flagged Content:</p>
                      <ul className="text-sm text-muted-foreground list-disc pl-4 mt-1">
                        {aiCheckResult.plagiarismFlags.slice(0, 5).map((flag, i) => (
                          <li key={i}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-400">Taking action will:</p>
                  <ul className="text-sm text-muted-foreground list-disc pl-4 mt-1">
                    <li>Delete the article "{revokeTarget?.title}"</li>
                    <li>Remove writer access from the user</li>
                    <li>Send an email notification explaining the violation</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRevokeDialog(false);
              setRevokeTarget(null);
              setAiCheckResult(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeWriter}
              className="bg-red-500 hover:bg-red-600"
            >
              Revoke Writer Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

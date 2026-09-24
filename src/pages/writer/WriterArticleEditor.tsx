import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Send, Loader2, ImagePlus, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const CATEGORIES = [
  "News",
  "Analysis", 
  "Opinion",
  "Game Recap",
  "Player Spotlight",
  "Trade Rumors",
  "Prospects",
  "History",
];

const DRAFT_KEY = "writer-article-draft";

interface DraftData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  featuredImageUrl: string;
  savedAt: number;
}

export default function WriterArticleEditor() {
  const { id } = useParams();
  const isEditing = !!id;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const initialized = useRef(false);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    if (isEditing || !initialized.current) return;
    if (!title && !content) return;
    const draft: DraftData = {
      title, slug, excerpt, content, category, tags, featuredImageUrl, savedAt: Date.now(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [title, slug, excerpt, content, category, tags, featuredImageUrl, isEditing]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (isEditing) return;
    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(interval);
  }, [saveDraft, isEditing]);

  // Save on beforeunload / visibilitychange
  useEffect(() => {
    if (isEditing) return;
    const handleBeforeUnload = () => saveDraft();
    const handleVisibilityChange = () => { if (document.visibilityState === 'hidden') saveDraft(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveDraft, isEditing]);

  // Clear draft after successful save
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }, []);

  useEffect(() => {
    const checkWriterAccess = async () => {
      if (authLoading) return;
      
      if (!user) {
        navigate("/auth?mode=login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasWriterRole = roles?.some(r => r.role === "writer" || r.role === "admin");
      
      if (!hasWriterRole) {
        toast({
          title: "Access Denied",
          description: "You don't have writer permissions.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsWriter(true);

      if (isEditing) {
        const { data: article, error } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (error || !article) {
          toast({
            title: "Article not found",
            description: "You can only edit your own articles.",
            variant: "destructive",
          });
          navigate("/writer");
          return;
        }

        setTitle(article.title);
        setSlug(article.slug);
        setExcerpt(article.excerpt || "");
        setContent(article.content);
        setCategory(article.category);
        setTags(article.tags?.join(", ") || "");
        setFeaturedImageUrl(article.featured_image_url || "");
      } else {
        // Restore draft for new articles
        try {
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            const draft: DraftData = JSON.parse(saved);
            // Only restore if less than 7 days old
            if (Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000) {
              setTitle(draft.title || "");
              setSlug(draft.slug || "");
              setExcerpt(draft.excerpt || "");
              setContent(draft.content || "");
              setCategory(draft.category || "");
              setTags(draft.tags || "");
              setFeaturedImageUrl(draft.featuredImageUrl || "");
              setDraftRestored(true);
            }
          }
        } catch {}
      }

      initialized.current = true;
      setLoading(false);
    };

    checkWriterAccess();
  }, [user, authLoading, navigate, toast, id, isEditing]);

  // Slug is entered manually by the writer (no auto-generation)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setImageUploading(true);
    try {
      const { publicUrl } = await uploadToR2(file, "blog-images");
      setFeaturedImageUrl(publicUrl);
      toast({
        title: "Image uploaded",
        description: "Featured image has been uploaded successfully.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async (submitForReview = false) => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your article.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please write some content for your article.",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category for your article.",
        variant: "destructive",
      });
      return;
    }

    if (!slug.trim()) {
      toast({
        title: "URL slug required",
        description: "Please enter a URL slug for your article.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const articleData = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim(),
        category,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        featured_image_url: featuredImageUrl || null,
        user_id: user!.id,
        approval_status: submitForReview ? "pending" : (isEditing ? undefined : "pending"),
        published: false, // Writers cannot publish directly
      };

      if (isEditing) {
        const { error } = await supabase
          .from("blog_posts")
          .update(articleData)
          .eq("id", id);

        if (error) throw error;

        toast({
          title: submitForReview ? "Submitted for review" : "Article saved",
          description: submitForReview 
            ? "Your article has been submitted for admin review."
            : "Your changes have been saved.",
        });
      } else {
        const { error } = await supabase
          .from("blog_posts")
          .insert([articleData]);

        if (error) throw error;

        clearDraft();
        toast({
          title: "Article created",
          description: "Your article has been submitted for admin review.",
        });
        navigate("/writer");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save article. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckArticle = async () => {
    if (!content.trim() || content.trim().length < 50) {
      toast({ title: "Too short", description: "Write at least 50 characters before checking.", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Title needed", description: "Add a title before checking your article.", variant: "destructive" });
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-ai-content", {
        body: { title: title.trim(), content: content.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCheckResult(data);
      toast({ title: "Article Checked ✅", description: `Originality Score: ${data.originalityScore || 0}%` });
    } catch (err: any) {
      toast({ title: "Check Failed", description: err.message || "Could not check article.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isWriter) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to="/writer">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={handleCheckArticle}
              disabled={checking || saving}
            >
              {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Check Article
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Draft
            </Button>
            <Button 
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit for Review
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {draftRestored && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <span className="text-foreground">✨ Your previous draft was restored automatically.</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                clearDraft();
                setTitle(""); setSlug(""); setExcerpt(""); setContent("");
                setCategory(""); setTags(""); setFeaturedImageUrl("");
                setDraftRestored(false);
              }}
            >
              Discard Draft
            </Button>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Article" : "New Article"}</CardTitle>
            <CardDescription>
              {isEditing 
                ? "Update your article. Changes will be reviewed by an admin before publishing."
                : "Write your article. It will be reviewed by an admin before publishing. Your work is auto-saved locally."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter article title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                placeholder="article-url-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This will be used in the article URL
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                placeholder="Brief summary of your article (shown in previews)"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Featured Image */}
            <div className="space-y-2">
              <Label>Featured Image</Label>
              <div className="flex items-center gap-4">
                {featuredImageUrl && (
                  <img 
                    src={featuredImageUrl} 
                    alt="Featured" 
                    className="w-32 h-20 object-cover rounded-lg"
                  />
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-accent/50 transition-colors">
                    {imageUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4" />
                    )}
                    <span className="text-sm">
                      {featuredImageUrl ? "Change Image" : "Upload Image"}
                    </span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={imageUploading}
                  />
                </label>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Write your article content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="font-mono text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                You can use Markdown formatting for headings, bold, italic, links, etc.
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="tag1, tag2, tag3"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article Check Results */}
        {checkResult && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Article Review Results
              </CardTitle>
              <CardDescription>{checkResult.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score bars */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Originality</span>
                    <span className="font-semibold">{checkResult.originalityScore}%</span>
                  </div>
                  <Progress value={checkResult.originalityScore} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Brand Voice</span>
                    <span className="font-semibold">{checkResult.brandVoiceScore}%</span>
                  </div>
                  <Progress value={checkResult.brandVoiceScore} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Overall</span>
                    <span className="font-semibold">{checkResult.overallScore}%</span>
                  </div>
                  <Progress value={checkResult.overallScore} className="h-2" />
                </div>
              </div>

              {/* Plagiarism flag */}
              {checkResult.isPlagiarized && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm">
                    <p className="font-semibold flex items-center gap-1 text-destructive mb-1">
                    <XCircle className="w-4 h-4" /> Possible Plagiarism Detected
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {checkResult.plagiarismFlags?.map((flag: string, i: number) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grammar Issues */}
              {checkResult.grammarIssues?.length > 0 && (
                <div className="rounded-lg bg-accent/50 border border-border p-3 text-sm">
                  <p className="font-semibold flex items-center gap-1 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" /> Grammar & Spelling ({checkResult.grammarIssues.length})
                  </p>
                  <ul className="space-y-2">
                    {checkResult.grammarIssues.slice(0, 5).map((issue: any, i: number) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="line-through text-destructive/70">{issue.text}</span>
                        {" → "}
                        <span className="text-primary">{issue.suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {checkResult.strengths?.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                  <p className="font-semibold flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Strengths
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {checkResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {checkResult.improvements?.length > 0 && (
                <div className="text-sm">
                  <p className="font-semibold mb-1">💡 Suggestions</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {checkResult.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

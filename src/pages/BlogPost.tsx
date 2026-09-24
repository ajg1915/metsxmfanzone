import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SEOHead, { generateArticleSchema } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Tag, ArrowLeft, Headphones, Volume2, Square, Settings } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SocialShareButtons from "@/components/SocialShareButtons";
import { getBlogShareUrl } from "@/lib/blogLinks";
import RelatedPosts from "@/components/RelatedPosts";
import ArticleLinkPreviews from "@/components/blog/ArticleLinkPreviews";
import ArticleBody from "@/components/blog/ArticleBody";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  published_at: string;
}

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
}

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  // Blog posts are publicly readable so shared links work on social media.
  
  // Free browser TTS states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      // Filter for English voices and prioritize high-quality ones
      const englishVoices = voices
        .filter(v => v.lang.startsWith('en'))
        .map(voice => ({
          voice,
          label: `${voice.name} (${voice.lang})${voice.localService ? '' : ' ☁️'}`
        }))
        .sort((a, b) => {
          // Prioritize non-local (cloud/premium) voices
          if (!a.voice.localService && b.voice.localService) return -1;
          if (a.voice.localService && !b.voice.localService) return 1;
          // Then sort by name
          return a.voice.name.localeCompare(b.voice.name);
        });
      
      setAvailableVoices(englishVoices);
      
      // Auto-select best voice (prefer Google or Microsoft voices)
      const preferredVoice = englishVoices.find(v => 
        v.voice.name.includes('Google') || 
        v.voice.name.includes('Microsoft') ||
        v.voice.name.includes('Samantha') ||
        v.voice.name.includes('Daniel')
      ) || englishVoices[0];
      
      if (preferredVoice && !selectedVoice) {
        setSelectedVoice(preferredVoice.voice);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  const fetchPost = async () => {
    try {
      // Use maybeSingle for resilience — slug may not exist or may be unpublished.
      // Decode the slug in case the URL was percent-encoded by a share link.
      const decodedSlug = (() => {
        try { return decodeURIComponent(slug || ""); } catch { return slug || ""; }
      })();

      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", decodedSlug)
        .eq("published", true)
        .maybeSingle();

      if (error) {
        console.error("Slug fetch error:", error);
        throw error;
      }

      if (data && data.featured_image_url) {
        if (!data.featured_image_url.startsWith('http') && !data.featured_image_url.startsWith('data:')) {
          data.featured_image_url = `${window.location.origin}${data.featured_image_url}`;
        }
        if (data.featured_image_url.includes('supabase.co') && !data.featured_image_url.startsWith('http')) {
          data.featured_image_url = `https://${data.featured_image_url}`;
        }
      }
      
      setPost(data);
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setLoading(false);
    }
  };

  // Free browser TTS - no API key needed
  const handleBrowserTTS = () => {
    if (!post) return;

    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Cancel any pending speech first
    speechSynthesis.cancel();

    // Strip HTML tags and create clean text
    const textToSpeak = `${post.title}. ${post.content}`
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit text length for better performance (some browsers fail on very long text)
    const maxLength = 2000;
    const truncatedText = textToSpeak.length > maxLength
      ? textToSpeak.slice(0, maxLength) + "..."
      : textToSpeak;

    const utterance = new SpeechSynthesisUtterance(truncatedText);

    const voices = speechSynthesis.getVoices();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else if (voices.length > 0) {
      // Use first available voice if none selected
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;
    } else {
      toast({
        title: "Voices Loading",
        description: "Voices are still loading — try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    utterance.onerror = (e) => {
      console.error('Speech error:', e.error, e);
      setIsSpeaking(false);

      if (e.error === 'canceled') return;

      toast({
        title: "Speech Error",
        description: `TTS error: ${e.error || 'unknown'}. Try another voice or refresh.`,
        variant: "destructive",
      });
    };

    utteranceRef.current = utterance;

    try {
      try {
        // Some browsers pause speech synthesis; resume helps reliability.
        speechSynthesis.resume();
      } catch {
        // ignore
      }

      // IMPORTANT: call speak synchronously (no setTimeout) to preserve user-gesture requirements.
      speechSynthesis.speak(utterance);

      toast({
        title: "Playing Article",
        description: `Using ${utterance.voice?.name || 'default'} voice`,
      });
    } catch (err) {
      console.error('Failed to start speech:', err);
      setIsSpeaking(false);
      toast({
        title: "Audio Error",
        description: "Could not start text-to-speech. Try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const stopBrowserTTS = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };


  // Show loading while fetching post
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Post not found</p>
              <Button onClick={() => navigate("/blog")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blog
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const canonicalUrl = getBlogShareUrl(post.slug);
  
  // Calculate reading time
  const wordCount = post.content.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.excerpt || post.title,
    image: post.featured_image_url,
    datePublished: post.published_at,
    authorName: "MetsXMFanZone",
    url: canonicalUrl,
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
      <SEOHead
        title={post.title}
        description={post.excerpt || post.title}
        canonical={canonicalUrl}
        ogType="article"
        ogImage={post.featured_image_url}
        ogImageAlt={post.title}
        twitterCard="summary_large_image"
        publishedTime={post.published_at}
        modifiedTime={post.published_at}
        author="MetsXMFanZone"
        section={post.category}
        tags={post.tags}
        readingTime={readingTime}
        wordCount={wordCount}
        structuredData={articleSchema}
        pageType="article"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
      />

      
      
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pt-12">
        <div className="max-w-4xl mx-auto w-full">
          <Button 
            variant="ghost" 
            className="mb-6"
            onClick={() => navigate("/blog")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Button>

          <article>
            {post.featured_image_url && (
              <div className="w-full rounded-lg mb-6">
                <img 
                  src={post.featured_image_url} 
                  alt={post.title}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}

            <header className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
              
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                  {post.category}
                </span>
                <span className="text-sm">·</span>
                <span className="text-sm">{readingTime} min read</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                By <span className="font-semibold text-foreground">MetsXMFanZone</span> · <span className="text-primary">Orange & Blue Media</span>
              </p>
              <div className="flex items-center gap-3 mb-4">
                {/* Free Browser TTS Controls */}
                {!post.audio_url && availableVoices.length > 0 && (
                  <div className="flex items-center gap-2">
                    {isSpeaking ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={stopBrowserTTS}
                        className="gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBrowserTTS}
                        className="gap-2"
                      >
                        <Volume2 className="w-4 h-4" />
                        Listen
                      </Button>
                    )}
                    
                    {/* Voice Settings Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 px-2">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                        <DropdownMenuLabel>Free Voice Settings</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Select Voice ({availableVoices.length} available)
                        </DropdownMenuLabel>
                        {availableVoices.slice(0, 15).map(({ voice, label }) => (
                          <DropdownMenuItem
                            key={voice.name}
                            onClick={() => setSelectedVoice(voice)}
                            className={selectedVoice?.name === voice.name ? "bg-primary/10" : ""}
                          >
                            {selectedVoice?.name === voice.name && "✓ "}
                            {label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Speed: {speechRate}x
                        </DropdownMenuLabel>
                        <div className="px-2 py-1 flex gap-1">
                          {[0.75, 1, 1.25, 1.5].map(rate => (
                            <Button
                              key={rate}
                              variant={speechRate === rate ? "default" : "outline"}
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setSpeechRate(rate)}
                            >
                              {rate}x
                            </Button>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {post.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {post.tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="text-sm bg-muted px-3 py-1 rounded-full flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Pre-uploaded audio player */}
            {post.audio_url && (
              <Card className="mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Headphones className="w-5 h-5 text-primary" />
                    <span className="font-medium">Listen to this article</span>
                  </div>
                  <audio controls className="w-full">
                    <source src={post.audio_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </CardContent>
              </Card>
            )}

            {/* Browser TTS speaking indicator */}
            {isSpeaking && (
              <Card className="mb-6 border-muted/50 bg-muted/10">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-muted-foreground rounded-full animate-pulse" />
                      <span className="font-medium">Free Voice Playing</span>
                      <span className="text-sm text-muted-foreground">
                        {selectedVoice?.name || 'Default voice'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={stopBrowserTTS}>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="py-6 sm:py-8 px-4 sm:px-6">
                <ArticleBody content={post.content} />
                <ArticleLinkPreviews content={post.content} />
              </CardContent>
            </Card>

            <div className="mt-8">
              <Card>
                <CardContent className="py-6">
                  <SocialShareButtons title={post.title} url={getBlogShareUrl(post.slug)} />
                </CardContent>
              </Card>
            </div>

            {/* Related Posts for SEO internal linking */}
            <RelatedPosts
              currentPostId={post.id}
              category={post.category}
              tags={post.tags}
            />



          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

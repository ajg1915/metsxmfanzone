import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Tag, Rss, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url?: string;
  category: string;
  tags: string[];
  published_at: string;
}

export default function Blog() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (error) throw error;
      
      setPosts(data || []);
      
      const uniqueCategories = [...new Set((data || []).map(post => post.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || post.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Generate CollectionPage structured data for blog listing
  const blogListingSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Mets News, Analysis & Updates - MetsXMFanZone Blog",
    "description": "Latest New York Mets news, game analysis, player updates, and exclusive content.",
    "url": "https://www.metsxmfanzone.com/blog",
    "publisher": {
      "@type": "Organization",
      "name": "MetsXMFanZone",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.metsxmfanzone.com/logo-512.png"
      }
    },
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": posts.slice(0, 10).map((post, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "url": `https://www.metsxmfanzone.com/blog/${post.slug}`,
        "name": post.title
      }))
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
      <SEOHead
        title="Mets News, Analysis & Updates - MetsXMFanZone Blog"
        description="Latest New York Mets news, game analysis, player updates, and exclusive content. Stay informed with in-depth Mets coverage, trade rumors, injury reports, and expert commentary."
        keywords="Mets news, Mets blog, Mets analysis, New York Mets updates, Mets commentary, baseball news, MLB news, Mets trade rumors, Mets injury updates, Mets game recaps"
        canonical="https://www.metsxmfanzone.com/blog"
        structuredData={blogListingSchema}
      />
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pt-12 max-md:!pt-16 max-md:!pb-24 max-w-7xl">
        <div className="w-full">

          {/* Phone layout */}
          <div className="-mx-4 md:hidden">
            <div className="flex items-center justify-between px-4">
              <h1 className="font-display text-[38px] uppercase leading-none tracking-wide">Blog</h1>
              <button
                type="button"
                aria-label={searchOpen ? "Close search" : "Search posts"}
                onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearchQuery(""); }}
                className="flex h-11 w-11 items-center justify-center text-foreground"
              >
                {searchOpen ? <X className="h-[22px] w-[22px]" /> : <Search className="h-[22px] w-[22px]" />}
              </button>
            </div>
            {searchOpen && (
              <div className="px-4 pt-2">
                <Input
                  autoFocus
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto px-4 pt-2.5 scrollbar-hide">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? "all"}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`h-11 shrink-0 rounded-full border px-[18px] text-sm font-bold ${selectedCategory === c ? "border-secondary/70 bg-secondary/40 text-white" : "border-border/60 bg-card text-foreground"}`}
                >
                  {c ?? "All"}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="py-10 text-center text-muted-foreground">Loading...</p>
            ) : filteredPosts.length === 0 ? (
              <p className="px-4 py-10 text-center text-muted-foreground">
                {searchQuery || selectedCategory ? "No posts found matching your criteria" : "No blog posts yet. Check back soon!"}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/blog/${filteredPosts[0].slug}`)}
                  className="relative mx-4 mt-3.5 block h-[196px] w-[calc(100%-2rem)] overflow-hidden rounded-[14px] border border-border/50 bg-card text-left"
                >
                  {filteredPosts[0].featured_image_url && (
                    <img src={filteredPosts[0].featured_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[5px] px-3.5 pb-3.5">
                    <span className="text-[11px] font-extrabold tracking-[0.2em] text-primary">FEATURED</span>
                    <span className="line-clamp-3 text-[23px] font-bold uppercase italic leading-[1.05] text-foreground" style={{ fontFamily: "'Oswald','Bebas Neue',sans-serif" }}>
                      {filteredPosts[0].title}
                    </span>
                    <span className="text-[12.5px] text-foreground/80">{new Date(filteredPosts[0].published_at).toLocaleDateString()}</span>
                  </div>
                </button>

                <div className="mt-4 flex flex-col gap-4 px-4">
                  {filteredPosts.slice(1).map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-[10px] border border-border/50 bg-gradient-to-br from-secondary/60 to-card">
                        {post.featured_image_url && (
                          <img src={post.featured_image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-3 text-[15.5px] font-bold leading-tight text-foreground">{post.title}</p>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">{new Date(post.published_at).toLocaleDateString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="hidden md:block">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Blog</h1>
            <Button variant="outline" onClick={() => navigate("/blog/rss")} className="w-full sm:w-auto">
              <Rss className="w-4 h-4 mr-2" />
              RSS Feed
            </Button>
          </div>

          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 sm:py-12">Loading...</div>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery || selectedCategory 
                  ? "No posts found matching your criteria" 
                  : "No blog posts yet. Check back soon!"}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Featured Blog Post */}
              {filteredPosts.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs">FEATURED</span>
                    Latest Article
                  </h2>
                  <Card 
                    className="hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/blog/${filteredPosts[0].slug}`)}
                  >
                    <div className="grid md:grid-cols-2 gap-0">
                      {filteredPosts[0].featured_image_url && (
                        <div className="aspect-video md:aspect-auto md:h-full overflow-hidden">
                          <img 
                            src={filteredPosts[0].featured_image_url} 
                            alt={filteredPosts[0].title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className={`p-6 flex flex-col justify-center ${!filteredPosts[0].featured_image_url ? 'md:col-span-2' : ''}`}>
                        <span className="text-xs text-primary font-medium mb-2">{filteredPosts[0].category}</span>
                        <h3 className="text-xl md:text-2xl font-bold mb-3 line-clamp-2">{filteredPosts[0].title}</h3>
                        <p className="text-muted-foreground line-clamp-3 mb-4">
                          {filteredPosts[0].excerpt || filteredPosts[0].content.substring(0, 200)}...
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(filteredPosts[0].published_at).toLocaleDateString()}
                          </span>
                          {filteredPosts[0].tags.length > 0 && (
                            <div className="flex gap-1">
                              {filteredPosts[0].tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="bg-muted px-2 py-0.5 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Rest of Blog Posts */}
              {filteredPosts.length > 1 && (
                <>
                  <h2 className="text-lg font-semibold mb-4">More Articles</h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPosts.slice(1).map((post) => (
                      <Card 
                        key={post.id} 
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate(`/blog/${post.slug}`)}
                      >
                        {post.featured_image_url && (
                          <div className="aspect-video overflow-hidden rounded-t-lg">
                            <img 
                              src={post.featured_image_url} 
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardHeader>
                          <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(post.published_at).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground line-clamp-3 mb-4">
                            {post.excerpt || post.content.substring(0, 150)}...
                          </p>
                          {post.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {post.tags.slice(0, 3).map((tag) => (
                                <span 
                                  key={tag} 
                                  className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                                >
                                  <Tag className="w-3 h-3" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Category Tags - Bottom of page */}
          {categories.length > 0 && (
            <div className="mt-10 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Browse by Category
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

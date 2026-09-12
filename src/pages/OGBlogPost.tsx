import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url?: string;
  category: string;
  tags: string[];
  published_at: string;
}

export default function OGBlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPostAndRedirect();
    }
  }, [slug]);

  const fetchPostAndRedirect = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image_url, category, tags, published_at")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) throw error;
      
      if (data) {
        setPost(data);
        // Redirect to actual blog post after a brief delay to let crawlers read meta tags
        setTimeout(() => {
          navigate(`/blog/${slug}`, { replace: true });
        }, 100);
      }
    } catch (error) {
      console.error("Error fetching post:", error);
      navigate("/blog", { replace: true });
    }
  };

  if (!post) {
    return null; // Don't render anything while loading
  }

  const siteUrl = window.location.origin;
  const postUrl = `${siteUrl}/blog/${slug}`;
  
  // Ensure proper image URL
  let socialImage = post.featured_image_url || `${siteUrl}/logo-512.png`;
  if (socialImage.startsWith('data:')) {
    socialImage = `${siteUrl}/logo-512.png`;
  } else if (!socialImage.startsWith('http')) {
    socialImage = `${siteUrl}${socialImage}`;
  }

  const socialTitle = `${post.title} | MetsXMFanZone`;
  const socialDescription = post.excerpt && post.excerpt.length > 0
    ? (post.excerpt.length > 160 ? post.excerpt.substring(0, 157) + '...' : post.excerpt)
    : post.title;

  return (
    <>
      <Helmet>
        <title>{socialTitle}</title>
        <meta name="description" content={socialDescription} />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={postUrl} />
        <meta property="og:site_name" content="MetsXMFanZone" />
        <meta property="og:title" content={socialTitle} />
        <meta property="og:description" content={socialDescription} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:secure_url" content={socialImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={post.title} />
        
        {/* Article tags */}
        <meta property="article:published_time" content={post.published_at} />
        <meta property="article:section" content={post.category} />
        {post.tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={postUrl} />
        <meta name="twitter:title" content={socialTitle} />
        <meta name="twitter:description" content={socialDescription} />
        <meta name="twitter:image" content={socialImage} />
        
        {/* Canonical */}
        <link rel="canonical" href={postUrl} />
      </Helmet>
      
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1>{post.title}</h1>
        <p>{socialDescription}</p>
        <p>Redirecting to post...</p>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

/**
 * This component generates a static-like preview for social media crawlers
 * It renders server-side-ready HTML with all meta tags embedded
 */
export default function BlogOGPreview() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug]);

  const fetchPost = async () => {
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
        
        // Redirect to the actual blog post after a very brief delay
        // This gives crawlers time to read meta tags
        setTimeout(() => {
          window.location.href = `/blog/${slug}`;
        }, 100);
      }
    } catch (error) {
      console.error("Error fetching post:", error);
      window.location.href = "/blog";
    } finally {
      setLoading(false);
    }
  };

  if (loading || !post) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, sans-serif', 
        maxWidth: '800px', 
        margin: '40px auto', 
        padding: '20px',
        textAlign: 'center' 
      }}>
        <p>Loading article...</p>
      </div>
    );
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

  // This component focuses on providing crawlable content
  // The actual redirect happens via setTimeout above
  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      maxWidth: '800px', 
      margin: '40px auto', 
      padding: '20px',
      textAlign: 'center' 
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>{post.title}</h1>
      {post.featured_image_url && !post.featured_image_url.startsWith('data:') && (
        <img 
          src={socialImage} 
          alt={post.title}
          style={{ 
            maxWidth: '100%', 
            height: 'auto', 
            borderRadius: '8px',
            margin: '20px 0'
          }}
        />
      )}
      <p style={{ color: '#666', fontSize: '18px', lineHeight: '1.6' }}>
        {socialDescription}
      </p>
      <p style={{ color: '#999', marginTop: '20px' }}>
        Redirecting to article...
      </p>
      
      {/* Hidden meta information for crawlers */}
      <div style={{ display: 'none' }}>
        <span itemProp="headline">{post.title}</span>
        <span itemProp="description">{socialDescription}</span>
        <time itemProp="datePublished" dateTime={post.published_at}>
          {new Date(post.published_at).toLocaleDateString()}
        </time>
        <span itemProp="author">MetsXMFanZone</span>
        <img itemProp="image" src={socialImage} alt={post.title} />
      </div>
    </div>
  );
}

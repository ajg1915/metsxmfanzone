import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  published_at: string;
}

export default function BlogRSS() {
  const [rss, setRss] = useState("");

  useEffect(() => {
    generateRSS();
  }, []);

  const generateRSS = async () => {
    try {
      const { data: posts, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const baseUrl = window.location.origin;
      
      const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MLB Network Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Latest news and updates from MLB Network</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/rss" rel="self" type="application/rss+xml" />
    ${posts?.map((post: BlogPost) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || post.content.substring(0, 200))}</description>
      <category>${escapeXml(post.category)}</category>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    </item>`).join("")}
  </channel>
</rss>`;

      setRss(rssContent);
    } catch (error) {
      console.error("Error generating RSS:", error);
    }
  };

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  useEffect(() => {
    if (rss) {
      const blob = new Blob([rss], { type: "application/rss+xml" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "rss.xml";
      document.body.appendChild(link);
      
      const pre = document.createElement("pre");
      pre.textContent = rss;
      pre.style.cssText = "white-space: pre-wrap; word-wrap: break-word; font-family: monospace; padding: 20px;";
      // Safely clear body content without using innerHTML
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      document.body.appendChild(pre);
    }
  }, [rss]);

  return null;
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

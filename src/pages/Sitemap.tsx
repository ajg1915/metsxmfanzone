import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Sitemap = () => {
  const [xml, setXml] = useState<string>('');

  useEffect(() => {
    const generateSitemap = async () => {
      const baseUrl = 'https://metsxmfanzone.com';
      
      // Fetch all published blog posts
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('slug, published_at')
        .eq('published', true)
        .order('published_at', { ascending: false });

      // Static pages
      const staticPages = [
        { url: '/', changefreq: 'daily', priority: '1.0' },
        { url: '/spring-training-live', changefreq: 'daily', priority: '0.9' },
        { url: '/community', changefreq: 'weekly', priority: '0.8' },
        { url: '/gallery', changefreq: 'weekly', priority: '0.7' },
        { url: '/plans', changefreq: 'monthly', priority: '0.8' },
        { url: '/blog', changefreq: 'daily', priority: '0.8' },
        { url: '/podcast', changefreq: 'weekly', priority: '0.8' },
        { url: '/help-center', changefreq: 'monthly', priority: '0.6' },
        { url: '/contact', changefreq: 'monthly', priority: '0.7' },
        { url: '/feedback', changefreq: 'monthly', priority: '0.6' },
        { url: '/faqs', changefreq: 'monthly', priority: '0.6' },
        { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
        { url: '/terms', changefreq: 'yearly', priority: '0.3' },
        { url: '/business-partner', changefreq: 'monthly', priority: '0.5' },
        { url: '/metsxmfanzone', changefreq: 'weekly', priority: '0.8' },
        { url: '/mlb-network', changefreq: 'weekly', priority: '0.8' },
      ];

      // Generate XML
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xmlContent += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Add static pages
      staticPages.forEach(page => {
        xmlContent += '  <url>\n';
        xmlContent += `    <loc>${baseUrl}${page.url}</loc>\n`;
        xmlContent += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xmlContent += `    <priority>${page.priority}</priority>\n`;
        xmlContent += '  </url>\n';
      });

      // Add dynamic blog posts
      if (posts && posts.length > 0) {
        posts.forEach(post => {
          xmlContent += '  <url>\n';
          xmlContent += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
          if (post.published_at) {
            xmlContent += `    <lastmod>${post.published_at.split('T')[0]}</lastmod>\n`;
          }
          xmlContent += `    <changefreq>monthly</changefreq>\n`;
          xmlContent += `    <priority>0.7</priority>\n`;
          xmlContent += '  </url>\n';
        });
      }

      xmlContent += '</urlset>';
      setXml(xmlContent);
    };

    generateSitemap();
  }, []);

  return (
    <pre style={{ 
      whiteSpace: 'pre-wrap', 
      wordBreak: 'break-word',
      fontFamily: 'monospace',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      {xml}
    </pre>
  );
};

export default Sitemap;

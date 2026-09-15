import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogType?: "website" | "article" | "profile" | "video.other";
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: "summary" | "summary_large_image" | "player";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  noindex?: boolean;
  structuredData?: object;
  // New SEO enhancements
  pageType?: "home" | "blog" | "article" | "product" | "video" | "podcast" | "event" | "faq";
  breadcrumbs?: Array<{ name: string; url: string }>;
  readingTime?: number;
  wordCount?: number;
}

const BASE_URL = "https://metsxmfanzone.com";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;
const SITE_NAME = "MetsXMFanZone";
const TWITTER_HANDLE = "@metsxmfanzone";

export default function SEOHead({
  title,
  description,
  keywords,
  canonical,
  ogType = "website",
  ogImage,
  ogImageAlt,
  twitterCard = "summary_large_image",
  publishedTime,
  modifiedTime,
  author = SITE_NAME,
  section,
  tags = [],
  noindex = false,
  structuredData,
  pageType,
  breadcrumbs,
  readingTime,
  wordCount,
}: SEOHeadProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const trimmedDescription = description.length > 160 
    ? description.substring(0, 157) + "..." 
    : description;
  const finalImage = ogImage || DEFAULT_IMAGE;
  const finalImageAlt = ogImageAlt || title;
  const rawCanonical = canonical || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : BASE_URL);
  // Normalize: strip www. to prevent 3XX redirect issues
  const canonicalUrl = rawCanonical.replace('://www.metsxmfanzone.com', '://metsxmfanzone.com');

  // Clean up image URL
  let socialImage = finalImage;
  if (socialImage.startsWith('data:')) {
    socialImage = DEFAULT_IMAGE;
  } else if (!socialImage.startsWith('http')) {
    socialImage = `${BASE_URL}${socialImage.startsWith('/') ? '' : '/'}${socialImage}`;
  }

  // Auto-generate breadcrumbs from URL when none provided (boosts SEO sitelinks)
  const autoBreadcrumbs = (() => {
    if (breadcrumbs && breadcrumbs.length > 0) return breadcrumbs;
    try {
      const u = new URL(canonicalUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return undefined;
      const crumbs: Array<{ name: string; url: string }> = [
        { name: "Home", url: BASE_URL },
      ];
      let acc = "";
      for (const p of parts) {
        acc += `/${p}`;
        crumbs.push({
          name: decodeURIComponent(p)
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          url: `${BASE_URL}${acc}`,
        });
      }
      return crumbs;
    } catch {
      return undefined;
    }
  })();

  // Generate breadcrumb structured data
  const breadcrumbSchema = autoBreadcrumbs && autoBreadcrumbs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": autoBreadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url.startsWith('http') ? crumb.url : `${BASE_URL}${crumb.url}`,
    })),
  } : null;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={trimmedDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content={author} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      <meta name="googlebot" content={noindex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large"} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Reading time for articles */}
      {readingTime && <meta name="twitter:label1" content="Reading time" />}
      {readingTime && <meta name="twitter:data1" content={`${readingTime} min read`} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={trimmedDescription} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:secure_url" content={socialImage} />
      <meta property="og:image:alt" content={finalImageAlt} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      {/* Article-specific OG tags */}
      {ogType === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {ogType === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {ogType === "article" && author && (
        <meta property="article:author" content={author} />
      )}
      {ogType === "article" && section && (
        <meta property="article:section" content={section} />
      )}
      {ogType === "article" && tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={trimmedDescription} />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content={finalImageAlt} />
      <meta name="twitter:domain" content="metsxmfanzone.com" />

      {/* LinkedIn */}
      <meta property="linkedin:owner" content={SITE_NAME} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      {/* Breadcrumb Structured Data */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}

// Helper function to generate Article structured data
export function generateArticleSchema({
  title,
  description,
  image,
  datePublished,
  dateModified,
  authorName = "MetsXMFanZone",
  url,
}: {
  title: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "image": image || DEFAULT_IMAGE,
    "datePublished": datePublished,
    "dateModified": dateModified || datePublished,
    "author": {
      "@type": "Organization",
      "name": authorName,
      "url": BASE_URL,
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": DEFAULT_IMAGE,
      },
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

// Helper function to generate FAQ structured data
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}

// Helper function to generate Video structured data
export function generateVideoSchema({
  title,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  embedUrl,
  contentUrl,
}: {
  title: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl?: string;
  contentUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": uploadDate,
    ...(duration && { duration }),
    ...(embedUrl && { embedUrl }),
    ...(contentUrl && { contentUrl }),
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": DEFAULT_IMAGE,
      },
    },
  };
}

// Helper function to generate Podcast/Audio structured data
export function generatePodcastSchema({
  title,
  description,
  audioUrl,
  datePublished,
  duration,
  image,
}: {
  title: string;
  description: string;
  audioUrl: string;
  datePublished: string;
  duration?: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "name": title,
    "description": description,
    "datePublished": datePublished,
    "url": audioUrl,
    ...(duration && { duration }),
    "image": image || DEFAULT_IMAGE,
    "partOfSeries": {
      "@type": "PodcastSeries",
      "name": "MetsXMFanZone Podcast",
      "url": `${BASE_URL}/podcast`,
    },
  };
}

// Helper function to generate Event structured data
export function generateEventSchema({
  title,
  description,
  startDate,
  endDate,
  location,
  image,
  url,
}: {
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  image?: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": title,
    "description": description,
    "startDate": startDate,
    ...(endDate && { endDate }),
    "location": location ? {
      "@type": "Place",
      "name": location,
    } : {
      "@type": "VirtualLocation",
      "url": url || BASE_URL,
    },
    "image": image || DEFAULT_IMAGE,
    "organizer": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": BASE_URL,
    },
  };
}

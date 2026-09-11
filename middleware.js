export const config = {
  // Only intercept traffic going to individual blog posts
  matcher: ['/blog/:slug*'] 
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  
  // 1. Check if the visitor is a social media bot
  const isBot = /bot|facebook|twitter|slack|linkedin|discord/i.test(userAgent);
  
  // 2. If it's a normal human on a browser, let them load the site normally
  if (!isBot) {
    return fetch(request); 
  }

  // 3. If it's a bot, grab the specific blog post slug from the URL
  const slug = url.pathname.split('/').pop();

  // 4. Ask your personal Supabase for that specific article's data
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/posts?slug=eq.${slug}&select=title,description,image_url`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    const data = await response.json();
    const post = data[0];

    // 5. Hand the bot a custom invisible HTML page with the correct image and title
    if (post) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${post.title}</title>
            <meta property="og:title" content="${post.title}" />
            <meta property="og:description" content="${post.description}" />
            <meta property="og:image" content="${post.image_url}" />
            <meta name="twitter:card" content="summary_large_image" />
          </head>
          <body></body>
        </html>
      `;
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    }
  } catch (error) {
    console.error('Middleware Error:', error);
  }

  // Fallback to normal site if the fetch fails
  return fetch(request);
}

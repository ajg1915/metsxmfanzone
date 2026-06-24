import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const platform = url.searchParams.get('platform') || 'facebook';

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing authorization code' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify CSRF state via server-stored token (replaces unsigned base64 state)
    let userId: string;
    let redirectUri: string;
    if (!state) {
      return new Response(JSON.stringify({ error: 'Missing state' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('oauth_csrf_tokens')
      .select('user_id, redirect_uri, expires_at')
      .eq('state', state)
      .maybeSingle();
    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: 'Invalid or expired state' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from('oauth_csrf_tokens').delete().eq('state', state);
      return new Response(JSON.stringify({ error: 'State expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    userId = tokenRow.user_id;
    redirectUri = tokenRow.redirect_uri;
    // Single-use: consume immediately
    await supabaseAdmin.from('oauth_csrf_tokens').delete().eq('state', state);


    console.log(`Processing OAuth callback for ${platform}, user: ${userId}`);

    if (platform === 'facebook' || platform === 'instagram') {
      const META_APP_ID = Deno.env.get('META_APP_ID');
      const META_APP_SECRET = Deno.env.get('META_APP_SECRET');

      if (!META_APP_ID || !META_APP_SECRET) {
        return new Response(JSON.stringify({ error: 'Meta credentials not configured' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${META_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${META_APP_SECRET}&` +
        `code=${code}`
      );

      const tokenResult = await tokenResponse.json();

      if (!tokenResponse.ok || tokenResult.error) {
        console.error('Token exchange error:', tokenResult);
        return new Response(JSON.stringify({ 
          error: 'Failed to exchange authorization code',
          details: tokenResult.error?.message 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const shortLivedToken = tokenResult.access_token;

      // Exchange for long-lived token
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${META_APP_ID}&` +
        `client_secret=${META_APP_SECRET}&` +
        `fb_exchange_token=${shortLivedToken}`
      );

      const longLivedResult = await longLivedResponse.json();
      const accessToken = longLivedResult.access_token || shortLivedToken;
      const expiresIn = longLivedResult.expires_in || 3600;

      // Get pages for Facebook
      if (platform === 'facebook') {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        );
        const pagesResult = await pagesResponse.json();

        if (pagesResult.data && pagesResult.data.length > 0) {
          const page = pagesResult.data[0]; // Get first page (or let user choose later)

          // Store connection with page access token
          const { error: insertError } = await supabaseAdmin
            .from('social_media_connections')
            .upsert({
              user_id: userId,
              platform: 'facebook',
              access_token: page.access_token,
              page_id: page.id,
              page_name: page.name,
              connected_at: new Date().toISOString(),
              expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
              status: 'active',
            }, { onConflict: 'user_id,platform' });

          if (insertError) {
            console.error('Error storing Facebook connection:', insertError);
            throw insertError;
          }

          console.log('Facebook connection stored for page:', page.name);
        }
      }

      // Get Instagram Business Account
      if (platform === 'instagram') {
        // First get pages, then get linked Instagram account
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        );
        const pagesResult = await pagesResponse.json();

        if (pagesResult.data && pagesResult.data.length > 0) {
          const page = pagesResult.data[0];

          // Get Instagram Business Account ID linked to this page
          const igResponse = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
          );
          const igResult = await igResponse.json();

          if (igResult.instagram_business_account) {
            const igAccountId = igResult.instagram_business_account.id;

            // Get Instagram account info
            const igInfoResponse = await fetch(
              `https://graph.facebook.com/v18.0/${igAccountId}?fields=username&access_token=${page.access_token}`
            );
            const igInfo = await igInfoResponse.json();

            // Store Instagram connection
            const { error: insertError } = await supabaseAdmin
              .from('social_media_connections')
              .upsert({
                user_id: userId,
                platform: 'instagram',
                access_token: page.access_token,
                page_id: igAccountId,
                page_name: page.name,
                account_username: igInfo.username,
                connected_at: new Date().toISOString(),
                expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
                status: 'active',
              }, { onConflict: 'user_id,platform' });

            if (insertError) {
              console.error('Error storing Instagram connection:', insertError);
              throw insertError;
            }

            console.log('Instagram connection stored for account:', igInfo.username);
          } else {
            return new Response(JSON.stringify({ 
              error: 'No Instagram Business Account found. Make sure your Instagram is connected to a Facebook Page.'
            }), { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        }
      }
    }

    // Redirect back to admin with success
    const redirectUrl = new URL('/admin/social-media', Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '.lovable.app'));
    redirectUrl.searchParams.set('connected', platform);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl.toString(),
      },
    });

  } catch (error: unknown) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

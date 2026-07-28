import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side salt - not visible in client code
const SERVER_SALT = Deno.env.get('ADMIN_PIN_SALT') || 'metsxm_secure_admin_salt_2024_server_side';

// Secure hash function using SHA-256 with server salt
async function hashPin(pin: string, userSalt: string): Promise<string> {
  const encoder = new TextEncoder();
  // Combine pin with server salt and user-specific salt
  const data = encoder.encode(pin + SERVER_SALT + userSalt);
  
  // Multiple rounds of hashing for added security
  let hashBuffer = await crypto.subtle.digest("SHA-256", data);
  for (let i = 0; i < 10000; i++) {
    hashBuffer = await crypto.subtle.digest("SHA-256", hashBuffer);
  }
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, pin } = await req.json();

    // Use user ID as part of the salt for user-specific hashing
    const userSalt = user.id.substring(0, 16);

    if (action === 'check') {
      // Check if PIN exists for this admin
      const { data: existingPin } = await supabase
        .from('admin_verification_codes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      return new Response(JSON.stringify({ hasPin: !!existingPin }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'setup') {
      if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 8) {
        return new Response(JSON.stringify({ error: 'PIN must be 4 to 8 digits' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hashedPin = await hashPin(pin, userSalt);

      // Delete any existing PIN
      await supabase
        .from('admin_verification_codes')
        .delete()
        .eq('user_id', user.id);

      // Insert new PIN
      const { error: insertError } = await supabase
        .from('admin_verification_codes')
        .insert({
          user_id: user.id,
          code_hash: hashedPin
        });

      if (insertError) {
        console.error('Error setting up PIN:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to set up PIN' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Admin PIN set up for user ${user.id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      if (!pin) {
        return new Response(JSON.stringify({ error: 'PIN required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: pinData, error: fetchError } = await supabase
        .from('admin_verification_codes')
        .select('code_hash')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !pinData) {
        return new Response(JSON.stringify({ error: 'No PIN configured' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hashedInput = await hashPin(pin, userSalt);
      const isValid = hashedInput === pinData.code_hash;

      console.log(`Admin PIN verification for user ${user.id}: ${isValid ? 'success' : 'failed'}`);
      
      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-pin-verify:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

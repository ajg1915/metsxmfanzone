import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side salt - matches admin-pin-verify
const SERVER_SALT = Deno.env.get('ADMIN_PIN_SALT') || 'metsxm_secure_admin_salt_2024_server_side';

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

// Secure hash function using SHA-256 with server salt
async function hashPin(pin: string, userSalt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SERVER_SALT + userSalt);
  
  let hashBuffer = await crypto.subtle.digest("SHA-256", data);
  for (let i = 0; i < 10000; i++) {
    hashBuffer = await crypto.subtle.digest("SHA-256", hashBuffer);
  }
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate device fingerprint hash for consistent storage
async function hashFingerprint(fingerprint: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint + SERVER_SALT);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for admin operations (no JWT required for PIN login)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, pin, deviceFingerprint, deviceName, userId: setupUserId, newPin: setupPin, email: resetEmail } = body;

    // Handle PIN reset request - sends a recovery email so admin can set a new PIN
    if (action === 'request-pin-reset') {
      if (!resetEmail || typeof resetEmail !== 'string') {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Always return success to prevent email enumeration
      const genericResponse = new Response(JSON.stringify({
        success: true,
        message: 'If an admin account exists for that email, a reset link has been sent.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      try {
        // Look up user by email
        const { data: usersList } = await supabase.auth.admin.listUsers();
        const matchedUser = usersList?.users?.find(
          (u: any) => u.email?.toLowerCase() === resetEmail.toLowerCase()
        );

        if (!matchedUser) {
          console.log(`PIN reset requested for non-existent email`);
          return genericResponse;
        }

        // Verify user is an admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', matchedUser.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!roleData) {
          console.log(`PIN reset requested for non-admin user`);
          return genericResponse;
        }

        // Generate a recovery link that lands on /admin-pin-reset
        const origin = req.headers.get('origin') || 'https://metsxmfanzone.com';
        const { error: linkError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: matchedUser.email!,
          options: {
            redirectTo: `${origin}/admin-pin-reset`
          }
        });

        if (linkError) {
          console.error('Failed to generate recovery link:', linkError);
        } else {
          console.log(`PIN reset email sent to admin ${matchedUser.id.substring(0, 8)}...`);
        }
      } catch (err) {
        console.error('Error processing PIN reset request:', err);
      }

      return genericResponse;
    }
    
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    // Hash the device fingerprint for storage
    const hashedFingerprint = await hashFingerprint(deviceFingerprint || 'unknown');

    console.log(`Admin PIN login attempt from IP: ${clientIP.substring(0, 10)}... Device: ${hashedFingerprint.substring(0, 16)}...`);

    // Check rate limiting by device fingerprint and IP
    const thirtyMinutesAgo = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    
    const { data: recentAttempts } = await supabase
      .from('admin_login_attempts')
      .select('id, success')
      .or(`device_fingerprint.eq.${hashedFingerprint},ip_address.eq.${clientIP}`)
      .gte('attempted_at', thirtyMinutesAgo)
      .eq('success', false);

    const failedAttempts = recentAttempts?.length || 0;

    if (failedAttempts >= MAX_ATTEMPTS) {
      console.log(`Rate limit exceeded for device/IP. Failed attempts: ${failedAttempts}`);
      
      // Calculate remaining lockout time
      const { data: lastAttempt } = await supabase
        .from('admin_login_attempts')
        .select('attempted_at')
        .or(`device_fingerprint.eq.${hashedFingerprint},ip_address.eq.${clientIP}`)
        .eq('success', false)
        .order('attempted_at', { ascending: false })
        .limit(1)
        .single();

      const lockoutEndsAt = lastAttempt 
        ? new Date(new Date(lastAttempt.attempted_at).getTime() + LOCKOUT_MINUTES * 60 * 1000)
        : new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      
      const remainingMinutes = Math.ceil((lockoutEndsAt.getTime() - Date.now()) / 60000);

      return new Response(JSON.stringify({ 
        error: 'Too many failed attempts',
        locked: true,
        remainingMinutes: Math.max(1, remainingMinutes),
        message: `Account locked for ${remainingMinutes} minutes due to too many failed attempts`
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'login') {
      if (!pin || pin.length < 6) {
        return new Response(JSON.stringify({ error: 'PIN must be at least 6 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find all admins with verification codes set up
      const { data: adminCodes, error: codesError } = await supabase
        .from('admin_verification_codes')
        .select('user_id, code_hash');

      if (codesError || !adminCodes || adminCodes.length === 0) {
        // Log failed attempt
        await supabase.from('admin_login_attempts').insert({
          device_fingerprint: hashedFingerprint,
          ip_address: clientIP,
          success: false
        });
        
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check PIN against all admins
      let matchedUserId: string | null = null;
      
      for (const adminCode of adminCodes) {
        const userSalt = adminCode.user_id.substring(0, 16);
        const hashedInput = await hashPin(pin, userSalt);
        
        if (hashedInput === adminCode.code_hash) {
          matchedUserId = adminCode.user_id;
          break;
        }
      }

      if (!matchedUserId) {
        // Log failed attempt
        await supabase.from('admin_login_attempts').insert({
          device_fingerprint: hashedFingerprint,
          ip_address: clientIP,
          success: false
        });

        const attemptsRemaining = MAX_ATTEMPTS - failedAttempts - 1;
        console.log(`Invalid PIN. Attempts remaining: ${attemptsRemaining}`);
        
        return new Response(JSON.stringify({ 
          error: 'Invalid PIN',
          attemptsRemaining: Math.max(0, attemptsRemaining)
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user is still an admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', matchedUserId)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access revoked' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if this is a trusted device
      const { data: trustedDevice } = await supabase
        .from('admin_trusted_devices')
        .select('id, is_active')
        .eq('user_id', matchedUserId)
        .eq('device_fingerprint', hashedFingerprint)
        .single();

      const isTrustedDevice = trustedDevice?.is_active === true;

      // Log successful attempt
      await supabase.from('admin_login_attempts').insert({
        device_fingerprint: hashedFingerprint,
        ip_address: clientIP,
        success: true
      });

      // If trusted device, update last used
      if (trustedDevice) {
        await supabase
          .from('admin_trusted_devices')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', trustedDevice.id);
      } else {
        // If not trusted, add as new device
        await supabase.from('admin_trusted_devices').insert({
          user_id: matchedUserId,
          device_fingerprint: hashedFingerprint,
          device_name: deviceName || 'Unknown Device',
          is_active: true
        });
      }

      // Get user data
      const { data: userData } = await supabase.auth.admin.getUserById(matchedUserId);
      
      if (!userData?.user?.email) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Admin PIN login successful for user: ${matchedUserId.substring(0, 8)}...`);

      // Generate a magic link token for the admin - this creates a proper Supabase session
      // that respects RLS policies
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
        options: {
          redirectTo: `${req.headers.get('origin') || 'https://metsxmfanzone.com'}/admin`
        }
      });

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error('Failed to generate session link:', linkError);
        
        // Fallback: return session info without full auth (limited functionality)
        return new Response(JSON.stringify({ 
          success: true,
          userId: matchedUserId,
          email: userData.user.email,
          fullName: userData.user.user_metadata?.full_name || 'Admin',
          sessionToken: await hashFingerprint(crypto.randomUUID()),
          isTrustedDevice,
          isNewDevice: !trustedDevice,
          requiresReauth: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return the verification token so frontend can complete the auth
      return new Response(JSON.stringify({ 
        success: true,
        userId: matchedUserId,
        email: userData.user.email,
        fullName: userData.user.user_metadata?.full_name || 'Admin',
        tokenHash: linkData.properties.hashed_token,
        verificationUrl: linkData.properties.action_link,
        isTrustedDevice,
        isNewDevice: !trustedDevice
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'setup-pin') {
      // CRITICAL: require an authenticated caller. Caller must be the admin
      // whose PIN is being set (e.g. fresh recovery-email session) OR another admin.
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: callerData, error: callerErr } = await callerClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (callerErr || !callerData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!setupUserId || !setupPin || setupPin.length < 6) {
        return new Response(JSON.stringify({ error: 'PIN must be at least 6 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Caller must be admin themselves
      const { data: callerRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', callerData.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!callerRole) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Caller can only set their own PIN (admin-on-admin reset must go through recovery flow)
      if (callerData.user.id !== setupUserId) {
        return new Response(JSON.stringify({ error: 'You can only set your own PIN' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify target user is an admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', setupUserId)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'User is not an admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Hash the new PIN
      const userSalt = setupUserId.substring(0, 16);
      const hashedPin = await hashPin(setupPin, userSalt);

      // Upsert the PIN in admin_verification_codes
      const { error: upsertError } = await supabase
        .from('admin_verification_codes')
        .upsert({
          user_id: setupUserId,
          code_hash: hashedPin,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Failed to save PIN:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to save PIN' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Admin PIN setup successful for user: ${setupUserId.substring(0, 8)}...`);
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'PIN configured successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check-lockout') {
      return new Response(JSON.stringify({ 
        locked: failedAttempts >= MAX_ATTEMPTS,
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-pin-login:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

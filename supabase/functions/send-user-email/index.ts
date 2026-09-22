import { createClient } from "npm:@supabase/supabase-js@2";
import { escapeHtml, sanitizeHtml } from "../_shared/sanitize-html.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const VERIFIED_EMAIL_DOMAIN = "notify.metsxmfanzone.com";
const VERIFIED_FROM_ADDRESS = `MetsXMFanZone <noreply@${VERIFIED_EMAIL_DOMAIN}>`;
const EMAIL_QUEUE_NAME = "transactional_emails";


const getTemplateName = (recipientType: EmailRequest["recipientType"], useTestSender: boolean) => {
  if (useTestSender) return "manual_campaign_test";
  switch (recipientType) {
    case "all_users":
      return "manual_campaign_all_users";
    case "subscribers":
      return "manual_campaign_subscribers";
    default:
      return "manual_campaign_specific";
  }
};

const getOrCreateUnsubscribeToken = async (
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<string> => {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing?.token) return existing.token;
  const token = crypto.randomUUID();
  await supabase.from("email_unsubscribe_tokens").insert({ email: normalizedEmail, token });
  return token;
};

const queueEmail = async (
  supabase: ReturnType<typeof createClient>,
  to: string,
  subject: string,
  html: string,
  templateName: string,
) => {
  const messageId = crypto.randomUUID();
  const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, to);

  const payload = {
    to,
    from: VERIFIED_FROM_ADDRESS,
    sender_domain: VERIFIED_EMAIL_DOMAIN,
    subject,
    html,
    text: subject,
    purpose: "transactional",
    label: templateName,
    idempotency_key: `${templateName}:${to.toLowerCase()}:${messageId}`,
    message_id: messageId,
    unsubscribe_token: unsubscribeToken,
    queued_at: new Date().toISOString(),
  };

  const { error: queueError } = await supabase.rpc("enqueue_email", {
    queue_name: EMAIL_QUEUE_NAME,
    payload,
  });

  if (queueError) throw queueError;

  const { error: logError } = await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: to,
    status: "pending",
  });

  if (logError) {
    console.error("Failed to log queued email:", logError.message);
  }
};

interface EmailRequest {
  subject: string;
  content: string;
  recipientType: "all_users" | "subscribers" | "specific";
  specificEmails?: string[];
  useTestSender?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Admin access required");
    }

    const { subject, content, recipientType, specificEmails, useTestSender }: EmailRequest = await req.json();

    if (!subject || !content) {
      throw new Error("Subject and content are required");
    }

    const sanitizedContent = sanitizeHtml(content);
    const templateName = getTemplateName(recipientType, useTestSender || false);

    let recipients: { email: string; name?: string }[] = [];

    if (recipientType === "all_users") {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .not("email", "is", null);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw new Error("Failed to fetch registered users");
      }

      recipients = (profiles || [])
        .filter((profile) => profile.email)
        .map((profile) => ({ email: profile.email!, name: profile.full_name || undefined }));
    } else if (recipientType === "subscribers") {
      const { data: subscribers, error: subscribersError } = await supabase
        .from("newsletter_subscribers")
        .select("email, full_name")
        .eq("is_active", true);

      if (subscribersError) {
        console.error("Error fetching subscribers:", subscribersError);
        throw new Error("Failed to fetch subscribers");
      }

      recipients = (subscribers || []).map((subscriber) => ({
        email: subscriber.email,
        name: subscriber.full_name || undefined,
      }));
    } else if (recipientType === "specific" && specificEmails) {
      recipients = specificEmails.map((email) => ({ email }));
    }

    const dedupedRecipients = Array.from(
      new Map(
        recipients
          .filter((recipient) => recipient.email)
          .map((recipient) => [recipient.email.toLowerCase(), recipient]),
      ).values(),
    );

    if (dedupedRecipients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients found", sent: 0, failed: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let successCount = 0;
    let failureCount = 0;
    let lastFailureMessage: string | null = null;

    for (const recipient of dedupedRecipients) {
      try {
        const personalizedContent = sanitizedContent
          .replace(/\{\{name\}\}/g, escapeHtml(recipient.name || "Fan"))
          .replace(/\{\{email\}\}/g, escapeHtml(recipient.email));

        await queueEmail(supabase, recipient.email, subject, personalizedContent, templateName);
        successCount++;
      } catch (error: any) {
        lastFailureMessage =
          (typeof error?.message === "string" && error.message) ||
          (typeof error?.name === "string" ? error.name : null) ||
          "Failed to queue email";

        console.error("Failed to queue campaign email:", lastFailureMessage);
        failureCount++;
      }
    }

    if (successCount === 0 && failureCount > 0) {
      return new Response(
        JSON.stringify({
          error: lastFailureMessage || "Failed to queue email",
          sent: 0,
          failed: failureCount,
          total: dedupedRecipients.length,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        message: `Email campaign queued for ${successCount} recipients`,
        sent: successCount,
        failed: failureCount,
        total: dedupedRecipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-user-email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
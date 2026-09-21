import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";
import { CANCELLATION_RESULT_KEY, renderDashboard, renderPlans } from "./account.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasWriterAccess = async (userId) => {
  const { data: roles } = await backend.from("user_roles").select("role").eq("user_id", userId);
  return (roles || []).some((row) => row.role === "writer" || row.role === "admin");
};

// ---------------------------------------------------------------------------
// /dashboard/cancellation-status
// ---------------------------------------------------------------------------
export const renderCancellationStatus = async (root) => {
  setPageMetadata({
    title: "Cancellation Status | MetsXMFanZone",
    description: "A step-by-step record of what happened when your membership was cancelled.",
    path: "/dashboard/cancellation-status",
    noindex: true,
  });

  let result = null;
  try {
    const raw = sessionStorage.getItem(CANCELLATION_RESULT_KEY);
    if (raw) result = JSON.parse(raw);
  } catch {
    /* ignore malformed state */
  }

  const allDone = Boolean(result?.paypalConfirmed && result?.accountDeleted);

  const row = (ok, title, okText, failText, pendingLabel) => `
    <div class="card-panel" style="margin-block:10px;">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <h2 style="margin:0;">${escapeHtml(title)}</h2>
        <span class="status-badge ${ok ? "is-approved" : "is-rejected"}">${ok ? "Confirmed" : escapeHtml(pendingLabel || "Not completed")}</span>
      </div>
      <p class="form-note">${escapeHtml(ok ? okText : failText)}</p>
    </div>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Membership</p>
      <h1>Cancellation Status</h1>
      <p>A step-by-step record of what happened when your membership was cancelled.</p>
    </section>
    <section class="content-width">
      ${
        !result
          ? `<div class="card-panel">
              <p class="form-note">No recent cancellation was found in this browser session. If you cancelled from PayPal directly, the change may still be processing.</p>
              <a class="button primary" href="/dashboard">Back to Dashboard</a>
            </div>`
          : `
            <div class="card-panel" style="border-color:${allDone ? "var(--orange)" : "hsl(8 82% 52%)"};">
              <p><strong>${allDone ? "Your membership is fully cancelled." : "Your cancellation did not fully complete."}</strong></p>
              ${result.at ? `<p class="form-note">Attempted ${escapeHtml(new Date(result.at).toLocaleString())}</p>` : ""}
            </div>
            ${row(
              Boolean(result.paypalConfirmed),
              "PayPal billing cancelled",
              "PayPal confirmed the billing agreement is cancelled. No future charges will be made.",
              result.error || "PayPal did not confirm the cancellation, so nothing was changed on your account.",
            )}
            ${row(
              Boolean(result.accountDeleted),
              "Account and data deleted",
              "Your MetsXMFanZone account and associated data have been permanently removed.",
              result.paypalConfirmed
                ? "Billing was stopped, but your account could not be removed automatically."
                : "Account deletion was not attempted because billing was not confirmed cancelled.",
              result.paypalConfirmed ? "Pending" : "Not started",
            )}
            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
              <a class="button secondary" href="/">Go Home</a>
              ${!result.accountDeleted ? '<a class="button primary" href="/dashboard">Back to Dashboard</a>' : ""}
            </div>`
      }
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/dashboard/cancellation-status" });
  bindShell(root);
};

// ---------------------------------------------------------------------------
// /payment-success
// ---------------------------------------------------------------------------
export const renderPaymentSuccess = async (root) => {
  setPageMetadata({
    title: "Payment Confirmation | MetsXMFanZone",
    description: "Confirming your MetsXMFanZone subscription payment.",
    path: "/payment-success",
    noindex: true,
  });

  const paint = (status, planType) => {
    const body =
      status === "processing"
        ? `<p>Processing your payment…</p><p class="form-note">Please wait while we confirm your subscription.</p>`
        : status === "success"
          ? `<h2>Payment Successful!</h2><p>Your ${escapeHtml(planType || "premium")} subscription is now active.</p>
             <ul>
               <li>Access all premium content and live streams</li>
               <li>Enjoy an ad-free experience across the platform</li>
               <li>Get exclusive access to game replays and highlights</li>
               <li>Join our VIP community discussions</li>
             </ul>
             <a class="button primary" href="/">Go to Home</a>
             <p class="form-note">Redirecting automatically in a few seconds…</p>`
          : `<h2>Verification Failed</h2><p>We couldn't verify your payment. Please contact support if you were charged.</p>
             <a class="button primary" href="/plans">Back to Plans</a>
             <a class="button secondary" href="/help-center">Contact Support</a>`;

    root.innerHTML = renderShell({
      content: `<section class="content-width status-panel"><p class="eyebrow">Payment</p><h1>Payment Processing</h1>${body}</section>`,
      currentPath: "/payment-success",
    });
    bindShell(root);
  };

  paint("processing");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const subscriptionId = params.get("subscription_id");

  if (!token && !subscriptionId) {
    paint("error");
    setTimeout(() => window.location.assign("/plans"), 3000);
    return;
  }

  try {
    const { data, error } = await backend.functions.invoke("verify-paypal-payment", {
      body: { subscriptionId: subscriptionId || undefined, orderId: token || undefined },
    });
    if (error) throw error;
    paint("success", data?.subscription?.plan_type);
    setTimeout(() => window.location.assign("/"), 5000);
  } catch {
    paint("error");
    setTimeout(() => window.location.assign("/plans"), 5000);
  }
};

// ---------------------------------------------------------------------------
// /payment-error
// ---------------------------------------------------------------------------
export const renderPaymentError = async (root) => {
  setPageMetadata({
    title: "Payment Failed | MetsXMFanZone",
    description: "Your MetsXMFanZone payment could not be processed.",
    path: "/payment-error",
    noindex: true,
  });

  const content = `
    <section class="content-width status-panel">
      <p class="eyebrow">Payment</p>
      <h1>Payment Failed</h1>
      <p>Your payment could not be processed at this time.</p>
      <div class="card-panel">
        <p><strong>Common reasons for payment failures:</strong></p>
        <ul>
          <li>Insufficient funds in your account</li>
          <li>Incorrect card details</li>
          <li>Card expired or blocked</li>
          <li>Payment gateway timeout</li>
          <li>Bank declined the transaction</li>
        </ul>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="button primary" href="/pricing">Try Again</a>
        <a class="button secondary" href="/">Back to Home</a>
        <a class="button secondary" href="/help-center">Get Help</a>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/payment-error" });
  bindShell(root);
};

// ---------------------------------------------------------------------------
// /paypal-success
// ---------------------------------------------------------------------------
export const renderPayPalSuccess = async (root) => {
  setPageMetadata({
    title: "Payment Processing | MetsXMFanZone",
    description: "Confirming your PayPal payment.",
    path: "/paypal-success",
    noindex: true,
  });

  const paint = (status) => {
    const body =
      status === "processing"
        ? "<p>Processing your payment…</p>"
        : status === "success"
          ? "<p><strong>Payment Successful!</strong></p><p class=\"form-note\">Redirecting to your dashboard…</p>"
          : "<p><strong>Payment Failed</strong></p><p class=\"form-note\">Redirecting back to plans…</p>";
    root.innerHTML = renderShell({
      content: `<section class="content-width status-panel"><p class="eyebrow">Payment</p><h1>Payment Processing</h1>${body}</section>`,
      currentPath: "/paypal-success",
    });
    bindShell(root);
  };

  paint("processing");

  const params = new URLSearchParams(window.location.search);
  const subscriptionId = params.get("subscription_id") || params.get("token");
  if (!subscriptionId) {
    paint("error");
    setTimeout(() => window.location.assign("/plans"), 3000);
    return;
  }

  try {
    const { data, error } = await backend.functions.invoke("verify-paypal-payment", { body: { subscriptionId } });
    if (error) throw error;
    if (data?.success) {
      paint("success");
      setTimeout(() => window.location.assign("/"), 2000);
    } else {
      paint("error");
      setTimeout(() => window.location.assign("/plans"), 3000);
    }
  } catch {
    paint("error");
    setTimeout(() => window.location.assign("/payment-error"), 1000);
  }
};

// ---------------------------------------------------------------------------
// /confirm-account
// ---------------------------------------------------------------------------
export const renderConfirmAccount = async (root) => {
  setPageMetadata({
    title: "Confirm Your Account | MetsXMFanZone",
    description: "Confirm your MetsXMFanZone email address to activate your account.",
    path: "/confirm-account",
    noindex: true,
  });

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  const hasPendingPlan = localStorage.getItem("pending_signup_plan");

  const paint = (state, message = "") => {
    let body;
    if (state === "verifying") {
      body = `<p>Please wait while we confirm your email address…</p>`;
    } else if (state === "success") {
      body = `
        <h2>Email Confirmed!</h2>
        <p>${hasPendingPlan ? "Your account is verified. Complete your paid plan signup to continue." : "Your account has been successfully verified. You can now log in and start enjoying MetsXMFanZone!"}</p>
        <button class="button primary" type="button" id="confirm-continue">${hasPendingPlan ? "Select Your Plan" : "Continue to Login"}</button>`;
    } else if (state === "error") {
      body = `
        <h2>Verification Failed</h2>
        <p>${escapeHtml(message || "The confirmation link is invalid or has expired.")}</p>
        <button class="button secondary" type="button" id="confirm-resend">Resend Confirmation Email</button>
        <a class="button secondary" href="/auth?mode=login">Back to Login</a>`;
    } else {
      body = `
        <p>We've sent a confirmation link to:</p>
        ${email ? `<p><strong>${escapeHtml(email)}</strong></p>` : ""}
        <p class="form-note">Click the link in the email to activate your account. The link expires in 24 hours.</p>
        <div class="card-panel">
          <p><strong>Didn't receive the email?</strong></p>
          <ul>
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email</li>
            <li>Wait a few minutes and try again</li>
          </ul>
        </div>
        <button class="button secondary" type="button" id="confirm-resend">Resend Confirmation Email</button>
        <a class="button secondary" href="/auth?mode=login">Back to Login</a>`;
    }

    root.innerHTML = renderShell({
      content: `<section class="content-width status-panel"><p class="eyebrow">MetsXMFanZone</p><h1>Check Your Email</h1>${body}</section>`,
      currentPath: "/confirm-account",
    });
    bindShell(root);

    root.querySelector("#confirm-continue")?.addEventListener("click", () => {
      if (hasPendingPlan) {
        localStorage.removeItem("pending_signup_plan");
        localStorage.removeItem("pending_signup_payment_method");
        window.location.assign("/pricing?required=true");
      } else {
        window.location.assign("/auth?mode=login");
      }
    });

    root.querySelector("#confirm-resend")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!email) return;
      button.disabled = true;
      try {
        const { data: profile } = await backend.from("profiles").select("id").ilike("email", email).maybeSingle();
        const userId = profile?.id;
        if (!userId) throw new Error("No account found for this email.");
        const { data, error } = await backend.functions.invoke("send-email-confirmation", {
          body: { email, name: "Mets Fan", userId },
        });
        if (error || data?.error) throw new Error(data?.error || "Failed to send confirmation email");
        button.textContent = "Sent! Check your inbox.";
      } catch (failure) {
        button.textContent = failure?.message || "Could not resend. Try again.";
      } finally {
        setTimeout(() => {
          button.disabled = false;
        }, 3000);
      }
    });
  };

  if (token && email) {
    paint("verifying");
    try {
      const { data, error } = await backend.functions.invoke("verify-email-confirmation", {
        body: { token, email: email.toLowerCase().trim() },
      });
      if (error) throw error;
      if (data?.error) {
        paint("error", data.error);
        return;
      }
      paint("success");
    } catch {
      paint("error");
    }
  } else {
    paint("waiting");
  }
};

// ---------------------------------------------------------------------------
// /unsubscribe
// ---------------------------------------------------------------------------
export const renderUnsubscribe = async (root) => {
  setPageMetadata({
    title: "Email Unsubscribe | MetsXMFanZone",
    description: "Unsubscribe from MetsXMFanZone app emails.",
    path: "/unsubscribe",
    noindex: true,
  });

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const paint = (state, email = "", message = "") => {
    let body;
    if (state === "loading") body = "<p>Validating your link…</p>";
    else if (state === "valid")
      body = `<p>You're about to unsubscribe${email ? ` ${escapeHtml(email)}` : ""} from MetsXMFanZone app emails.</p>
              <button class="button primary" type="button" id="confirm-unsub">Confirm Unsubscribe</button>`;
    else if (state === "submitting") body = "<p>Unsubscribing…</p>";
    else if (state === "success")
      body = `<p><strong>You've been unsubscribed.</strong></p>${email ? `<p class="form-note">${escapeHtml(email)} won't receive these emails anymore.</p>` : ""}`;
    else if (state === "already")
      body = `<p><strong>You're already unsubscribed.</strong></p>${email ? `<p class="form-note">${escapeHtml(email)}</p>` : ""}`;
    else body = `<p><strong>${state === "invalid" ? "Invalid link" : "Something went wrong"}</strong></p><p class="form-note">${escapeHtml(message)}</p>`;

    root.innerHTML = renderShell({
      content: `<section class="content-width status-panel"><p class="eyebrow">Email Preferences</p><h1>Email Unsubscribe</h1>${body}</section>`,
      currentPath: "/unsubscribe",
    });
    bindShell(root);

    root.querySelector("#confirm-unsub")?.addEventListener("click", async () => {
      paint("submitting");
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not unsubscribe.");
        paint("success", email);
      } catch (failure) {
        paint("error", "", failure?.message || "Network error. Please try again.");
      }
    });
  };

  if (!token) {
    paint("invalid", "", "No unsubscribe token provided.");
    return;
  }

  paint("loading");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    const data = await res.json();
    if (!res.ok) {
      paint("invalid", "", data?.error || "Invalid or expired link.");
      return;
    }
    if (data.alreadyUnsubscribed) paint("already", data.email || "");
    else paint("valid", data.email || "");
  } catch {
    paint("invalid", "", "Could not validate this link.");
  }
};

// ---------------------------------------------------------------------------
// /logout
// ---------------------------------------------------------------------------
const THANK_YOU_MESSAGES = [
  "Thank you for being part of the MetsXM family! Your passion makes our community stronger.",
  "We appreciate every moment you spend with us! You're what makes this fan zone special.",
  "Thanks for visiting! Your support means everything to our Mets community. See you soon!",
  "You're an amazing fan! We can't wait to see you back. Let's Go Mets!",
  "Thank you for your loyalty! The MetsXMFanZone wouldn't be the same without you.",
];

export const renderLogout = async (root) => {
  setPageMetadata({
    title: "Signed Out | MetsXMFanZone",
    description: "You have been signed out of MetsXMFanZone.",
    path: "/logout",
    noindex: true,
  });

  await auth.signOut();

  const message = THANK_YOU_MESSAGES[Math.floor(Math.random() * THANK_YOU_MESSAGES.length)];
  let countdown = 10;

  const content = `
    <section class="content-width status-panel">
      <p class="eyebrow">MetsXMFanZone</p>
      <h1>Thank You for Visiting!</h1>
      <p>${escapeHtml(message)}</p>
      <p class="form-note">You've been safely logged out.</p>
      <p class="form-note">Redirecting in <strong id="logout-countdown">${countdown}</strong> seconds…</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="button primary" href="/">Back to Home</a>
        <a class="button secondary" href="/auth">Sign In Again</a>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/logout" });
  bindShell(root);

  const counter = root.querySelector("#logout-countdown");
  const timer = setInterval(() => {
    countdown -= 1;
    if (counter) counter.textContent = String(Math.max(countdown, 0));
    if (countdown <= 0) {
      clearInterval(timer);
      window.location.assign("/");
    }
  }, 1000);
};

// ---------------------------------------------------------------------------
// /rewards/claim
// ---------------------------------------------------------------------------
export const renderRewardClaim = async (root) => {
  setPageMetadata({
    title: "Claim Your Free T-Shirt | MetsXMFanZone",
    description: "Claim your free MetsXMFanZone T-Shirt reward.",
    path: "/rewards/claim",
    noindex: true,
  });

  const token = new URLSearchParams(window.location.search).get("token") || "";
  const initialAction = new URLSearchParams(window.location.search).get("action");

  const form = { shippingName: "", address1: "", address2: "", city: "", state: "", zip: "", country: "United States", shirtSize: "L", phone: "" };

  const paint = (state, extra = {}) => {
    let body;
    if (state === "loading") body = "<p>Loading your reward…</p>";
    else if (state === "invalid") body = `<h2>Invalid or expired link</h2><p>This reward link isn't valid. If you think this is a mistake, contact support.</p>`;
    else if (state === "claimed") body = `<h2>You're all set!</h2><p>We received your shipping info. Your free T-shirt will go out soon — we'll email you tracking when it ships.</p>`;
    else if (state === "shipped")
      body = `<h2>Already shipped!</h2>${extra.number ? `<p>${escapeHtml(extra.carrier || "Tracking")}: <strong>${escapeHtml(extra.number)}</strong></p>` : ""}`;
    else if (state === "opted_out") body = `<h2>No problem!</h2><p>You've opted out of the free gift. Thanks for being part of MetsXMFanZone.</p>`;
    else
      body = `
        <h2>Claim Your Free T-Shirt</h2>
        <p class="form-note">Thanks for being an active member for 60+ days! Fill in shipping info and we'll send a free MetsXMFanZone tee.</p>
        <form class="stacked-form" id="reward-form">
          <label>Full name<input name="shippingName" required value="${escapeHtml(form.shippingName)}"></label>
          <label>Address line 1<input name="address1" required value="${escapeHtml(form.address1)}"></label>
          <label>Address line 2 (optional)<input name="address2" value="${escapeHtml(form.address2)}"></label>
          <label>City<input name="city" required value="${escapeHtml(form.city)}"></label>
          <label>State<input name="state" required value="${escapeHtml(form.state)}"></label>
          <label>ZIP<input name="zip" required value="${escapeHtml(form.zip)}"></label>
          <label>Country<input name="country" value="${escapeHtml(form.country)}"></label>
          <label>Shirt size
            <select name="shirtSize">
              ${["S", "M", "L", "XL", "XXL", "3XL"].map((size) => `<option value="${size}" ${size === form.shirtSize ? "selected" : ""}>${size}</option>`).join("")}
            </select>
          </label>
          <label>Phone (optional)<input name="phone" value="${escapeHtml(form.phone)}"></label>
          <p class="form-error" id="reward-error" role="alert" hidden></p>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="button primary" type="submit">Send me the T-Shirt</button>
            <button class="button secondary" type="button" id="reward-optout">No thanks, opt out</button>
          </div>
        </form>`;

    root.innerHTML = renderShell({
      content: `<section class="content-width status-panel">${body}</section>`,
      currentPath: "/rewards/claim",
    });
    bindShell(root);

    const rewardForm = root.querySelector("#reward-form");
    rewardForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(rewardForm).entries());
      const error = root.querySelector("#reward-error");
      error.hidden = true;
      try {
        const { data: result, error: invokeError } = await backend.functions.invoke("loyalty-reward-action", {
          body: { token, action: "claim", ...data },
        });
        if (invokeError || !result?.ok) throw new Error(result?.error || "Could not submit claim.");
        paint("claimed");
      } catch (failure) {
        error.textContent = failure?.message || "Could not submit claim.";
        error.hidden = false;
      }
    });

    root.querySelector("#reward-optout")?.addEventListener("click", async () => {
      try {
        const { data: result, error } = await backend.functions.invoke("loyalty-reward-action", { body: { token, action: "optout" } });
        if (error || !result?.ok) throw new Error("Could not process opt-out.");
        paint("opted_out");
      } catch {
        /* keep form visible */
      }
    });
  };

  if (!token) {
    paint("invalid");
    return;
  }

  paint("loading");
  try {
    const { data, error } = await backend.functions.invoke("loyalty-reward-action", { body: { token, action: "lookup" } });
    if (error || !data?.ok) {
      paint("invalid");
      return;
    }
    const reward = data.reward;
    if (reward.status === "claimed") paint("claimed");
    else if (reward.status === "opted_out") paint("opted_out");
    else if (reward.status === "shipped") paint("shipped", { number: reward.tracking, carrier: reward.carrier });
    else if (reward.status === "cancelled") paint("invalid");
    else if (initialAction === "optout") {
      try {
        const { data: result, error: optOutError } = await backend.functions.invoke("loyalty-reward-action", { body: { token, action: "optout" } });
        if (optOutError || !result?.ok) throw new Error();
        paint("opted_out");
      } catch {
        paint("form");
      }
    } else paint("form");
  } catch {
    paint("invalid");
  }
};

// ---------------------------------------------------------------------------
// /writer-auth
// ---------------------------------------------------------------------------
export const renderWriterAuth = async (root) => {
  setPageMetadata({
    title: "Writer Portal Sign In | MetsXMFanZone",
    description: "Sign in to the MetsXMFanZone writer portal to manage articles.",
    path: "/writer-auth",
    noindex: true,
  });

  const content = `
    <section class="content-width auth-panel">
      <p class="eyebrow">Writer Portal</p>
      <h1>Writer sign in</h1>
      <form class="stacked-form" id="writer-form" novalidate>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
        <p class="form-error" id="writer-error" role="alert" hidden></p>
        <p class="form-note" id="writer-note" role="status" hidden></p>
        <button class="button primary" type="submit">Sign in</button>
      </form>
      <div class="auth-links">
        <a href="/writer-register">Apply to become a writer</a>
        <a href="/auth">Sign in as a fan instead</a>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/writer-auth" });
  bindShell(root);

  const form = root.querySelector("#writer-form");
  const error = root.querySelector("#writer-error");
  const note = root.querySelector("#writer-note");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    error.hidden = true;
    note.hidden = true;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;

    try {
      const { data: signInData, error: signInError } = await backend.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const userId = signInData?.user?.id;
      const allowed = userId ? await hasWriterAccess(userId) : false;
      if (!allowed) {
        await backend.auth.signOut();
        throw new Error("You don't have writer access. Please contact an administrator.");
      }
      note.textContent = "Welcome back! Redirecting…";
      note.hidden = false;
      window.location.assign("/writer");
    } catch (failure) {
      error.textContent = escapeHtml(failure?.message || "Login failed. Please try again.");
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
};

// ---------------------------------------------------------------------------
// /writer-register
// ---------------------------------------------------------------------------
export const renderWriterRegister = async (root) => {
  setPageMetadata({
    title: "Apply to Become a Writer | MetsXMFanZone",
    description: "Submit your application to join the MetsXMFanZone writing team.",
    path: "/writer-register",
    noindex: true,
  });

  const content = `
    <section class="content-width auth-panel">
      <p class="eyebrow">Writer Portal</p>
      <h1>Apply to become a writer</h1>
      <form class="stacked-form" id="writer-register-form" novalidate>
        <label>Full name<input name="fullName" type="text" required></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" minlength="6" required></label>
        <label>Confirm password<input name="confirmPassword" type="password" minlength="6" required></label>
        <label>Why do you want to be a writer?<textarea name="reason" rows="4" required minlength="20"></textarea></label>
        <label>Portfolio / writing sample URL (optional)<input name="portfolioUrl" type="url"></label>
        <p class="form-error" id="writer-register-error" role="alert" hidden></p>
        <button class="button primary" type="submit">Submit application</button>
      </form>
      <div class="auth-links">
        <a href="/writer-auth">Already have writer access? Sign in</a>
        <a href="/auth">Just a fan? Sign in here</a>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/writer-register" });
  bindShell(root);

  const form = root.querySelector("#writer-register-form");
  const error = root.querySelector("#writer-register-error");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    error.hidden = true;

    const data = new FormData(form);
    const fullName = String(data.get("fullName") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    const reason = String(data.get("reason") || "").trim();
    const portfolioUrl = String(data.get("portfolioUrl") || "").trim();
    const submit = form.querySelector("button[type=submit]");

    if (password !== confirmPassword) {
      error.textContent = "Passwords don't match.";
      error.hidden = false;
      return;
    }

    submit.disabled = true;
    try {
      const { data: signUpData, error: signUpError } = await backend.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/writer-auth`, data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;
      const userId = signUpData?.user?.id;
      if (!userId) throw new Error("Could not create account. Please try again.");

      await backend.from("writer_applications").insert({
        user_id: userId,
        full_name: fullName,
        email,
        reason,
        portfolio_url: portfolioUrl || null,
        status: "pending",
      });

      await backend.auth.signOut();

      root.innerHTML = renderShell({
        content: `<section class="content-width status-panel">
          <p class="eyebrow">Writer Portal</p>
          <h1>Application submitted!</h1>
          <p>Your writer application has been submitted successfully. An administrator will review it and you'll receive an email once a decision has been made — usually within 1-3 business days.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a class="button primary" href="/writer-auth">Back to Writer Login</a>
            <a class="button secondary" href="/">Return to Home</a>
          </div>
        </section>`,
        currentPath: "/writer-register",
      });
      bindShell(root);
    } catch (failure) {
      error.textContent = escapeHtml(failure?.message || "Registration failed. Please try again.");
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
};

// ---------------------------------------------------------------------------
// Writer dashboard / editor helpers (shared restriction check)
// ---------------------------------------------------------------------------
const requireWriter = async (root, currentPath) => {
  const state = await auth.ready();
  if (!state.user) {
    window.location.replace(`/writer-auth?next=${encodeURIComponent(currentPath)}`);
    return null;
  }
  const allowed = state.isAdmin || (await hasWriterAccess(state.user.id));
  if (!allowed) {
    window.location.replace("/");
    return null;
  }
  return state;
};

// ---------------------------------------------------------------------------
// /writer
// ---------------------------------------------------------------------------
export const renderWriterDashboard = async (root) => {
  setPageMetadata({
    title: "Writer Dashboard | MetsXMFanZone",
    description: "Manage your MetsXMFanZone articles and writer profile.",
    path: "/writer",
    noindex: true,
  });

  root.innerHTML = renderShell({ content: statusPanel("Writer Portal", "Loading your dashboard…"), currentPath: "/writer" });
  bindShell(root);

  const state = await requireWriter(root, "/writer");
  if (!state) return;

  const { data: articles } = await backend
    .from("blog_posts")
    .select("id,title,slug,excerpt,published,approval_status,created_at")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  const posts = articles || [];
  const stats = {
    total: posts.length,
    pending: posts.filter((post) => post.approval_status === "pending").length,
    approved: posts.filter((post) => post.approval_status === "approved").length,
    published: posts.filter((post) => post.published && post.approval_status === "approved").length,
  };

  const statusBadge = (post) => {
    if (post.approval_status === "approved" && post.published) return '<span class="status-badge is-approved">Published</span>';
    if (post.approval_status === "approved") return '<span class="status-badge is-approved">Approved</span>';
    if (post.approval_status === "rejected") return '<span class="status-badge is-rejected">Rejected</span>';
    return '<span class="status-badge is-pending">Pending</span>';
  };

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Writer Portal</p>
      <h1>${escapeHtml(state.profile?.full_name || "Writer Dashboard")}</h1>
      <p>${escapeHtml(state.user.email || "")}</p>
    </section>
    <section class="content-width stat-grid">
      <div class="stat-card"><strong>${stats.total}</strong><span>Total articles</span></div>
      <div class="stat-card"><strong>${stats.pending}</strong><span>Pending review</span></div>
      <div class="stat-card"><strong>${stats.approved}</strong><span>Approved</span></div>
      <div class="stat-card"><strong>${stats.published}</strong><span>Published</span></div>
    </section>
    <section class="content-width card-panel">
      <h2>Your articles</h2>
      <a class="button primary" href="/writer/new-article">Write new article</a>
      ${
        posts.length
          ? `<table class="admin-table" style="width:100%;">
              ${posts
                .map(
                  (post) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(post.title)}</strong>
                    <span class="admin-sub">${escapeHtml(new Date(post.created_at).toLocaleDateString())}</span>
                  </td>
                  <td>${statusBadge(post)}</td>
                  <td class="admin-actions"><a class="button secondary" href="/writer/edit/${encodeURIComponent(post.id)}">Edit</a></td>
                </tr>`,
                )
                .join("")}
            </table>`
          : '<p class="empty-message">No articles yet. Write your first one!</p>'
      }
    </section>
    <section class="content-width card-panel">
      <div class="quick-links">
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
      </div>
      <button class="button secondary" id="writer-signout" type="button">Sign out</button>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: "/writer" });
  bindShell(root);
  root.querySelector("#writer-signout")?.addEventListener("click", async () => {
    await auth.signOut();
    window.location.assign("/auth?mode=login");
  });
};

// ---------------------------------------------------------------------------
// /writer/new-article, /writer/edit/:id
// ---------------------------------------------------------------------------
export const renderWriterArticleEditor = async (root, articleId = null) => {
  const isEditing = Boolean(articleId);
  setPageMetadata({
    title: `${isEditing ? "Edit Article" : "New Article"} | MetsXMFanZone Writer Portal`,
    description: "Write and manage MetsXMFanZone blog articles.",
    path: isEditing ? `/writer/edit/${articleId}` : "/writer/new-article",
    noindex: true,
  });

  root.innerHTML = renderShell({
    content: statusPanel("Writer Portal", "Loading editor…"),
    currentPath: isEditing ? `/writer/edit/${articleId}` : "/writer/new-article",
  });
  bindShell(root);

  const state = await requireWriter(root, isEditing ? `/writer/edit/${articleId}` : "/writer/new-article");
  if (!state) return;

  let article = { title: "", slug: "", excerpt: "", content: "", category: "News", tags: "", featured_image_url: "" };

  if (isEditing) {
    const { data, error } = await backend
      .from("blog_posts")
      .select("id,title,slug,excerpt,content,category,tags,featured_image_url,user_id")
      .eq("id", articleId)
      .maybeSingle();
    if (error || !data || (data.user_id !== state.user.id && !state.isAdmin)) {
      window.location.replace("/writer");
      return;
    }
    article = { ...article, ...data, tags: Array.isArray(data.tags) ? data.tags.join(", ") : data.tags || "" };
  }

  const categories = ["News", "Analysis", "Opinion", "Game Recap", "Player Spotlight", "Trade Rumors", "Prospects", "History"];

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Writer Portal</p>
      <h1>${isEditing ? "Edit Article" : "New Article"}</h1>
    </section>
    <section class="content-width card-panel">
      <form class="stacked-form" id="article-form" style="max-width:none;">
        <label>Title<input name="title" type="text" required value="${escapeHtml(article.title)}"></label>
        <label>Slug<input name="slug" type="text" required value="${escapeHtml(article.slug)}"></label>
        <label>Excerpt<textarea name="excerpt" rows="2">${escapeHtml(article.excerpt || "")}</textarea></label>
        <label>Content<textarea name="content" rows="12" required>${escapeHtml(article.content || "")}</textarea></label>
        <label>Category
          <select name="category">
            ${categories.map((cat) => `<option value="${cat}" ${cat === article.category ? "selected" : ""}>${cat}</option>`).join("")}
          </select>
        </label>
        <label>Tags (comma separated)<input name="tags" type="text" value="${escapeHtml(article.tags || "")}"></label>
        <label>Featured image URL<input name="featuredImageUrl" type="url" value="${escapeHtml(article.featured_image_url || "")}"></label>
        <p class="form-error" id="article-error" role="alert" hidden></p>
        <p class="form-note" id="article-note" role="status" hidden></p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="button secondary" type="submit" data-action="draft">Save draft</button>
          <button class="button primary" type="submit" data-action="submit">Submit for review</button>
          <a class="button secondary" href="/writer">Cancel</a>
        </div>
      </form>
    </section>`;

  root.innerHTML = renderShell({
    content,
    currentPath: isEditing ? `/writer/edit/${articleId}` : "/writer/new-article",
  });
  bindShell(root);

  const form = root.querySelector("#article-form");
  const error = root.querySelector("#article-error");
  const note = root.querySelector("#article-note");
  let submitAction = "draft";

  form?.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      submitAction = button.dataset.action;
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    note.hidden = true;
    const data = new FormData(form);
    const payload = {
      title: String(data.get("title") || "").trim(),
      slug: String(data.get("slug") || "").trim(),
      excerpt: String(data.get("excerpt") || "").trim(),
      content: String(data.get("content") || ""),
      category: String(data.get("category") || "News"),
      tags: String(data.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      featured_image_url: String(data.get("featuredImageUrl") || "").trim() || null,
      user_id: state.user.id,
      published: submitAction === "submit",
      approval_status: submitAction === "submit" ? "pending" : "draft",
    };

    try {
      if (isEditing) {
        const { error: updateError } = await backend.from("blog_posts").update(payload).eq("id", articleId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await backend.from("blog_posts").insert(payload);
        if (insertError) throw insertError;
      }
      note.textContent = submitAction === "submit" ? "Submitted for review." : "Draft saved.";
      note.hidden = false;
      setTimeout(() => window.location.assign("/writer"), 900);
    } catch (failure) {
      error.textContent = escapeHtml(failure?.message || "Could not save article. Please try again.");
      error.hidden = false;
    }
  });
};

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------
export const accountRoutes = [
  { path: "/dashboard", render: (root) => renderDashboard(root) },
  { path: "/dashboard/cancellation-status", render: (root) => renderCancellationStatus(root) },
  { path: "/pricing", render: (root, ctx) => renderPlans(root, ctx?.pathname || "/pricing") },
  { path: "/plans", render: (root, ctx) => renderPlans(root, ctx?.pathname || "/plans") },
  { path: "/payment-success", render: (root) => renderPaymentSuccess(root) },
  { path: "/payment-error", render: (root) => renderPaymentError(root) },
  { path: "/paypal-success", render: (root) => renderPayPalSuccess(root) },
  { path: "/confirm-account", render: (root) => renderConfirmAccount(root) },
  { path: "/unsubscribe", render: (root) => renderUnsubscribe(root) },
  { path: "/logout", render: (root) => renderLogout(root) },
  { path: "/rewards/claim", render: (root) => renderRewardClaim(root) },
  { path: "/writer", render: (root) => renderWriterDashboard(root) },
  { path: "/writer-auth", render: (root) => renderWriterAuth(root) },
  { path: "/writer-register", render: (root) => renderWriterRegister(root) },
  { path: "/writer/new-article", render: (root) => renderWriterArticleEditor(root) },
  { path: "/writer/edit/:id", render: (root, ctx) => renderWriterArticleEditor(root, ctx?.params?.id) },
];

export default accountRoutes;

import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

export const CANCELLATION_RESULT_KEY = "mxfz_cancellation_result";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "News, community, and your member profile",
    features: ["Public Mets news", "Community access", "Member profile", "No payment required"],
  },
  {
    id: "weekly",
    name: "Weekly",
    price: "$3.99",
    period: "per week",
    description: "Budget-friendly full access",
    features: ["Full access to everything", "All live streams", "Full game replays", "Community forum access", "Ad-free experience", "Cancel anytime"],
  },
  {
    id: "premium",
    name: "Monthly",
    price: "$9.99",
    period: "per month",
    description: "Most popular for true fans",
    features: ["All live streams", "Full game replays", "All highlights", "Community forum access", "Ad-free experience", "Exclusive content", "HD streaming"],
    featured: true,
  },
  {
    id: "annual",
    name: "Yearly",
    price: "$129.99",
    period: "per year",
    description: "Best value — save 2 months",
    features: ["Everything in Premium", "Save $20/year", "Priority support", "Early access to content", "VIP community badge"],
  },
];

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—";

export const renderPlans = async (root, pathname = "/plans") => {
  setPageMetadata({
    title: "Membership Plans | MetsXMFanZone",
    description: "Choose a MetsXMFanZone membership for live Mets games, replays, members news, and community access.",
    path: pathname,
    image: "/share/pricing.jpg",
  });

  const state = await auth.ready();
  const required = new URLSearchParams(window.location.search).get("required") === "true";

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Membership</p>
      <h1>Choose your plan</h1>
      ${required ? '<p class="form-note">A membership is required to continue.</p>' : ""}
      <p>Live games, replays, members news, podcasts, and the fan community.</p>
    </section>
    <section class="content-width plan-grid">
      ${PLANS.map(
        (plan) => `
        <article class="plan-card ${plan.featured ? "is-featured" : ""}">
          <h2>${escapeHtml(plan.name)}</h2>
          <p class="plan-price">${escapeHtml(plan.price)}<span>${escapeHtml(plan.period)}</span></p>
          <p class="form-note">${escapeHtml(plan.description)}</p>
          <ul>${plan.features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          <button class="button primary" type="button" data-plan="${plan.id}">
            ${state.user ? (plan.id === "free" ? "Choose Free" : "Continue with PayPal") : "Create account to join"}
          </button>
        </article>`,
      ).join("")}
    </section>
    <p class="content-width form-error" id="plan-error" hidden role="alert"></p>
    <section class="content-width form-note" style="padding-bottom:40px;">
      <p>Payments are securely processed by PayPal. Cancel anytime from your account. 7-day money-back guarantee for first-time subscribers.</p>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const error = root.querySelector("#plan-error");
  root.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.user) {
        localStorage.setItem("pending_membership_selection", "true");
        window.location.assign("/auth?mode=signup");
        return;
      }
      button.disabled = true;
      error.hidden = true;
      try {
        const functionName = button.dataset.plan === "free" ? "activate-free-membership" : "create-paypal-order";
        const { data, error: invokeError } = await backend.functions.invoke(functionName, {
          body: button.dataset.plan === "free" ? {} : { planType: button.dataset.plan, promoCode: null, returnOrigin: window.location.origin },
        });
        if (invokeError) throw invokeError;
        if (button.dataset.plan === "free" && data?.success) {
          localStorage.removeItem("pending_membership_selection");
          window.location.assign("/dashboard");
          return;
        }
        if (!data?.approvalUrl) throw new Error("Payment could not be started. Please try again.");
        window.location.href = data.approvalUrl;
      } catch (failure) {
        error.textContent = failure?.message || "Payment could not be started. Please try again.";
        error.hidden = false;
        button.disabled = false;
      }
    });
  });
};

const recordCancellationResult = (result) => {
  try {
    sessionStorage.setItem(CANCELLATION_RESULT_KEY, JSON.stringify({ ...result, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable */
  }
};

export const renderDashboard = async (root) => {
  setPageMetadata({
    title: "My Account | MetsXMFanZone",
    description: "Manage your MetsXMFanZone account, membership, and preferences.",
    path: "/dashboard",
  });

  root.innerHTML = renderShell({ content: statusPanel("My Account", "Loading your account…"), currentPath: "/dashboard" });
  bindShell(root);

  const state = await auth.ready();
  if (!state.user) {
    window.location.replace("/auth?next=/dashboard");
    return;
  }

  const { data: subscription } = await backend
    .from("subscriptions")
    .select("plan_type,status,end_date,start_date")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const name = state.profile?.full_name || state.user.email;
  const tier = subscription?.plan_type || state.profile?.subscription_tier || "free";
  const status = subscription?.status || state.profile?.subscription_status || "inactive";
  const isActive = status === "active" && tier !== "free";

  const render = () => {
    const content = `
      <section class="content-width page-heading">
        <p class="eyebrow">My Account</p>
        <h1>${escapeHtml(name)}</h1>
        <p>${escapeHtml(state.user.email || "")}</p>
      </section>
      <section class="content-width card-panel">
        <h2>Profile</h2>
        <form class="stacked-form" id="profile-form">
          <label>Full name<input name="fullName" type="text" value="${escapeHtml(state.profile?.full_name || "")}"></label>
          <p class="form-error" id="profile-error" role="alert" hidden></p>
          <p class="form-note" id="profile-note" role="status" hidden></p>
          <button class="button secondary" type="submit">Save profile</button>
        </form>
      </section>
      <section class="content-width card-panel">
        <h2>Membership</h2>
        <dl class="detail-list">
          <div><dt>Plan</dt><dd>${escapeHtml(String(tier))}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(String(status))}</dd></div>
          <div><dt>Renews / ends</dt><dd>${escapeHtml(formatDate(subscription?.end_date || state.profile?.subscription_end_date))}</dd></div>
        </dl>
        ${
          isActive
            ? '<button class="button secondary" id="cancel-subscription" type="button">Cancel membership</button>'
            : '<a class="button primary" href="/pricing">Choose a plan</a>'
        }
        <p class="form-error" id="cancel-error" role="alert" hidden></p>
        ${isActive ? '<p class="form-note">Cancelling stops PayPal renewal while keeping your account and history. More than two cancellations limits paid access.</p>' : ""}
      </section>
      <section class="content-width card-panel">
        <h2>Quick links</h2>
        <div class="quick-links">
          <a href="/metsxmfanzone">Watch Live</a>
          <a href="/blog">Mets News</a>
          <a href="/community">Community</a>
          <a href="/podcast">Podcast</a>
          <a href="/help-center">Help Center</a>
          ${state.isAdmin ? '<a href="/admin">Admin</a>' : ""}
        </div>
        <button class="button secondary" id="account-signout" type="button">Sign out</button>
      </section>`;

    root.innerHTML = renderShell({ content, currentPath: "/dashboard" });
    bindShell(root);

    root.querySelector("#account-signout")?.addEventListener("click", async () => {
      await auth.signOut();
      window.location.assign("/");
    });

    const profileForm = root.querySelector("#profile-form");
    const profileError = root.querySelector("#profile-error");
    const profileNote = root.querySelector("#profile-note");
    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      profileError.hidden = true;
      profileNote.hidden = true;
      const fullName = String(new FormData(profileForm).get("fullName") || "").trim();
      const submit = profileForm.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        const { error } = await backend.from("profiles").update({ full_name: fullName }).eq("id", state.user.id);
        if (error) throw error;
        profileNote.textContent = "Profile updated.";
        profileNote.hidden = false;
      } catch (failure) {
        profileError.textContent = failure?.message || "Failed to update profile. Please try again.";
        profileError.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });

    const cancelButton = root.querySelector("#cancel-subscription");
    const cancelError = root.querySelector("#cancel-error");
    cancelButton?.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Cancel your membership? PayPal renewal will stop, but your account and history will remain. More than two cancellations will limit paid access until an admin restores it.",
      );
      if (!confirmed) return;
      cancelButton.disabled = true;
      cancelError.hidden = true;
      try {
        const { data, error } = await backend.functions.invoke("cancel-subscription", { body: {} });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to cancel");
        recordCancellationResult({ paypalConfirmed: true, accountRetained: true, cancellationCount: data?.cancellationCount, limitedAccess: data?.limitedAccess, message: data?.message });
        window.location.assign("/dashboard/cancellation-status");
      } catch (failure) {
        recordCancellationResult({ paypalConfirmed: false, accountRetained: true, error: failure?.message || "Failed to cancel" });
        window.location.assign("/dashboard/cancellation-status");
      }
    });
  };

  render();
};

import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell } from "../ui/shell.js";

const form = (mode) => {
  const isSignUp = mode === "signup";
  const isReset = mode === "reset";
  return `
    <section class="content-width auth-panel">
      <p class="eyebrow">MetsXMFanZone</p>
      <h1>${isSignUp ? "Create your account" : isReset ? "Reset your password" : "Sign in"}</h1>
      <form class="stacked-form" id="auth-form" novalidate>
        ${isSignUp ? '<label>Full name<input name="fullName" type="text" autocomplete="name" required></label>' : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        ${isReset ? "" : `<label>Password<input name="password" type="password" autocomplete="${isSignUp ? "new-password" : "current-password"}" minlength="6" required></label>`}
        <p class="form-error" id="auth-error" role="alert" hidden></p>
        <p class="form-note" id="auth-note" role="status" hidden></p>
        <button class="button primary" type="submit">${isSignUp ? "Create account" : isReset ? "Send reset link" : "Sign in"}</button>
      </form>
      <div class="auth-links">
        ${isSignUp ? '<a href="/auth">Already have an account? Sign in</a>' : '<a href="/auth?mode=signup">New here? Create an account</a>'}
        ${isReset ? '<a href="/auth">Back to sign in</a>' : '<a href="/auth?mode=reset">Forgot password?</a>'}
      </div>
    </section>`;
};

export const renderAuth = async (root) => {
  const mode = new URLSearchParams(window.location.search).get("mode") || "signin";

  setPageMetadata({
    title: "Sign In | MetsXMFanZone",
    description: "Sign in or create your MetsXMFanZone account to watch live games, read members news, and join the community.",
    path: "/auth",
  });

  const state = await auth.ready();
  if (state.user) {
    window.location.replace("/dashboard");
    return;
  }

  root.innerHTML = renderShell({ content: form(mode), currentPath: "/auth" });
  bindShell(root);

  const element = root.querySelector("#auth-form");
  const error = root.querySelector("#auth-error");
  const note = root.querySelector("#auth-note");

  element?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!element.reportValidity()) return;

    const data = new FormData(element);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const fullName = String(data.get("fullName") || "").trim();
    const submit = element.querySelector("button[type=submit]");

    error.hidden = true;
    note.hidden = true;
    submit.disabled = true;

    try {
      if (mode === "reset") {
        const { error: resetError } = await backend.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        note.textContent = "Check your email for the reset link.";
        note.hidden = false;
      } else if (mode === "signup") {
        await auth.signUp(email, password, fullName);
        note.textContent = "Account created. Check your email to confirm, then sign in.";
        note.hidden = false;
      } else {
        await auth.signIn(email, password);
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(next && next.startsWith("/") ? next : "/dashboard");
        return;
      }
    } catch (failure) {
      error.textContent = escapeHtml(failure?.message || "Something went wrong. Please try again.");
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
};

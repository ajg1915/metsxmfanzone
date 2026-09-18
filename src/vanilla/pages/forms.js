import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell } from "../ui/shell.js";

const FORMS = {
  "/contact": {
    eyebrow: "Support",
    heading: "Contact MetsXMFanZone",
    intro: "Questions about your account, membership, or a stream? Send us a message and we'll get back to you.",
    table: "contact_submissions",
    fields: [
      { name: "name", label: "Your name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "message", label: "How can we help?", type: "textarea", required: true },
    ],
    success: "Thanks — your message is with our support team.",
  },
  "/feedback": {
    eyebrow: "Feedback",
    heading: "Tell us what you think",
    intro: "Ideas, bugs, or something you'd love to see on MetsXMFanZone? We read every note.",
    table: "feedbacks",
    requiresAuth: true,
    fields: [
      { name: "display_name", label: "Display name", type: "text", required: false },
      { name: "location", label: "Where are you watching from?", type: "text", required: false },
      { name: "rating", label: "Rating out of 5", type: "number", required: false },
      { name: "content", label: "Your feedback", type: "textarea", required: true },
    ],
    success: "Thanks for the feedback — it really helps.",
  },
};

export const formPaths = Object.keys(FORMS);

const field = (item) =>
  item.type === "textarea"
    ? `<label>${escapeHtml(item.label)}<textarea name="${item.name}" rows="5" ${item.required ? "required" : ""}></textarea></label>`
    : `<label>${escapeHtml(item.label)}<input name="${item.name}" type="${item.type}" ${item.required ? "required" : ""}></label>`;

export const renderFormPage = async (root, pathname) => {
  const config = FORMS[pathname];
  setPageMetadata({
    title: `${config.heading} | MetsXMFanZone`,
    description: config.intro,
    path: pathname,
  });

  const state = await auth.ready();
  if (config.requiresAuth && !state.user) {
    root.innerHTML = renderShell({
      content: `<section class="content-width page-heading"><p class="eyebrow">${escapeHtml(config.eyebrow)}</p><h1>${escapeHtml(config.heading)}</h1><p class="form-note">Please <a href="/auth?next=${encodeURIComponent(pathname)}">sign in</a> to share feedback.</p></section>`,
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">${escapeHtml(config.eyebrow)}</p>
      <h1>${escapeHtml(config.heading)}</h1>
      <p>${escapeHtml(config.intro)}</p>
    </section>
    <section class="content-width">
      <form class="stacked-form" id="page-form" novalidate>
        ${config.fields.map(field).join("")}
        <p class="form-error" id="form-error" hidden role="alert"></p>
        <p class="form-note" id="form-success" hidden role="status"></p>
        <button class="button primary" type="submit">Send</button>
      </form>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const form = root.querySelector("#page-form");
  if (state.user) {
    const email = form.querySelector('input[name="email"]');
    if (email && !email.value) email.value = state.user.email || "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const error = root.querySelector("#form-error");
    const success = root.querySelector("#form-success");
    const submit = form.querySelector("button[type=submit]");
    error.hidden = true;
    success.hidden = true;
    submit.disabled = true;

    const payload = Object.fromEntries(
      config.fields.map((item) => [item.name, String(new FormData(form).get(item.name) || "").trim()]),
    );
    if (state.user) payload.user_id = state.user.id;
    if ("rating" in payload) payload.rating = payload.rating ? Number(payload.rating) : null;
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") payload[key] = null;
    });

    const { error: insertError } = await backend.from(config.table).insert(payload);
    if (insertError) {
      error.textContent = insertError.message || "Your message could not be sent. Please try again.";
      error.hidden = false;
      submit.disabled = false;
      return;
    }

    form.reset();
    success.textContent = config.success;
    success.hidden = false;
    submit.disabled = false;
  });
};

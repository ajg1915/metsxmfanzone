import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";
import { attachPlayer } from "./watch.js";

const gate = (pathname) =>
  statusPanel("Members only", "A MetsXMFanZone membership is required to watch live streams.", {
    href: `/plans?required=true&next=${encodeURIComponent(pathname)}`,
    label: "See membership plans",
  });

const adminGate = (pathname) =>
  statusPanel("Access Restricted", "This page is only available to administrators.", {
    href: "/",
    label: "Back to Home",
  });

const signInGate = (pathname) =>
  statusPanel("Sign in required", "Sign in to your MetsXMFanZone account to continue.", {
    href: `/auth?next=${encodeURIComponent(pathname)}`,
    label: "Sign in",
  });

/* ================= Network Pages (ESPN, MLB, MSG, PIX11) ================= */

const renderNetworkPage = async (root, pathname, { title, description, streamPageKey, image, color }) => {
  setPageMetadata({
    title: `${title} Live - Watch Coverage | MetsXMFanZone`,
    description,
    path: pathname,
    image: image || "/share/metsxmfanzone.jpg",
    type: "video.other",
  });

  root.innerHTML = renderShell({ content: statusPanel(title, "Loading stream..."), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  // React versions use StreamTimeLimit with allowGuestPreview. 
  // For simplicity in vanilla, we check membership unless instructed otherwise.
  if (!state.isMember) {
    root.innerHTML = renderShell({ content: gate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const { data } = await backend
    .from("live_streams")
    .select("id,title,description,stream_url,thumbnail_url,status,scheduled_start")
    .eq("published", true)
    .contains("assigned_pages", [streamPageKey])
    .order("display_order", { ascending: true })
    .limit(1);

  const stream = data?.[0];
  if (!stream) {
    root.innerHTML = renderShell({
      content: statusPanel(title, "Nothing is streaming on this channel right now.", { href: "/", label: "Back home" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  const content = `
    <div class="network-hero" style="background: linear-gradient(135deg, ${color}, #000); padding: 40px 20px; color: #fff;">
      <div class="content-width">
        <span class="eyebrow" style="color: rgba(255,255,255,0.7)">Live Broadcast</span>
        <h1 style="margin: 10px 0;">${escapeHtml(title)}</h1>
        <p style="opacity: 0.8; max-width: 600px;">${escapeHtml(description)}</p>
      </div>
    </div>
    <section class="content-width" style="margin-top: -20px;">
      <div class="card-panel" style="padding: 0; overflow: hidden; border-radius: 12px; background: #000;">
        <video id="network-player" class="stream-player" controls playsinline autoplay 
               poster="${escapeHtml(stream.thumbnail_url || image || "/share/metsxmfanzone.jpg")}"
               style="width: 100%; aspect-ratio: 16/9; display: block;"></video>
      </div>
      <div style="margin-top: 20px;">
        <h2>${escapeHtml(stream.title || title)}</h2>
        <p class="stream-meta">${stream.status === "live" ? "Live now" : "Scheduled"}</p>
        ${stream.description ? `<p>${escapeHtml(stream.description)}</p>` : ""}
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const video = root.querySelector("#network-player");
  const detach = attachPlayer(video, stream.stream_url);
  window.addEventListener("popstate", detach, { once: true });
};

/* ================= Admin Portal ================= */

export const renderAdminPortal = async (root, pathname = "/admin-portal") => {
  setPageMetadata({ title: "Admin Portal | MetsXMFanZone", path: pathname });
  
  const content = `
    <section class="content-width article" style="max-width: 400px; margin: 60px auto;">
      <div class="card-panel">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background: var(--secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="white" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style="font-size: 24px;">Admin Portal</h1>
          <p class="stream-meta">Sign in to access administration</p>
        </div>
        
        <form id="admin-login-form" class="space-y-4">
          <div class="search-field">
            <label>Admin Email</label>
            <input type="email" id="admin-email" required placeholder="email@example.com">
          </div>
          <div class="search-field">
            <label>Password</label>
            <input type="password" id="admin-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="button primary" style="width: 100%; margin-top: 20px;">Access Admin Panel</button>
        </form>
        
        <div id="admin-error" style="color: var(--destructive); font-size: 13px; margin-top: 12px; text-align: center; display: none;"></div>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="/" class="stream-meta" style="text-decoration: none;">Return to Home</a>
        </div>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const form = root.querySelector("#admin-login-form");
  const errorEl = root.querySelector("#admin-error");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = root.querySelector("#admin-email").value;
    const password = root.querySelector("#admin-password").value;
    
    errorEl.style.display = "none";
    
    try {
      const { data, error } = await backend.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const { data: roleData } = await backend
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
        
      if (!roleData) {
        await backend.auth.signOut();
        throw new Error("Access denied. Admin role required.");
      }
      
      sessionStorage.setItem("admin_verified", "true");
      sessionStorage.setItem("admin_verified_at", new Date().toISOString());
      
      window.location.href = "/admin";
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  });
};

/* ================= Admin Setup ================= */

export const renderAdminSetup = async (root, pathname = "/legal/admin-setup") => {
  setPageMetadata({ title: "Admin Setup | MetsXMFanZone", path: pathname });
  
  const state = await auth.ready();
  if (!state.user) {
    root.innerHTML = renderShell({ content: signInGate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const sqlQuery = `INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = '${state.user.email}'
ON CONFLICT (user_id, role) DO NOTHING;`;

  const content = `
    <section class="content-width article" style="max-width: 600px; margin: 40px auto;">
      <div class="card-panel">
        <h1>Admin Setup</h1>
        <p>Grant yourself admin access to use the admin portal.</p>
        
        <div style="margin: 20px 0; padding: 16px; background: var(--muted); border-radius: 8px;">
          <h3 style="margin-bottom: 8px;">Your Email:</h3>
          <p>${escapeHtml(state.user.email)}</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h3>Steps to become an admin:</h3>
          <ol style="padding-left: 20px; line-height: 1.6;">
            <li>Copy the SQL query below</li>
            <li>Open your Backend Database section</li>
            <li>Run the query in the SQL Editor</li>
            <li>Click "Check Status" below</li>
          </ol>
        </div>
        
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3>SQL Query:</h3>
            <button id="copy-sql" class="button ghost small">Copy</button>
          </div>
          <pre style="background: #000; color: #0f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${escapeHtml(sqlQuery)}</pre>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="check-status" class="button primary" style="flex: 1;">Check Admin Status</button>
          <a href="/" class="button ghost" style="flex: 1; text-align: center;">Back to Home</a>
        </div>
        <div id="setup-message" style="margin-top: 16px; text-align: center; font-weight: 500;"></div>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  root.querySelector("#copy-sql")?.addEventListener("click", () => {
    navigator.clipboard.writeText(sqlQuery);
    alert("SQL copied to clipboard!");
  });

  root.querySelector("#check-status")?.addEventListener("click", async () => {
    const msg = root.querySelector("#setup-message");
    msg.textContent = "Checking...";
    
    const { data } = await backend
      .from("user_roles")
      .select("role")
      .eq("user_id", state.user.id)
      .eq("role", "admin")
      .maybeSingle();
      
    if (data) {
      msg.style.color = "var(--secondary)";
      msg.textContent = "Success! You are an admin. Redirecting...";
      setTimeout(() => window.location.href = "/admin", 1500);
    } else {
      msg.style.color = "var(--destructive)";
      msg.textContent = "Admin role not found yet. Did you run the query?";
    }
  });
};

/* ================= Admin PIN Reset ================= */

export const renderAdminPinReset = async (root, pathname = "/admin-pin-reset") => {
  setPageMetadata({ title: "Reset Admin PIN | MetsXMFanZone", path: pathname });
  
  root.innerHTML = renderShell({ content: statusPanel("PIN Reset", "Verifying session..."), currentPath: pathname });
  bindShell(root);
  
  const state = await auth.ready();
  if (!state.isAdmin) {
    root.innerHTML = renderShell({ content: adminGate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const content = `
    <section class="content-width article" style="max-width: 400px; margin: 60px auto;">
      <div class="card-panel">
        <h1 style="text-align: center;">Reset Admin PIN</h1>
        <p style="text-align: center; margin-bottom: 24px;">Choose a new security PIN (4-8 digits)</p>
        
        <form id="pin-reset-form" class="space-y-4">
          <div class="search-field">
            <label>New PIN</label>
            <input type="password" id="new-pin" required minlength="4" maxlength="8" style="text-align: center; letter-spacing: 0.3em;">
          </div>
          <div class="search-field">
            <label>Confirm PIN</label>
            <input type="password" id="confirm-pin" required minlength="4" maxlength="8" style="text-align: center; letter-spacing: 0.3em;">
          </div>
          <button type="submit" class="button primary" style="width: 100%; margin-top: 20px;">Update PIN</button>
        </form>
        <div id="pin-message" style="margin-top: 16px; text-align: center;"></div>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  root.querySelector("#pin-reset-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = root.querySelector("#new-pin").value;
    const confirm = root.querySelector("#confirm-pin").value;
    const msg = root.querySelector("#pin-message");
    
    if (pin !== confirm) {
      msg.style.color = "var(--destructive)";
      msg.textContent = "PINs do not match!";
      return;
    }
    
    msg.style.color = "inherit";
    msg.textContent = "Updating...";
    
    try {
      // In a real implementation, this calls an edge function
      // Since we don't have the edge function helper here, we assume it's like a backend call
      const { error } = await backend.functions.invoke("admin-pin-login", {
        body: { action: "setup-pin", userId: state.user.id, newPin: pin },
      });
      
      if (error) throw error;
      
      msg.style.color = "var(--secondary)";
      msg.textContent = "PIN updated successfully! Redirecting...";
      setTimeout(() => window.location.href = "/admin-portal", 2000);
    } catch (err) {
      msg.style.color = "var(--destructive)";
      msg.textContent = err.message || "Failed to update PIN.";
    }
  });
};

/* ================= Private Player ================= */

export const renderPrivatePlayer = async (root, pathname = "/private-player") => {
  setPageMetadata({ title: "Private Player | MetsXMFanZone", path: pathname });
  
  root.innerHTML = renderShell({ content: statusPanel("Private Player", "Loading..."), currentPath: pathname });
  bindShell(root);
  
  const state = await auth.ready();
  if (!state.isAdmin) {
    root.innerHTML = renderShell({ content: adminGate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const { data: setting } = await backend
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", "admin_private_player")
    .maybeSingle();
    
  const cfg = setting?.setting_value || { enabled: false, title: "Private Player", iframeUrl: "" };
  
  if (!cfg.enabled || !cfg.iframeUrl) {
    root.innerHTML = renderShell({ 
      content: statusPanel("Private Player", "Player is disabled or not configured.", { href: "/admin", label: "Admin Panel" }), 
      currentPath: pathname 
    });
    bindShell(root);
    return;
  }

  const content = `
    <section class="content-width">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        <h1>${escapeHtml(cfg.title || "Private Player")}</h1>
      </div>
      <div class="card-panel" style="padding: 0; overflow: hidden; border-radius: 12px; background: #000; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <iframe src="${escapeHtml(cfg.iframeUrl)}" 
                style="width: 100%; aspect-ratio: 16/9; border: 0;" 
                allow="autoplay; encrypted-media; fullscreen" 
                allowfullscreen></iframe>
      </div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= Routes Export ================= */

export const networkRoutes = [
  {
    path: "/espn-network",
    render: (root) => renderNetworkPage(root, "/espn-network", {
      title: "ESPN Network",
      description: "Watch ESPN Network live baseball coverage, game analysis, and expert commentary.",
      streamPageKey: "espn-network",
      color: "#CC0000",
      image: "/share/espn-network.jpg"
    })
  },
  {
    path: "/mlb-network",
    render: (root) => renderNetworkPage(root, "/mlb-network", {
      title: "MLB Network",
      description: "Watch MLB Network live games, highlights, and expert baseball analysis.",
      streamPageKey: "mlb-network",
      color: "#041E42",
      image: "/share/mlb-network.jpg"
    })
  },
  {
    path: "/msg-network",
    render: (root) => renderNetworkPage(root, "/msg-network", {
      title: "MSG Network",
      description: "Watch MSG Network live Mets baseball coverage and exclusive shows.",
      streamPageKey: "msg-network",
      color: "#003DA5",
      image: "/share/msg-network.jpg"
    })
  },
  {
    path: "/pix11-network",
    render: (root) => renderNetworkPage(root, "/pix11-network", {
      title: "MetsXMFanZone Game Events",
      description: "Live non-Mets games and special event streams on MetsXMFanZone.",
      streamPageKey: "pix11-network",
      color: "#1e3a5f",
      image: "/share/pix11-network.jpg"
    })
  },
  {
    path: "/private-player",
    render: (root) => renderPrivatePlayer(root, "/private-player")
  },
  {
    path: "/admin-portal",
    render: (root) => renderAdminPortal(root, "/admin-portal")
  },
  {
    path: "/admin-pin-reset",
    render: (root) => renderAdminPinReset(root, "/admin-pin-reset")
  },
  {
    path: "/legal/admin-setup",
    render: (root) => renderAdminSetup(root, "/legal/admin-setup")
  }
];

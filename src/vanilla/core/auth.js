import { backend } from "./backend.js";

// Plain event-based auth store: replaces the React AuthProvider.
const listeners = new Set();

const state = {
  ready: false,
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isMember: false,
};

const notify = () => listeners.forEach((listener) => listener({ ...state }));

const loadProfile = async (user) => {
  if (!user) {
    state.profile = null;
    state.isAdmin = false;
    state.isMember = false;
    return;
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    backend
      .from("profiles")
      .select("id,full_name,avatar_url,subscription_tier,subscription_status,subscription_end_date")
      .eq("id", user.id)
      .maybeSingle(),
    backend.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  state.profile = profile || null;
  state.isAdmin = (roles || []).some((row) => row.role === "admin");

  const tier = profile?.subscription_tier;
  const status = profile?.subscription_status;
  const notExpired =
    !profile?.subscription_end_date || new Date(profile.subscription_end_date) > new Date();
  state.isMember =
    state.isAdmin || (Boolean(tier) && tier !== "free" && status === "active" && notExpired);
};

const applySession = async (session) => {
  state.session = session || null;
  state.user = session?.user || null;
  await loadProfile(state.user);
  state.ready = true;
  notify();
};

export const auth = {
  get state() {
    return { ...state };
  },

  subscribe(listener) {
    listeners.add(listener);
    if (state.ready) listener({ ...state });
    return () => listeners.delete(listener);
  },

  async start() {
    backend.auth.onAuthStateChange((_event, session) => {
      // Keep the callback synchronous-safe; profile lookup runs after.
      void applySession(session);
    });
    const { data } = await backend.auth.getSession();
    await applySession(data?.session || null);
    return { ...state };
  },

  async ready() {
    if (state.ready) return { ...state };
    return new Promise((resolve) => {
      const stop = this.subscribe((next) => {
        if (!next.ready) return;
        stop();
        resolve(next);
      });
    });
  },

  async signIn(email, password) {
    const { error } = await backend.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signUp(email, password, fullName) {
    const { error } = await backend.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-account`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    if (error) throw error;
  },

  async signOut() {
    try {
      await backend.auth.signOut();
    } finally {
      await applySession(null);
    }
  },
};

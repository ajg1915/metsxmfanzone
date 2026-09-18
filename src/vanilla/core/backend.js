import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  console.warn("MetsXMFanZone backend configuration is missing.");
}

export const backend = createClient(url || "https://example.invalid", publishableKey || "missing", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const getCurrentUser = async () => {
  const { data, error } = await backend.auth.getUser();
  if (error) return null;
  return data.user || null;
};

export const hasRole = async (userId, role) => {
  if (!userId) return false;
  const { data, error } = await backend
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !error && Boolean(data);
};
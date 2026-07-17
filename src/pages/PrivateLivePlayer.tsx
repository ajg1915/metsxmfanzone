import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Lock } from "lucide-react";
import {
  PRIVATE_PLAYER_SETTING_KEY,
  PRIVATE_PLAYER_DEFAULTS,
  getPrivatePlayerIframeUrl,
  getPrivatePlayerSourceError,
  type PrivatePlayerConfig,
} from "@/lib/privatePlayer";

export default function PrivateLivePlayer() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "denied" | "ok">("checking");
  const [cfg, setCfg] = useState<PrivatePlayerConfig>(PRIVATE_PLAYER_DEFAULTS);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setStatus("denied");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        setStatus("denied");
        return;
      }
      const { data: settingRow } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", PRIVATE_PLAYER_SETTING_KEY)
        .maybeSingle();
      if (settingRow?.setting_value) {
        setCfg({ ...PRIVATE_PLAYER_DEFAULTS, ...(settingRow.setting_value as Partial<PrivatePlayerConfig>) });
      }
      setStatus("ok");
    })();
  }, []);

  if (status === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Restricted</h1>
        <p className="text-muted-foreground max-w-md">
          This player is only available to administrators.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const effectiveUrl = getPrivatePlayerIframeUrl(cfg);
  const sourceError = getPrivatePlayerSourceError(cfg);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Tv className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{cfg.title}</h1>
            <p className="text-xs text-muted-foreground">Admin-only private live stream player.</p>
          </div>
        </div>

        {!cfg.enabled ? (
          <div className="rounded-xl border border-border bg-card/80 p-8 text-center text-muted-foreground">
            The private player is currently disabled. Enable it in{" "}
            <a href="/admin/private-player" className="text-primary underline">
              Admin → Private Player
            </a>
            .
          </div>
        ) : sourceError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center text-destructive">
            {sourceError} Update it in{" "}
            <a href="/admin/private-player" className="underline">
              Admin → Private Player
            </a>
            .
          </div>
        ) : effectiveUrl ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-background ring-1 ring-border shadow-2xl shadow-primary/10">
            <iframe
              src={effectiveUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={cfg.title}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/80 p-8 text-center text-muted-foreground">
            No iframe configured yet. Add an embed URL in{" "}
            <a href="/admin/private-player" className="text-primary underline">
              Admin → Private Player
            </a>
            .
          </div>
        )}
      </div>
    </div>
  );
}

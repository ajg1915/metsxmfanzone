import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Monitor, Smartphone, Home, LogIn, X, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/metsxmfanzone-logo.png";

const STORAGE_KEY = "desktop_welcome_gate_dismissed";
const SETTING_KEY = "desktop_welcome_gate";

type GateConfig = {
  title: string;
  subtitle: string;
  note: string;
};

const DEFAULTS: GateConfig = {
  title: "Best viewed on mobile",
  subtitle:
    "MetsXMFanZone is optimized for the mobile experience. For the best experience, please open this site on your phone.",
  note: "Prefer to continue on desktop? Choose an option below.",
};

/**
 * Desktop-only welcome gate shown on the homepage.
 * Admins can edit the title/subtitle/note inline; values persist to site_settings.
 */
export const DesktopWelcomeGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<GateConfig>(DEFAULTS);

  // Load saved config
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        setCfg({ ...DEFAULTS, ...(data.setting_value as Partial<GateConfig>) });
      }
    })();
  }, []);

  // Admin check
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (data) setIsAdmin(true);
    })();
  }, []);

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    if (window.innerWidth < 1024) return;
    if (window.location.search.includes("tv=true")) return;
    setShow(true);
  }, [location.pathname]);

  const dismiss = () => {
    if (editing) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        {
          setting_key: SETTING_KEY,
          setting_value: cfg as any,
          setting_type: "general",
        },
        { onConflict: "setting_key" }
      );
    setSaving(false);
    if (error) {
      toast.error("Could not save changes");
      return;
    }
    toast.success("Welcome screen updated");
    setEditing(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-8">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {isAdmin && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="absolute top-4 left-4 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Edit"
            title={editing ? "Cancel edit" : "Edit screen (admin)"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Brand logo */}
        <div className="flex justify-center mb-4">
          <img
            src={logo}
            alt="MetsXMFanZone"
            className="h-16 w-auto drop-shadow-[0_0_24px_hsl(var(--primary)/0.5)]"
          />
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xl text-muted-foreground">+</div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
            <Monitor className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {editing ? (
          <div className="space-y-3 mb-6">
            <input
              value={cfg.title}
              onChange={(e) => setCfg({ ...cfg, title: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-bold text-foreground"
              placeholder="Title"
            />
            <textarea
              value={cfg.subtitle}
              onChange={(e) => setCfg({ ...cfg, subtitle: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Subtitle"
            />
            <textarea
              value={cfg.note}
              onChange={(e) => setCfg({ ...cfg, note: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              placeholder="Note"
            />
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center text-foreground mb-2">
              {cfg.title}
            </h2>
            <p className="text-center text-muted-foreground mb-6 text-sm">
              {cfg.subtitle}
            </p>
            <div className="rounded-lg bg-muted/30 border border-border p-3 mb-6 text-center">
              <p className="text-xs text-muted-foreground">{cfg.note}</p>
            </div>
          </>
        )}

        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              <Check className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => {
                dismiss();
                navigate("/");
              }}
              variant="outline"
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Continue to Home
            </Button>
            <Button
              onClick={() => {
                dismiss();
                navigate("/auth");
              }}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopWelcomeGate;

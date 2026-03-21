import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/metsxmfanzone-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PopupNotif {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  show_once_per_session: boolean;
}

const PopupNotification = () => {
  const [popup, setPopup] = useState<PopupNotif | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPopup = async () => {
      const dismissed: string[] = JSON.parse(
        sessionStorage.getItem("dismissedPopups") || "[]"
      );

      const { data, error } = await supabase
        .from("popup_notifications")
        .select("id, title, message, image_url, button_text, button_url, show_once_per_session")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        if (data.show_once_per_session && dismissed.includes(data.id)) return;
        setPopup(data);
        setOpen(true);
      }
    };

    // Slight delay so it doesn't flash on page load
    const timer = setTimeout(fetchPopup, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    if (popup?.show_once_per_session) {
      const dismissed: string[] = JSON.parse(
        sessionStorage.getItem("dismissedPopups") || "[]"
      );
      dismissed.push(popup.id);
      sessionStorage.setItem("dismissedPopups", JSON.stringify(dismissed));
    }
  };

  const handleAction = () => {
    if (popup?.button_url) {
      if (popup.button_url.startsWith("http")) {
        window.open(popup.button_url, "_blank");
      } else {
        navigate(popup.button_url);
      }
    }
    handleDismiss();
  };

  if (!popup) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <img src={logo} alt="" className="w-6 h-6" />
            <DialogTitle className="text-base">{popup.title}</DialogTitle>
          </div>
          {popup.image_url && (
            <img
              src={popup.image_url}
              alt={popup.title}
              className="w-full h-40 object-cover rounded-lg"
            />
          )}
          <DialogDescription className="text-sm pt-2 whitespace-pre-line">
            {popup.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
          {popup.button_url && (
            <Button size="sm" onClick={handleAction}>
              {popup.button_text || "Learn More"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PopupNotification;

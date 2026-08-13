import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, X } from "lucide-react";

const CHAT_EMBED_URL = "https://metsxmfanzone.metsxmfan.workers.dev/chat";

export const EmbeddedChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Don't show the widget on the chat page itself if it were ever hosted locally
  useEffect(() => {
    if (window.location.pathname === "/chat") {
      setIsVisible(false);
    }
  }, []);

  if (!isVisible) return null;

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
        size="icon"
        aria-label="Open support chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[360px] sm:w-[400px] h-[520px] sm:h-[580px] shadow-2xl border-primary/20 bg-card/95 backdrop-blur-xl flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-shrink-0 border-b border-primary/10">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          MetsXMFanZone Support
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <div className="flex-1 min-h-0 w-full bg-background">
        <iframe
          src={CHAT_EMBED_URL}
          title="MetsXMFanZone Support Chat"
          className="w-full h-full border-0"
          allow="clipboard-write"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </Card>
  );
};

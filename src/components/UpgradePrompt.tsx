import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UpgradePrompt({ open, onOpenChange }: UpgradePromptProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔒 PRO Feature</DialogTitle>
          <DialogDescription>
            This content is available exclusively to PRO members. Free members get Spring Training streams only. 
            Upgrade to PRO to unlock MetsXMFanZone live streams, podcasts, blogs, events, and all premium content.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Maybe Later
          </Button>
          <Button onClick={() => navigate("/pricing")} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
            Upgrade to PRO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

const compassionateMessages = [
  "Thank you for watching with us today! Your support means the world to the MetsXM community. 💙🧡",
  "We appreciate you being part of our fan family! Can't wait to see you at the next stream! ⚾",
  "Thanks for tuning in! You make our community stronger with every view. Let's Go Mets! 🎉",
  "Your time with us matters! We hope you enjoyed the stream. See you next time, fan! 💪",
  "Thank you for being an amazing viewer! The Mets family appreciates your loyalty. 🏆",
];

interface StreamExitDialogProps {
  streamPagePaths?: string[];
}

export function StreamExitDialog({ 
  streamPagePaths = ['/live', '/metsxmfanzone', '/mlb-network', '/espn-network', '/apple-tv', '/prime-video', '/peacock', '/pix11-network', '/spring-training-live', '/community-podcast']
}: StreamExitDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [wasOnStreamPage, setWasOnStreamPage] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isStreamPage = streamPagePaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));

  // Track when user is on stream page
  useEffect(() => {
    if (isStreamPage) {
      setWasOnStreamPage(true);
      sessionStorage.setItem('was_on_stream_page', 'true');
    }
  }, [isStreamPage]);

  // Show dialog when navigating away from stream page
  useEffect(() => {
    const wasViewing = sessionStorage.getItem('was_on_stream_page') === 'true';
    const hasShownMessage = sessionStorage.getItem('stream_exit_shown') === 'true';
    
    if (wasViewing && !isStreamPage && !hasShownMessage) {
      // User just left a stream page
      const randomMessage = compassionateMessages[Math.floor(Math.random() * compassionateMessages.length)];
      setMessage(randomMessage);
      setIsOpen(true);
      sessionStorage.setItem('stream_exit_shown', 'true');
      sessionStorage.removeItem('was_on_stream_page');
    }
  }, [location.pathname, isStreamPage]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleBackToStreams = () => {
    setIsOpen(false);
    sessionStorage.removeItem('stream_exit_shown');
    navigate('/metsxmfanzone');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-gradient-to-br from-background to-muted/30">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center animate-bounce">
              <img src={metsLogo} alt="MetsXM" className="h-10 w-10 object-contain" />
            </div>
            <div className="w-14 h-14 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '0.1s' }}>
              <img src={metsLogo} alt="MetsXM" className="h-12 w-12 object-contain" />
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '0.2s' }}>
              <img src={metsLogo} alt="MetsXM" className="h-10 w-10 object-contain" />
            </div>
          </div>
          <DialogTitle className="text-xl text-center">Thanks for Watching!</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed px-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="w-full sm:w-auto"
          >
            <Home className="h-4 w-4 mr-2" />
            Continue Browsing
          </Button>
          <Button 
            onClick={handleBackToStreams}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-700 hover:to-orange-600"
          >
            <img src={metsLogo} alt="MetsXM" className="h-4 w-4 mr-2" />
            Back to Streams
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

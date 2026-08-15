import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

const exitMessages = [
  {
    title: "Wait! Don't Go Yet!",
    description: "We have exclusive Mets content just for you. Stay tuned for live games, breaking news, and community discussions!",
    cta: "Explore More",
  },
  {
    title: "You're Part of the Family!",
    description: "Join thousands of Mets fans who never miss a moment. Subscribe to our newsletter for the latest updates!",
    cta: "Stay Connected",
  },
  {
    title: "Before You Leave...",
    description: "Have you checked out our live streams? Watch exclusive content and join fellow fans in real-time!",
    cta: "Watch Now",
  },
];

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [message, setMessage] = useState(exitMessages[0]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't show on admin pages or auth pages
    if (location.pathname.startsWith('/admin') || 
        location.pathname === '/auth' || 
        location.pathname === '/logout') {
      return;
    }

    // Check if already shown this session
    const shown = sessionStorage.getItem('exit_intent_shown');
    if (shown) {
      setHasShown(true);
      return;
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse leaves toward the top of the page (closing intent)
      if (e.clientY <= 5 && !hasShown) {
        // Select random message
        const randomMessage = exitMessages[Math.floor(Math.random() * exitMessages.length)];
        setMessage(randomMessage);
        setIsOpen(true);
        setHasShown(true);
        sessionStorage.setItem('exit_intent_shown', 'true');
      }
    };

    // Add slight delay before enabling exit intent
    const timeout = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasShown, location.pathname]);

  const handleCTA = () => {
    setIsOpen(false);
    if (message.cta === "Watch Now") {
      navigate('/metsxmfanzone');
    } else if (message.cta === "Stay Connected") {
      // Scroll to newsletter section on homepage
      navigate('/');
      setTimeout(() => {
        const newsletterSection = document.getElementById('newsletter');
        if (newsletterSection) {
          newsletterSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    } else {
      navigate('/');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-primary/30">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center animate-pulse">
            <img src={metsLogo} alt="MetsXM" className="h-14 w-14 object-contain" />
          </div>
          <DialogTitle className="text-xl text-center">{message.title}</DialogTitle>
          <DialogDescription className="text-center text-sm">
            {message.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Maybe Later
          </Button>
          <Button 
            onClick={handleCTA}
            className="w-full sm:w-auto"
          >
            {message.cta}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

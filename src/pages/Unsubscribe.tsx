import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const Unsubscribe = () => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground p-8 shadow-lg text-center space-y-4">
        <Mail className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Email Unsubscribe</h1>
        <p className="text-muted-foreground">
          Unsubscribing is handled straight from the unsubscribe link at the bottom of any
          MetsXMFanZone email. Open a recent email from us and tap that link to stop receiving them.
        </p>
        <p className="text-sm text-muted-foreground">
          Need a hand? Contact our support team and we'll take care of it for you.
        </p>
        <Button asChild className="w-full">
          <Link to="/contact">Contact Support</Link>
        </Button>
      </div>
    </main>
  );
};

export default Unsubscribe;

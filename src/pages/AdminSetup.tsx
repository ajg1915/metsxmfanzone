import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Copy } from "lucide-react";

const AdminSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  const sqlQuery = user?.email 
    ? `INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = '${user.email}'
ON CONFLICT (user_id, role) DO NOTHING;`
    : '';

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlQuery);
    toast({
      title: "Copied!",
      description: "SQL query copied to clipboard",
    });
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    
    setChecking(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    setChecking(false);

    if (data) {
      toast({
        title: "Success!",
        description: "You are now an admin. Redirecting...",
      });
      setTimeout(() => navigate("/admin"), 1500);
    } else {
      toast({
        title: "Not yet",
        description: "Admin role not found. Make sure you ran the SQL query.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Admin Setup</CardTitle>
            <CardDescription>Please log in first</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Admin Setup
          </CardTitle>
          <CardDescription>
            Grant yourself admin access to use the admin portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Your Email:</h3>
            <p className="text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Steps to become an admin:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Copy the SQL query below</li>
              <li>Open your Supabase dashboard</li>
              <li>Go to the SQL Editor or Database section</li>
              <li>Paste and run the query</li>
              <li>Come back here and click "Check Admin Status"</li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">SQL Query:</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySQL}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <code className="text-xs break-all">{sqlQuery}</code>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={checkAdminStatus}
              disabled={checking}
              className="flex-1"
            >
              {checking ? "Checking..." : "Check Admin Status"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;

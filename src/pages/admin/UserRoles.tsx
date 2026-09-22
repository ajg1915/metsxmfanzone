import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2 } from "lucide-react";
import {
  AdminPage, AdminPageHeader, AdminEmpty, AdminIconButton,
} from "@/components/admin/AdminUI";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function UserRoles() {
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user roles:", error);
    } else {
      setUserRoles(data as any || []);
    }
  };

  const handleAddRole = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (profileError || !profile) {
        throw new Error("User not found");
      }

      // Add role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          user_id: profile.id,
          role: selectedRole as "admin" | "moderator" | "user",
        }]);

      if (roleError) throw roleError;

      toast({
        title: "Success",
        description: `Role ${selectedRole} added to user`,
      });

      setEmail("");
      setSelectedRole("user");
      fetchUserRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role removed",
      });

      fetchUserRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader icon={Shield} title="User Roles Management" count={userRoles.length} />

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-border/30">
          <CardHeader className="p-2.5 pb-0">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Assign Role
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Grant admin or moderator privileges to users
            </p>
          </CardHeader>
          <CardContent className="p-2.5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px]">User Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-[10px]">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="writer">Writer</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddRole} disabled={loading} className="w-full h-8 text-xs">
              {loading ? "Adding..." : "Assign Role"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardHeader className="p-2.5 pb-0">
            <CardTitle className="text-xs">Current User Roles</CardTitle>
            <p className="text-[10px] text-muted-foreground">Manage existing user privileges</p>
          </CardHeader>
          <CardContent className="p-2.5">
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {userRoles.length === 0 ? (
                <AdminEmpty message="No roles assigned yet" />
              ) : (
                userRoles.map((userRole) => (
                  <div
                    key={userRole.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded border border-border/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {userRole.profiles?.full_name || userRole.profiles?.email || "Unknown User"}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {userRole.role}
                      </p>
                    </div>
                    <AdminIconButton icon={Trash2} title="Remove role" tone="danger" onClick={() => handleDeleteRole(userRole.id)} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, Send, Loader2, Users, UserCheck, UserX, CreditCard, Shield,
  Sparkles, RefreshCw, UserPlus,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import SubscriptionsTab from "@/components/admin/SubscriptionsTab";
import RolesTab from "@/components/admin/RolesTab";
import MembersTab from "@/components/admin/MembersTab";
import SignupsTab from "@/components/admin/SignupsTab";
import { maskEmail, maskSensitiveField } from "@/utils/secureDataVault";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";

interface MemberRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan_type: string;
  status: string;
  end_date: string | null;
  roles: string[];
  payment_method: string | null;
  created_at: string;
}

interface AIMessage {
  role: "user" | "assistant";
  content: string;
  actions?: any[];
  executed?: string[];
  timestamp: Date;
}

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, plan_type, status, end_date, payment_method")
        .order("created_at", { ascending: false });

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const membersData: MemberRow[] = (profiles || []).map(profile => {
        const activeSub = subscriptions?.find(s => s.user_id === profile.id && s.status === "active")
          || subscriptions?.find(s => s.user_id === profile.id);
        return {
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          plan_type: activeSub?.plan_type || "free",
          status: activeSub?.status || "none",
          end_date: activeSub?.end_date || null,
          payment_method: activeSub?.payment_method || null,
          roles: roleMap.get(profile.id) || [],
          created_at: profile.created_at || "",
        };
      });

      setMembers(membersData);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async () => {
    if (!command.trim() || aiProcessing) return;
    const userMsg: AIMessage = { role: "user", content: command, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    setCommand("");
    setAiProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-user-management", {
        body: { command: command.trim() },
      });

      if (error) throw error;

      const assistantMsg: AIMessage = {
        role: "assistant",
        content: data.message || "Done.",
        actions: data.actions,
        executed: data.executed,
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, assistantMsg]);

      // Refresh data if actions were executed
      if (data.actions?.length > 0 || data.executed?.length > 0) {
        await fetchMembers();
        toast({ title: "AI Action Complete", description: data.message });
      }
    } catch (error: any) {
      const errMsg: AIMessage = {
        role: "assistant",
        content: `Error: ${error.message || "Something went wrong"}`,
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, errMsg]);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAiProcessing(false);
    }
  };

  const quickCommands = [
    "Show me a summary of all members",
    "Who has expired subscriptions?",
    "Activate all pending subscriptions",
    "Show all writers and their membership status",
    "Clean up duplicate subscription records",
  ];

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === "active").length;
  const inactiveMembers = members.filter(m => m.status !== "active").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-affirmative text-white";
      case "pending": return "bg-yellow-500 text-white";
      case "cancelled": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Bot}
        title="AI User Management"
        count={totalMembers}
        description="Tell the AI what to do — it handles members, subscriptions & roles automatically"
      />

      {/* AI Command Bar */}
      <Card className="border-primary/20 bg-card/80 backdrop-blur">
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                placeholder="Ask AI: 'activate frank's premium', 'make john a writer', 'show expired members'..."
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendCommand()}
                className="pl-10 bg-background"
                disabled={aiProcessing}
              />
            </div>
            <Button onClick={sendCommand} disabled={!command.trim() || aiProcessing} size="icon">
              {aiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {aiMessages.length === 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {quickCommands.map((qc, i) => (
                <button
                  key={i}
                  onClick={() => { setCommand(qc); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {qc}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chat History */}
      {aiMessages.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Activity Log
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAiMessages([])}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <ScrollArea className="max-h-64">
              <div className="space-y-3">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.executed && msg.executed.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.executed.map((ex, j) => (
                            <p key={j} className="text-xs opacity-80 flex items-center gap-1">
                              <span className="text-affirmative">✓</span> {ex}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {aiProcessing && (
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Members / Signups / Transactions / Roles */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="members" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />Members
          </TabsTrigger>
          <TabsTrigger value="signups" className="gap-1.5 text-xs">
            <UserPlus className="w-3.5 h-3.5" />Signups
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 text-xs">
            <CreditCard className="w-3.5 h-3.5" />Transactions
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          {/* Quick stats from the live members fetch */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Card><CardContent className="pt-4 pb-3 flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{totalMembers}</p></div>
              <Users className="w-6 h-6 text-primary opacity-40" />
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-affirmative">{activeMembers}</p></div>
              <UserCheck className="w-6 h-6 text-affirmative opacity-40" />
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">Inactive</p><p className="text-xl font-bold text-destructive">{inactiveMembers}</p></div>
              <UserX className="w-6 h-6 text-destructive opacity-40" />
            </CardContent></Card>
          </div>
          <MembersTab />
        </TabsContent>

        <TabsContent value="signups">
          <SignupsTab />
        </TabsContent>

        <TabsContent value="transactions">
          <SubscriptionsTab />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default UserManagement;

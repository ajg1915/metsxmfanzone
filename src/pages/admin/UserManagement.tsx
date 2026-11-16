import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Bot, Send, Loader2, Users, CreditCard, Shield,
  Sparkles, UserPlus, ChevronDown, ShieldCheck,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import SubscriptionsTab from "@/components/admin/SubscriptionsTab";
import RolesTab from "@/components/admin/RolesTab";
import MembersTab from "@/components/admin/MembersTab";
import SignupsTab from "@/components/admin/SignupsTab";
import PayPalBillingTab from "@/components/admin/PayPalBillingTab";
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
  const [command, setCommand] = useState("");
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const fetchMembers = async () => {
    try {
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
      // The active tab owns its loading presentation.
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
  return (
    <AdminPage>
      <AdminPageHeader
        icon={Bot}
        title="Members"
        count={totalMembers}
        description="Search, filter and manage every member in one place"
      />

      <div className="overflow-hidden rounded-md border border-border/40 bg-card/70">
      <Card className="border-0 bg-transparent shadow-none">
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
      </div>

      {/* One screen: the member list. Signups, payments, PayPal and roles open as side panels. */}
      <div className="flex flex-wrap gap-2">
        {([
          ["signups", "Signups", UserPlus],
          ["transactions", "Payments", CreditCard],
          ["paypal", "PayPal billing", Shield],
          ["roles", "Roles", ShieldCheck],
        ] as [string, string, typeof Users][]).map(([key, label, Icon]) => (
          <Button key={key} variant="outline" onClick={() => setPanel(key)} className="min-h-11 gap-2">
            <Icon className="h-4 w-4" />{label}
          </Button>
        ))}
      </div>

      <MembersTab />

      <Sheet open={!!panel} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>{{ signups: "Signups", transactions: "Payments", paypal: "PayPal billing", roles: "Roles" }[panel || "signups"]}</SheetTitle>
            <SheetDescription>Opened from the Members screen.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {panel === "signups" && <SignupsTab />}
            {panel === "transactions" && <SubscriptionsTab />}
            {panel === "paypal" && <PayPalBillingTab />}
            {panel === "roles" && <RolesTab />}
          </div>
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
};

export default UserManagement;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PendingRoom {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by_user_id: string | null;
  rejection_reason: string | null;
}

export function PendingRoomsAdmin() {
  const [rooms, setRooms] = useState<PendingRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("gameday_voice_rooms")
      .select("id, name, description, status, created_at, created_by_user_id, rejection_reason")
      .order("created_at", { ascending: false })
      .limit(50);
    setRooms((data as PendingRoom[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("pending_rooms_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_voice_rooms" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const approve = async (id: string) => {
    const { error } = await supabase
      .from("gameday_voice_rooms")
      .update({ status: "approved", is_active: true })
      .eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else toast({ title: "Room approved" });
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional)") || null;
    const { error } = await supabase
      .from("gameday_voice_rooms")
      .update({ status: "rejected", is_active: false, rejection_reason: reason })
      .eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else toast({ title: "Room rejected" });
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>;

  const pending = rooms.filter((r) => r.status === "pending");
  const others = rooms.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-2">
          Pending Approval{" "}
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {pending.length}
            </Badge>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rooms awaiting approval.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <Card key={r.id} className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{r.name}</p>
                  {r.description && (
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {r.created_by_user_id?.slice(0, 8) ?? "unknown"}…
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => approve(r.id)} className="h-8">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => reject(r.id)}
                    className="h-8"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2">Recent Decisions</h3>
        <div className="space-y-1.5">
          {others.slice(0, 10).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between text-xs border border-border rounded p-2"
            >
              <span className="truncate flex-1">{r.name}</span>
              <Badge
                variant={r.status === "approved" ? "default" : "outline"}
                className="text-[10px]"
              >
                {r.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

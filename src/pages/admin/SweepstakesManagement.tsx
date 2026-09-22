import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Gift, Trophy, Users, Calendar, Star } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty } from "@/components/admin/AdminUI";
import { format } from "date-fns";

interface SweepstakesEvent {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  max_spins_per_user: number;
  created_at: string;
}

interface Prize {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  prize_type: string;
  odds_weight: number;
  icon: string;
  color: string;
  content_url: string | null;
  is_grand_prize: boolean;
}

interface Winner {
  id: string;
  user_id: string;
  won_at: string;
  claimed: boolean;
  prize: { name: string; icon: string; is_grand_prize: boolean } | null;
  profile: { full_name: string | null; email: string | null } | null;
}

const DEFAULT_PRIZES = [
  { name: "Free Blog Access", icon: "📰", odds_weight: 30, is_grand_prize: false },
  { name: "Exclusive Video", icon: "🎬", odds_weight: 25, is_grand_prize: false },
  { name: "Behind the Scenes", icon: "🎤", odds_weight: 20, is_grand_prize: false },
  { name: "VIP Content Pack", icon: "👑", odds_weight: 10, is_grand_prize: false },
  { name: "Grand Prize Bundle", icon: "🏆", odds_weight: 5, is_grand_prize: true },
  { name: "Better Luck Next Time", icon: "🍀", odds_weight: 10, is_grand_prize: false },
];

const SweepstakesManagement = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<SweepstakesEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  // New event form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newMaxSpins, setNewMaxSpins] = useState(1);

  // New prize form
  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizeDesc, setNewPrizeDesc] = useState("");
  const [newPrizeIcon, setNewPrizeIcon] = useState("🎁");
  const [newPrizeWeight, setNewPrizeWeight] = useState(10);
  const [newPrizeUrl, setNewPrizeUrl] = useState("");
  const [newPrizeGrand, setNewPrizeGrand] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchPrizes(selectedEvent);
      fetchWinners(selectedEvent);
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sweepstakes_events")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setEvents(data);
      if (data.length > 0 && !selectedEvent) setSelectedEvent(data[0].id);
    }
    setLoading(false);
  };

  const fetchPrizes = async (eventId: string) => {
    const { data } = await supabase
      .from("sweepstakes_prizes")
      .select("*")
      .eq("event_id", eventId)
      .order("odds_weight", { ascending: false });
    if (data) setPrizes(data);
  };

  const fetchWinners = async (eventId: string) => {
    const { data } = await supabase
      .from("sweepstakes_winners")
      .select("id, user_id, won_at, claimed, prize_id")
      .eq("event_id", eventId)
      .order("won_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch prize and profile info
      const prizeIds = [...new Set(data.map(w => w.prize_id))];
      const userIds = [...new Set(data.map(w => w.user_id))];

      const [{ data: prizeData }, { data: profileData }] = await Promise.all([
        supabase.from("sweepstakes_prizes").select("id, name, icon, is_grand_prize").in("id", prizeIds),
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      ]);

      const enriched: Winner[] = data.map(w => ({
        ...w,
        prize: prizeData?.find(p => p.id === w.prize_id) || null,
        profile: profileData?.find(p => p.id === w.user_id) || null,
      }));
      setWinners(enriched);
    } else {
      setWinners([]);
    }
  };

  const createEvent = async () => {
    if (!newName || !newStart || !newEnd || !user) return;
    const { error } = await supabase.from("sweepstakes_events").insert({
      name: newName,
      description: newDesc || null,
      start_time: new Date(newStart).toISOString(),
      end_time: new Date(newEnd).toISOString(),
      max_spins_per_user: newMaxSpins,
      is_active: false,
      created_by: user.id,
    });
    if (error) { toast.error("Failed to create event"); return; }
    toast.success("Event created!");
    setNewName(""); setNewDesc(""); setNewStart(""); setNewEnd("");
    fetchEvents();
  };

  const createEventWithDefaults = async () => {
    if (!newName || !newStart || !newEnd || !user) return;
    const { data: eventData, error } = await supabase.from("sweepstakes_events").insert({
      name: newName,
      description: newDesc || null,
      start_time: new Date(newStart).toISOString(),
      end_time: new Date(newEnd).toISOString(),
      max_spins_per_user: newMaxSpins,
      is_active: false,
      created_by: user.id,
    }).select().single();

    if (error || !eventData) { toast.error("Failed to create event"); return; }

    // Add default prizes
    const defaultPrizes = DEFAULT_PRIZES.map(p => ({
      event_id: eventData.id,
      name: p.name,
      icon: p.icon,
      odds_weight: p.odds_weight,
      is_grand_prize: p.is_grand_prize,
      prize_type: "exclusive_content",
      color: "#FF5910",
    }));

    await supabase.from("sweepstakes_prizes").insert(defaultPrizes);
    toast.success("Event created with default prizes!");
    setNewName(""); setNewDesc(""); setNewStart(""); setNewEnd("");
    fetchEvents();
  };

  const toggleEventActive = async (eventId: string, active: boolean) => {
    await supabase.from("sweepstakes_events").update({ is_active: active }).eq("id", eventId);
    toast.success(active ? "Event activated!" : "Event deactivated");
    fetchEvents();
  };

  const deleteEvent = async (eventId: string) => {
    await supabase.from("sweepstakes_events").delete().eq("id", eventId);
    toast.success("Event deleted");
    if (selectedEvent === eventId) setSelectedEvent(null);
    fetchEvents();
  };

  const addPrize = async () => {
    if (!selectedEvent || !newPrizeName) return;
    await supabase.from("sweepstakes_prizes").insert({
      event_id: selectedEvent,
      name: newPrizeName,
      description: newPrizeDesc || null,
      icon: newPrizeIcon,
      odds_weight: newPrizeWeight,
      content_url: newPrizeUrl || null,
      is_grand_prize: newPrizeGrand,
      prize_type: "exclusive_content",
      color: "#FF5910",
    });
    toast.success("Prize added!");
    setNewPrizeName(""); setNewPrizeDesc(""); setNewPrizeIcon("🎁"); setNewPrizeWeight(10); setNewPrizeUrl(""); setNewPrizeGrand(false);
    fetchPrizes(selectedEvent);
  };

  const deletePrize = async (prizeId: string) => {
    if (!selectedEvent) return;
    await supabase.from("sweepstakes_prizes").delete().eq("id", prizeId);
    toast.success("Prize removed");
    fetchPrizes(selectedEvent);
  };

  const activeEvent = events.find(e => e.id === selectedEvent);

  return (
    <AdminPage>
      <AdminPageHeader icon={Gift} title="Sweepstakes Management" count={events.length} />

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events" className="gap-1"><Calendar className="h-4 w-4" /> Events</TabsTrigger>
          <TabsTrigger value="prizes" className="gap-1" disabled={!selectedEvent}><Star className="h-4 w-4" /> Prizes</TabsTrigger>
          <TabsTrigger value="winners" className="gap-1" disabled={!selectedEvent}><Trophy className="h-4 w-4" /> Winners</TabsTrigger>
        </TabsList>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create Giveaway Event</CardTitle>
              <CardDescription>Schedule when the spin wheel appears for users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Event Name (e.g. Weekend Giveaway)" value={newName} onChange={e => setNewName(e.target.value)} />
              <Textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input type="datetime-local" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Max Spins Per User</Label>
                <Input type="number" min={1} max={10} value={newMaxSpins} onChange={e => setNewMaxSpins(Number(e.target.value))} />
              </div>
              <div className="flex gap-2">
                <Button onClick={createEvent} disabled={!newName || !newStart || !newEnd}><Plus className="h-4 w-4 mr-1" /> Create Empty</Button>
                <Button variant="secondary" onClick={createEventWithDefaults} disabled={!newName || !newStart || !newEnd}><Gift className="h-4 w-4 mr-1" /> Create with Defaults</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {events.map(event => {
              const isNow = new Date() >= new Date(event.start_time) && new Date() <= new Date(event.end_time);
              return (
                <Card key={event.id} className={`cursor-pointer transition-all ${selectedEvent === event.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedEvent(event.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{event.name}</span>
                        {event.is_active && isNow && <Badge className="bg-green-500 text-white">LIVE</Badge>}
                        {event.is_active && !isNow && <Badge variant="secondary">Scheduled</Badge>}
                        {!event.is_active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "MMM d, h:mm a")} — {format(new Date(event.end_time), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={event.is_active} onCheckedChange={(checked) => { toggleEventActive(event.id, checked); }} onClick={e => e.stopPropagation()} />
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {events.length === 0 && !loading && (
              <AdminEmpty message="No sweepstakes events yet. Create one above!" />
            )}
          </div>
        </TabsContent>

        {/* PRIZES TAB */}
        <TabsContent value="prizes" className="space-y-4">
          {activeEvent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Prize to "{activeEvent.name}"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Prize Name" value={newPrizeName} onChange={e => setNewPrizeName(e.target.value)} />
                  <Input placeholder="Icon (emoji)" value={newPrizeIcon} onChange={e => setNewPrizeIcon(e.target.value)} className="w-20" />
                </div>
                <Textarea placeholder="Description (optional)" value={newPrizeDesc} onChange={e => setNewPrizeDesc(e.target.value)} rows={2} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Chance (1–100%)</Label>
                    <Input type="number" min={1} max={100} value={newPrizeWeight} onChange={e => setNewPrizeWeight(Math.min(100, Math.max(1, Number(e.target.value))))} />
                  </div>
                  <div>
                    <Label className="text-xs">Content URL (optional)</Label>
                    <Input placeholder="/blog/exclusive-post" value={newPrizeUrl} onChange={e => setNewPrizeUrl(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newPrizeGrand} onCheckedChange={setNewPrizeGrand} />
                  <Label>Grand Prize</Label>
                </div>
                <Button onClick={addPrize} disabled={!newPrizeName}><Plus className="h-4 w-4 mr-1" /> Add Prize</Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-2">
            {prizes.map(prize => (
                <Card key={prize.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{prize.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{prize.name}</span>
                          {prize.is_grand_prize && <Badge className="bg-yellow-500 text-black text-[10px]">GRAND</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">Chance: {prize.odds_weight}%</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePrize(prize.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            {prizes.length === 0 && (
              <AdminEmpty message="No prizes yet. Add some above!" />
            )}
          </div>
        </TabsContent>

        {/* WINNERS TAB */}
        <TabsContent value="winners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" /> Winners ({winners.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {winners.length === 0 ? (
                <AdminEmpty message="No winners yet for this event." />
              ) : (
                <div className="space-y-2">
                  {winners.map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{w.prize?.icon || "🎁"}</span>
                        <div>
                          <p className="font-medium text-sm">{w.profile?.full_name || w.profile?.email || "Unknown User"}</p>
                          <p className="text-xs text-muted-foreground">Won: {w.prize?.name || "Unknown Prize"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{format(new Date(w.won_at), "MMM d, h:mm a")}</p>
                        {w.prize?.is_grand_prize && <Badge className="bg-yellow-500 text-black text-[10px]">GRAND</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default SweepstakesManagement;

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, CheckCircle2, Megaphone, Volume2, BarChart3, ShieldCheck, Radio } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty } from "@/components/admin/AdminUI";
import { toast } from "@/hooks/use-toast";
import { PendingRoomsAdmin } from "@/components/radio/PendingRoomsAdmin";
import { ScheduledShowsAdmin } from "@/components/radio/ScheduledShowsAdmin";

interface Poll {
  id: string;
  question: string;
  options: string[];
  poll_type: string;
  points: number;
  is_active: boolean;
  is_resolved: boolean;
  correct_option_index: number | null;
}
interface Room {
  id: string;
  name: string;
  description: string | null;
  livekit_room_name: string;
  is_active: boolean;
}
interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
}

const GameDayLiveAdmin = () => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Polls state
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState<string[]>(["", ""]);
  const [pollType, setPollType] = useState<"poll" | "prediction">("poll");
  const [pollPoints, setPollPoints] = useState(10);

  // Rooms state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");

  // Announcements state
  const [announces, setAnnounces] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annMsg, setAnnMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const reload = async () => {
    const [{ data: p }, { data: r }, { data: a }] = await Promise.all([
      supabase.from("gameday_polls").select("*").order("created_at", { ascending: false }),
      supabase.from("gameday_voice_rooms").select("*").order("created_at", { ascending: false }),
      supabase
        .from("gameday_announcements")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (p)
      setPolls(
        p.map((x: any) => ({
          ...x,
          options: Array.isArray(x.options) ? x.options : [],
        }))
      );
    if (r) setRooms(r as Room[]);
    if (a) setAnnounces(a as Announcement[]);
  };

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin]);

  if (loading || isAdmin === null) {
    return <div className="p-8 text-center">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  // ---- Polls ----
  const createPoll = async () => {
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!pollQ.trim() || opts.length < 2) {
      toast({ title: "Need a question and at least 2 options", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("gameday_polls").insert({
      question: pollQ.trim(),
      options: opts,
      poll_type: pollType,
      points: pollPoints,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setPollQ("");
      setPollOpts(["", ""]);
      reload();
      toast({ title: "Poll created" });
    }
  };

  const togglePoll = async (id: string, is_active: boolean) => {
    await supabase.from("gameday_polls").update({ is_active }).eq("id", id);
    reload();
  };

  const resolvePoll = async (poll: Poll, correctIndex: number) => {
    // Mark resolved + set correct
    await supabase
      .from("gameday_polls")
      .update({ is_resolved: true, correct_option_index: correctIndex, is_active: false })
      .eq("id", poll.id);

    if (poll.poll_type === "prediction") {
      // Award points to correct voters
      const { data: votes } = await supabase
        .from("gameday_poll_votes")
        .select("user_id, option_index")
        .eq("poll_id", poll.id);

      if (votes) {
        for (const v of votes) {
          const correct = v.option_index === correctIndex;
          const { data: existing } = await supabase
            .from("gameday_leaderboard")
            .select("*")
            .eq("user_id", v.user_id)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("gameday_leaderboard")
              .update({
                total_points: existing.total_points + (correct ? poll.points : 0),
                correct_predictions: existing.correct_predictions + (correct ? 1 : 0),
                total_predictions: existing.total_predictions + 1,
              })
              .eq("user_id", v.user_id);
          } else {
            await supabase.from("gameday_leaderboard").insert({
              user_id: v.user_id,
              total_points: correct ? poll.points : 0,
              correct_predictions: correct ? 1 : 0,
              total_predictions: 1,
            });
          }
        }
      }
    }
    reload();
    toast({ title: "Poll resolved" });
  };

  const deletePoll = async (id: string) => {
    await supabase.from("gameday_polls").delete().eq("id", id);
    reload();
  };

  // ---- Rooms ----
  const createRoom = async () => {
    if (!roomName.trim()) return;
    const slug =
      "gd-" +
      roomName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40) +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("gameday_voice_rooms").insert({
      name: roomName.trim(),
      description: roomDesc.trim() || null,
      livekit_room_name: slug,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setRoomName("");
      setRoomDesc("");
      reload();
      toast({ title: "Voice room opened" });
    }
  };
  const toggleRoom = async (id: string, is_active: boolean) => {
    await supabase.from("gameday_voice_rooms").update({ is_active }).eq("id", id);
    reload();
  };
  const deleteRoom = async (id: string) => {
    await supabase.from("gameday_voice_rooms").delete().eq("id", id);
    reload();
  };

  // ---- Announcements ----
  const createAnn = async () => {
    if (!annTitle.trim() || !annMsg.trim()) return;
    const { error } = await supabase.from("gameday_announcements").insert({
      title: annTitle.trim(),
      message: annMsg.trim(),
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setAnnTitle("");
      setAnnMsg("");
      reload();
    }
  };
  const toggleAnn = async (id: string, is_active: boolean) => {
    await supabase.from("gameday_announcements").update({ is_active }).eq("id", id);
    reload();
  };
  const deleteAnn = async (id: string) => {
    await supabase.from("gameday_announcements").delete().eq("id", id);
    reload();
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Radio}
        title="MetsXMFanZone Radio Network"
        description="Manage scheduled shows, approve member voice rooms, polls, and announcements."
      />

      <Tabs defaultValue="shows">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="shows">
            <Radio className="w-4 h-4 mr-1.5" /> Scheduled Shows
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <ShieldCheck className="w-4 h-4 mr-1.5" /> Room Approvals
          </TabsTrigger>
          <TabsTrigger value="polls">
            <BarChart3 className="w-4 h-4 mr-1.5" /> Polls
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <Volume2 className="w-4 h-4 mr-1.5" /> Voice Rooms
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone className="w-4 h-4 mr-1.5" /> Announcements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shows" className="mt-4">
          <ScheduledShowsAdmin />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <PendingRoomsAdmin />
        </TabsContent>

        {/* POLLS */}
        <TabsContent value="polls" className="space-y-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">New Poll / Prediction</h3>
            <div className="space-y-2">
              <Input
                placeholder="Question (e.g. Who hits the next HR?)"
                value={pollQ}
                onChange={(e) => setPollQ(e.target.value)}
              />
              {pollOpts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={o}
                    onChange={(e) => {
                      const next = [...pollOpts];
                      next[i] = e.target.value;
                      setPollOpts(next);
                    }}
                  />
                  {pollOpts.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPollOpts(pollOpts.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {pollOpts.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPollOpts([...pollOpts, ""])}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add option
                </Button>
              )}
              <div className="flex gap-3 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Label htmlFor="ptype">Type</Label>
                  <select
                    id="ptype"
                    value={pollType}
                    onChange={(e) => setPollType(e.target.value as "poll" | "prediction")}
                    className="bg-background border border-border rounded px-2 py-1 text-sm"
                  >
                    <option value="poll">Poll</option>
                    <option value="prediction">Prediction (awards points)</option>
                  </select>
                </div>
                {pollType === "prediction" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ppts">Points</Label>
                    <Input
                      id="ppts"
                      type="number"
                      value={pollPoints}
                      onChange={(e) => setPollPoints(Number(e.target.value) || 10)}
                      className="w-20"
                    />
                  </div>
                )}
              </div>
              <Button onClick={createPoll}>Create Poll</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {polls.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={p.poll_type === "prediction" ? "default" : "secondary"}>
                        {p.poll_type === "prediction" ? `Predict · ${p.points}pt` : "Poll"}
                      </Badge>
                      {p.is_resolved && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Resolved
                        </Badge>
                      )}
                      {!p.is_active && !p.is_resolved && (
                        <Badge variant="outline">Closed</Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm">{p.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_resolved && (
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => togglePoll(p.id, v)}
                      />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deletePoll(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.options.map((opt, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={p.correct_option_index === i ? "default" : "outline"}
                      onClick={() => !p.is_resolved && resolvePoll(p, i)}
                      disabled={p.is_resolved}
                      className="text-xs"
                    >
                      {p.is_resolved && p.correct_option_index === i && (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      )}
                      {opt}
                    </Button>
                  ))}
                </div>
                {!p.is_resolved && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Click an option to mark it as the correct answer and resolve.
                  </p>
                )}
              </Card>
            ))}
            {polls.length === 0 && (
              <AdminEmpty message="No polls yet." />
            )}
          </div>
        </TabsContent>

        {/* ROOMS */}
        <TabsContent value="rooms" className="space-y-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Open New Voice Room</h3>
            <div className="space-y-2">
              <Input
                placeholder="Room name (e.g. The Dugout, Hot Take Lounge)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={roomDesc}
                onChange={(e) => setRoomDesc(e.target.value)}
              />
              <Button onClick={createRoom}>Open Room</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {rooms.map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  {r.description && (
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    {r.livekit_room_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggleRoom(r.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteRoom(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {rooms.length === 0 && (
              <AdminEmpty message="No voice rooms yet." />
            )}
          </div>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="space-y-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">New Announcement</h3>
            <div className="space-y-2">
              <Input
                placeholder="Title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
              <Textarea
                placeholder="Message to all watch party members"
                value={annMsg}
                onChange={(e) => setAnnMsg(e.target.value)}
                rows={3}
              />
              <Button onClick={createAnn}>Post Announcement</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {announces.map((a) => (
              <Card key={a.id} className="p-4 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {a.message}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.is_active} onCheckedChange={(v) => toggleAnn(a.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteAnn(a.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {announces.length === 0 && (
              <AdminEmpty message="No announcements yet." />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default GameDayLiveAdmin;

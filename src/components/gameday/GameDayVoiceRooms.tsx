import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Users, Volume2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
} from "livekit-client";
import { cn } from "@/lib/utils";

interface VoiceRoom {
  id: string;
  name: string;
  description: string | null;
  livekit_room_name: string;
  is_active: boolean;
  max_participants: number;
  image_url?: string | null;
  created_by_user_id?: string | null;
}

interface ParticipantInfo {
  identity: string;
  name: string;
  avatar_url?: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

export function GameDayVoiceRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [muted, setMuted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("gameday_voice_rooms")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (data) setRooms(data as VoiceRoom[]);
    };
    load();
    const channel = supabase
      .channel("gameday_voice_rooms_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_voice_rooms" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshParticipants = (room: Room) => {
    const local = room.localParticipant;
    const all: ParticipantInfo[] = [
      {
        identity: local.identity,
        name: local.name || "You",
        avatar_url: parseAvatar(local.metadata),
        isSpeaking: local.isSpeaking,
        isMuted: !local.isMicrophoneEnabled,
        isLocal: true,
      },
      ...Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        name: p.name || "Fan",
        avatar_url: parseAvatar(p.metadata),
        isSpeaking: p.isSpeaking,
        isMuted: !p.audioTrackPublications.values().next().value?.isMuted === false ? true : false,
        isLocal: false,
      })),
    ];
    setParticipants(all);
  };

  const parseAvatar = (metadata?: string): string | null => {
    if (!metadata) return null;
    try {
      const m = JSON.parse(metadata);
      return m.avatar_url || null;
    } catch {
      return null;
    }
  };

  const joinRoom = async (room: VoiceRoom) => {
    if (!user || connecting) return;
    setConnecting(true);
    try {
      // Disconnect from any existing room first
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room_name: room.livekit_room_name },
      });
      if (error || !data?.token) {
        throw new Error(data?.error || error?.message || "Could not get token");
      }

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      lkRoom
        .on(RoomEvent.ParticipantConnected, () => refreshParticipants(lkRoom))
        .on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(lkRoom))
        .on(RoomEvent.ActiveSpeakersChanged, () => refreshParticipants(lkRoom))
        .on(RoomEvent.TrackMuted, () => refreshParticipants(lkRoom))
        .on(RoomEvent.TrackUnmuted, () => refreshParticipants(lkRoom))
        .on(RoomEvent.LocalTrackPublished, () => refreshParticipants(lkRoom))
        .on(RoomEvent.Disconnected, () => {
          setActiveRoomId(null);
          setParticipants([]);
          roomRef.current = null;
        });

      await lkRoom.connect(data.url, data.token);
      await lkRoom.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = lkRoom;
      setActiveRoomId(room.id);
      setMuted(false);
      refreshParticipants(lkRoom);
      toast({ title: `Joined ${room.name}`, description: "Have fun! Mic is on." });
    } catch (e: any) {
      toast({
        title: "Could not join voice room",
        description: e.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const leaveRoom = async () => {
    if (!roomRef.current) return;
    await roomRef.current.disconnect();
    roomRef.current = null;
    setActiveRoomId(null);
    setParticipants([]);
  };

  const toggleMute = async () => {
    const lk = roomRef.current;
    if (!lk) return;
    const newState = !muted;
    await lk.localParticipant.setMicrophoneEnabled(!newState);
    setMuted(newState);
    refreshParticipants(lk);
  };

  const deleteRoom = async (r: VoiceRoom) => {
    if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    if (activeRoomId === r.id) await leaveRoom();
    const { error } = await supabase.from("gameday_voice_rooms").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Room deleted" });
    }
  };
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Voice Rooms</h3>
        </div>
        {activeRoomId && (
          <Button size="sm" variant="destructive" onClick={leaveRoom} className="h-7 text-xs">
            <PhoneOff className="w-3 h-3 mr-1" /> Leave
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No open voice rooms. Admins open them on game days.
        </p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => {
            const isActive = activeRoomId === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  isActive ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  {r.image_url && (
                    <img
                      src={r.image_url}
                      alt={r.name}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0 border border-border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                    )}
                  </div>
                  {!isActive ? (
                    <Button
                      size="sm"
                      onClick={() => joinRoom(r)}
                      disabled={connecting || !user}
                      className="h-7 text-xs flex-shrink-0"
                    >
                      <Mic className="w-3 h-3 mr-1" /> Join
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={muted ? "secondary" : "default"}
                      onClick={toggleMute}
                      className="h-7 text-xs flex-shrink-0"
                    >
                      {muted ? (
                        <>
                          <MicOff className="w-3 h-3 mr-1" /> Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 mr-1" /> Mute
                        </>
                      )}
                    </Button>
                  )}
                  {(isAdmin || (user && r.created_by_user_id === user.id)) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteRoom(r)}
                      className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {isActive && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1 mb-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{participants.length} in room</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {participants.map((p) => (
                        <div
                          key={p.identity}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all",
                            p.isSpeaking
                              ? "border-green-500 bg-green-500/10 ring-2 ring-green-500/30"
                              : "border-border bg-background/50"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              p.name[0]?.toUpperCase()
                            )}
                          </div>
                          <span className="font-medium">{p.name}</span>
                          {p.isMuted && <MicOff className="w-2.5 h-2.5 text-muted-foreground" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!user && (
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Sign in to join voice rooms
        </p>
      )}
    </Card>
  );
}

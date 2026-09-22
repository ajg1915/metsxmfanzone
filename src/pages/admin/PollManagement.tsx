import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, BarChart3, X, Vote } from "lucide-react";
import { format } from "date-fns";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading, AdminIconButton,
} from "@/components/admin/AdminUI";

interface Poll {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
  show_as_toast: boolean;
  created_at: string;
  expires_at: string | null;
}

interface PollVote {
  option_index: number;
  vote_count: number;
}

const PollManagement = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    options: ["", ""],
    is_active: false,
    show_as_toast: true,
    expires_at: "",
  });
  const [pollResults, setPollResults] = useState<Record<string, PollVote[]>>({});

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const parsedPolls = (data || []).map((poll) => ({
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : JSON.parse(poll.options as string),
      }));

      setPolls(parsedPolls);

      // Fetch vote counts for each poll
      for (const poll of parsedPolls) {
        const { data: votes } = await supabase
          .from("poll_vote_counts" as any)
          .select("option_index, vote_count")
          .eq("poll_id", poll.id);

        if (votes) {
          setPollResults((prev) => ({ ...prev, [poll.id]: votes as unknown as PollVote[] }));
        }
      }
    } catch (error) {
      console.error("Error fetching polls:", error);
      toast({
        title: "Error",
        description: "Failed to load polls",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filteredOptions = formData.options.filter((opt) => opt.trim() !== "");
    if (filteredOptions.length < 2) {
      toast({
        title: "Error",
        description: "Please add at least 2 options",
        variant: "destructive",
      });
      return;
    }

    try {
      const pollData = {
        question: formData.question,
        options: filteredOptions,
        is_active: formData.is_active,
        show_as_toast: formData.show_as_toast,
        expires_at: formData.expires_at || null,
      };

      if (editingPoll) {
        const { error } = await supabase
          .from("polls")
          .update(pollData)
          .eq("id", editingPoll.id);

        if (error) throw error;
        toast({ title: "Success", description: "Poll updated successfully" });
      } else {
        const { error } = await supabase.from("polls").insert([pollData]);

        if (error) throw error;
        toast({ title: "Success", description: "Poll created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchPolls();
    } catch (error) {
      console.error("Error saving poll:", error);
      toast({
        title: "Error",
        description: "Failed to save poll",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      question: "",
      options: ["", ""],
      is_active: false,
      show_as_toast: true,
      expires_at: "",
    });
    setEditingPoll(null);
  };

  const handleEdit = (poll: Poll) => {
    setEditingPoll(poll);
    setFormData({
      question: poll.question,
      options: poll.options.length >= 2 ? poll.options : [...poll.options, "", ""].slice(0, Math.max(2, poll.options.length)),
      is_active: poll.is_active,
      show_as_toast: poll.show_as_toast,
      expires_at: poll.expires_at ? poll.expires_at.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) return;

    try {
      const { error } = await supabase.from("polls").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Poll deleted successfully" });
      fetchPolls();
    } catch (error) {
      console.error("Error deleting poll:", error);
      toast({
        title: "Error",
        description: "Failed to delete poll",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (poll: Poll) => {
    try {
      const { error } = await supabase
        .from("polls")
        .update({ is_active: !poll.is_active })
        .eq("id", poll.id);

      if (error) throw error;
      fetchPolls();
    } catch (error) {
      console.error("Error toggling poll:", error);
    }
  };

  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData({ ...formData, options: [...formData.options, ""] });
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      setFormData({
        ...formData,
        options: formData.options.filter((_, i) => i !== index),
      });
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const getVoteCount = (pollId: string, optionIndex: number) => {
    const votes = pollResults[pollId] || [];
    return Number(votes.find((v) => v.option_index === optionIndex)?.vote_count ?? 0);
  };

  const getTotalVotes = (pollId: string) => {
    return (pollResults[pollId] || []).reduce((total, vote) => total + Number(vote.vote_count || 0), 0);
  };

  const filteredPolls = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return polls;
    return polls.filter((p) => p.question.toLowerCase().includes(q));
  }, [polls, search]);

  if (loading) return <AdminLoading label="Loading polls…" />;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Vote}
        title="Poll Management"
        count={polls.length}
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Create Poll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-background">
              <DialogHeader>
                <DialogTitle>{editingPoll ? "Edit Poll" : "Create New Poll"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="question">Question</Label>
                  <Input
                    id="question"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="What's your favorite..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Options (2-6)</Label>
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      {formData.options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {formData.options.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  )}
                </div>

                <div>
                  <Label htmlFor="expires_at">Expires At (optional)</Label>
                  <Input
                    id="expires_at"
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show_as_toast">Show as Toast Popup</Label>
                  <Switch
                    id="show_as_toast"
                    checked={formData.show_as_toast}
                    onCheckedChange={(checked) => setFormData({ ...formData, show_as_toast: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingPoll ? "Update" : "Create"} Poll</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminSearch value={search} onChange={setSearch} placeholder="Search poll question…" />

      <AdminList>
        {filteredPolls.length === 0 ? (
          <AdminEmpty message='No polls created yet. Click "Create Poll" to get started.' />
        ) : (
          filteredPolls.map((poll) => (
            <AdminListCard key={poll.id} highlight={poll.is_active}>
              <AdminRow
                title={poll.question}
                actions={
                  <>
                    <AdminIconButton icon={Edit} title="Edit" onClick={() => handleEdit(poll)} />
                    <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => handleDelete(poll.id)} />
                  </>
                }
                body={
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      {poll.options.map((option, index) => {
                        const voteCount = getVoteCount(poll.id, index);
                        const totalVotes = getTotalVotes(poll.id);
                        const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

                        return (
                          <div key={index} className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span>{option}</span>
                              <span className="text-muted-foreground">{voteCount} votes ({percentage.toFixed(0)}%)</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <BarChart3 className="h-3 w-3" />
                        <span>{getTotalVotes(poll.id)} total votes</span>
                      </div>
                      <Switch
                        checked={poll.is_active}
                        onCheckedChange={() => toggleActive(poll)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[9px]">
                      {poll.show_as_toast && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">Toast</span>
                      )}
                      {poll.expires_at && (
                        <span className="px-1.5 py-0.5 bg-muted rounded">
                          Expires: {format(new Date(poll.expires_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                }
              />
            </AdminListCard>
          ))
        )}
      </AdminList>
    </AdminPage>
  );
};

export default PollManagement;

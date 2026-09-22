import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Star, MessageCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import {
  AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow,
  AdminEmpty, AdminLoading, AdminIconButton,
} from "@/components/admin/AdminUI";

interface Feedback {
  id: string;
  content: string;
  rating: number | null;
  created_at: string;
  display_name?: string | null;
  location?: string | null;
}

const FeedbackManagement = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("id, content, rating, created_at, display_name, location")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
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

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("feedbacks")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback deleted successfully",
      });

      fetchFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <AdminLoading label="Loading feedbacks…" />;

  return (
    <AdminPage>
      <AdminPageHeader icon={MessageCircle} title="Feedback" count={feedbacks.length} />

      <AdminList>
        {feedbacks.length === 0 ? (
          <AdminEmpty message="No feedbacks yet" />
        ) : (
          feedbacks.map((feedback) => (
            <AdminListCard key={feedback.id}>
              <AdminRow
                title={
                  <span className="flex gap-0.5">
                    {feedback.rating && Array.from({ length: feedback.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                    {feedback.display_name && (
                      <span className="text-xs font-medium ml-1">{feedback.display_name}</span>
                    )}
                  </span>
                }
                meta={`${formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}${feedback.location ? ` · ${feedback.location}` : ""}`}
                actions={
                  <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => setDeleteId(feedback.id)} />
                }
                body={<p className="text-xs text-muted-foreground">{feedback.content}</p>}
              />
            </AdminListCard>
          ))
        )}
      </AdminList>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this feedback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default FeedbackManagement;

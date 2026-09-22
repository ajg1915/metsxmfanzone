import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, ExternalLink, Mail, Calendar, FileText, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminFilterChips, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading,
} from "@/components/admin/AdminUI";

interface WriterApplication {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  reason: string | null;
  portfolio_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const WriterApplications = () => {
  const [applications, setApplications] = useState<WriterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedApp, setSelectedApp] = useState<WriterApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);
  const { toast } = useToast();

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("writer_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      toast({
        title: "Error",
        description: "Failed to load writer applications",
        variant: "destructive",
      });
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedApp) return;

    setProcessingId(selectedApp.id);

    try {
      // Update application status
      const { error: updateError } = await supabase
        .from("writer_applications")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedApp.id);

      if (updateError) throw updateError;

      // If approved, add writer role
      if (action === "approve") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: selectedApp.user_id,
            role: "writer",
          });

        if (roleError && !roleError.message.includes("duplicate")) {
          console.error("Error adding writer role:", roleError);
        }
      }

      // Send email notification
      const { error: emailError } = await supabase.functions.invoke("send-writer-approval-email", {
        body: {
          email: selectedApp.email,
          name: selectedApp.full_name,
          status: action === "approve" ? "approved" : "rejected",
          adminNotes: adminNotes || undefined,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: action === "approve" ? "Application Approved" : "Application Rejected",
        description: `${selectedApp.full_name}'s application has been ${action === "approve" ? "approved" : "rejected"}. An email notification has been sent.`,
      });

      setSelectedApp(null);
      setAdminNotes("");
      setDialogAction(null);
      fetchApplications();
    } catch (error: any) {
      console.error("Error processing application:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process application",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openDialog = (app: WriterApplication, action: "approve" | "reject") => {
    setSelectedApp(app);
    setDialogAction(action);
    setAdminNotes("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="h-4 text-[9px] bg-yellow-500/20 text-yellow-400"><Clock className="h-2 w-2 mr-0.5" /> Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="h-4 text-[9px] bg-green-500/20 text-green-400"><CheckCircle className="h-2 w-2 mr-0.5" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="h-4 text-[9px] bg-red-500/20 text-red-400"><XCircle className="h-2 w-2 mr-0.5" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="h-4 text-[9px]">{status}</Badge>;
    }
  };

  const counts = useMemo(() => ({
    all: applications.length,
    pending: applications.filter(a => a.status === "pending").length,
    approved: applications.filter(a => a.status === "approved").length,
    rejected: applications.filter(a => a.status === "rejected").length,
  }), [applications]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (q && !(`${a.full_name} ${a.email}`.toLowerCase().includes(q))) return false;
      if (filter !== "all") return a.status === filter;
      return true;
    });
  }, [applications, search, filter]);

  return (
    <AdminPage>
      <AdminPageHeader
        icon={FileText}
        title="Writer Applications"
        count={counts.all}
        actions={
          <Button onClick={fetchApplications} variant="outline" size="sm" className="h-8 text-xs" disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearch value={search} onChange={setSearch} placeholder="Search name or email…" />
        <AdminFilterChips
          filters={[
            { key: "all", label: "All", count: counts.all },
            { key: "pending", label: "Pending", count: counts.pending },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "rejected", label: "Rejected", count: counts.rejected },
          ]}
          active={filter}
          onChange={(k) => setFilter(k as any)}
        />
      </div>

      {loading ? (
        <AdminLoading label="Loading applications…" />
      ) : filteredApps.length === 0 ? (
        <AdminEmpty message="There are no writer applications to review." />
      ) : (
        <AdminList>
          {filteredApps.map((app) => (
            <AdminListCard key={app.id} highlight={app.status === "pending"}>
              <AdminRow
                title={app.full_name}
                badges={getStatusBadge(app.status)}
                meta={
                  <span className="flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5" /> {app.email}
                  </span>
                }
                body={
                  <div className="space-y-1.5">
                    <p className="text-xs">{app.reason || "No reason provided"}</p>

                    {app.portfolio_url && (
                      <a
                        href={app.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                      >
                        View Portfolio <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-2.5 w-2.5" />
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                      {app.reviewed_at && (
                        <> • Reviewed: {new Date(app.reviewed_at).toLocaleDateString()}</>
                      )}
                    </div>

                    {app.admin_notes && (
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-[10px] font-medium mb-0.5">Admin Notes:</p>
                        <p className="text-[10px] text-muted-foreground">{app.admin_notes}</p>
                      </div>
                    )}

                    {app.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => openDialog(app, "approve")}
                          size="sm"
                          className="flex-1 h-7 text-[10px] bg-green-600 hover:bg-green-700"
                          disabled={processingId === app.id}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => openDialog(app, "reject")}
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-7 text-[10px]"
                          disabled={processingId === app.id}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                }
              />
            </AdminListCard>
          ))}
        </AdminList>
      )}

      <Dialog open={!!dialogAction} onOpenChange={() => { setDialogAction(null); setSelectedApp(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? `You are about to approve ${selectedApp?.full_name}'s writer application. They will receive email access to the writer portal.`
                : `You are about to reject ${selectedApp?.full_name}'s writer application. They will be notified via email.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminNotes">
                {dialogAction === "approve" ? "Welcome message (optional)" : "Feedback for applicant (optional)"}
              </Label>
              <Textarea
                id="adminNotes"
                placeholder={dialogAction === "approve"
                  ? "Any notes or welcome message for the new writer..."
                  : "Provide constructive feedback..."
                }
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogAction(null); setSelectedApp(null); }}>
              Cancel
            </Button>
            <Button
              onClick={() => dialogAction && handleAction(dialogAction)}
              className={dialogAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={dialogAction === "reject" ? "destructive" : "default"}
              disabled={processingId !== null}
            >
              {processingId ? "Processing..." : dialogAction === "approve" ? "Approve & Send Email" : "Reject & Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default WriterApplications;

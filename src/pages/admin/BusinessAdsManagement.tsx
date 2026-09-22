import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Trash2, ExternalLink, Mail, Phone, Megaphone } from "lucide-react";
import CreateBusinessAdForm from "@/components/CreateBusinessAdForm";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminFilterChips, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading, AdminIconButton,
} from "@/components/admin/AdminUI";

interface BusinessAd {
  id: string;
  business_name: string;
  ad_title: string;
  ad_description: string;
  ad_image_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  website_url: string | null;
  status: string;
  created_at: string;
}

export default function BusinessAdsManagement() {
  const [ads, setAds] = useState<BusinessAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchAds();
    supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
  }, []);

  const fetchAds = async () => {
    try {
      const { data, error} = await supabase
        .from("business_ads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error) {
      console.error("Error fetching ads:", error);
      toast({
        title: "Error",
        description: "Failed to load business ads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("business_ads")
        .update({
          status,
          published_at: status === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Ad ${status === "approved" ? "approved" : "rejected"}`,
      });

      fetchAds();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ad?")) return;

    try {
      const { error } = await supabase
        .from("business_ads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ad deleted successfully",
      });

      fetchAds();
    } catch (error: any) {
      console.error("Error deleting ad:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete ad",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"} className="h-4 text-[9px]">{status}</Badge>;
  };

  const counts = useMemo(() => ({
    all: ads.length,
    pending: ads.filter(a => a.status === "pending").length,
    approved: ads.filter(a => a.status === "approved").length,
    rejected: ads.filter(a => a.status === "rejected").length,
  }), [ads]);

  const filteredAds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ads.filter((a) => {
      if (q && !(`${a.business_name} ${a.ad_title}`.toLowerCase().includes(q))) return false;
      if (filter !== "all") return a.status === filter;
      return true;
    });
  }, [ads, search, filter]);

  if (loading) return <AdminLoading label="Loading…" />;

  return (
    <AdminPage>
      <AdminPageHeader icon={Megaphone} title="Business Ads" count={counts.all} description="Create and review submissions" />

      {adminUserId && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-4">
          <CreateBusinessAdForm userId={adminUserId} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearch value={search} onChange={setSearch} placeholder="Search business or ad title…" />
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

      <AdminList>
        {filteredAds.length === 0 ? (
          <AdminEmpty message="No business ads submitted yet" />
        ) : (
          filteredAds.map((ad) => (
            <AdminListCard key={ad.id}>
              <AdminRow
                title={ad.business_name}
                badges={getStatusBadge(ad.status)}
                meta={new Date(ad.created_at).toLocaleDateString()}
                actions={
                  <>
                    {ad.status === "pending" && (
                      <>
                        <AdminIconButton icon={Check} title="Approve" tone="success" onClick={() => handleUpdateStatus(ad.id, "approved")} />
                        <AdminIconButton icon={X} title="Reject" tone="danger" onClick={() => handleUpdateStatus(ad.id, "rejected")} />
                      </>
                    )}
                    <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => handleDelete(ad.id)} />
                  </>
                }
                body={
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-xs font-semibold">{ad.ad_title}</p>
                      <p className="text-[10px] text-muted-foreground">{ad.ad_description}</p>
                    </div>

                    {ad.ad_image_url && (
                      <img
                        src={ad.ad_image_url}
                        alt={ad.ad_title}
                        className="rounded-lg max-w-full h-auto max-h-40 object-cover"
                      />
                    )}

                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5" />
                        <a href={`mailto:${ad.contact_email}`} className="hover:underline">
                          {ad.contact_email}
                        </a>
                      </div>
                      {ad.contact_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />
                          <a href={`tel:${ad.contact_phone}`} className="hover:underline">
                            {ad.contact_phone}
                          </a>
                        </div>
                      )}
                      {ad.website_url && (
                        <div className="flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5" />
                          <a
                            href={ad.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            Visit Website
                          </a>
                        </div>
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
}

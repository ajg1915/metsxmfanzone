import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Trash2, ExternalLink, Mail, Phone } from "lucide-react";
import CreateBusinessAdForm from "@/components/CreateBusinessAdForm";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchAds();
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
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full px-2 py-3 space-y-4 overflow-x-hidden">
      <div>
        <h2 className="text-lg sm:text-xl font-bold">Business Ads</h2>
        <p className="text-xs text-muted-foreground">Review submissions</p>
      </div>

      <div className="grid gap-3">
        {ads.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No business ads submitted yet</p>
            </CardContent>
          </Card>
        ) : (
          ads.map((ad) => (
            <Card key={ad.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2 mb-1">
                      {ad.business_name}
                      {getStatusBadge(ad.status)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ad.business_name} • {new Date(ad.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {ad.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleUpdateStatus(ad.id, "approved")}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateStatus(ad.id, "rejected")}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(ad.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold mb-1">{ad.ad_title}</h4>
                  <p className="text-xs text-muted-foreground">{ad.ad_description}</p>
                </div>

                {ad.ad_image_url && (
                  <img
                    src={ad.ad_image_url}
                    alt={ad.ad_title}
                    className="rounded-lg max-w-full h-auto max-h-48 object-cover"
                  />
                )}

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    <a href={`mailto:${ad.contact_email}`} className="hover:underline">
                      {ad.contact_email}
                    </a>
                  </div>
                  {ad.contact_phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <a href={`tel:${ad.contact_phone}`} className="hover:underline">
                        {ad.contact_phone}
                      </a>
                    </div>
                  )}
                  {ad.website_url && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
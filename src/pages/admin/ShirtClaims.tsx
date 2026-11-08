import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Shirt } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { listShirtClaims, setShirtShipped, type ShirtClaim } from "@/lib/shirtApi";

export default function ShirtClaims() {
  const { toast } = useToast();
  const [claims, setClaims] = useState<ShirtClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setClaims((await listShirtClaims()).claims);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load claims");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (c: ShirtClaim) => {
    try {
      await setShirtShipped(c.id, !c.shipped);
      setClaims((rows) => rows.map((r) => (r.id === c.id ? { ...r, shipped: !c.shipped } : r)));
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  };

  const waiting = claims.filter((c) => !c.shipped).length;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Shirt}
        title="Free Shirts"
        count={waiting}
        countLabel="to ship"
        actions={<Button size="sm" variant="outline" className="h-9" onClick={load} disabled={loading}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>}
      />
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : claims.length === 0 && !error ? (
        <AdminEmpty message="No shirt claims yet. New monthly and yearly members will show up here after they send their size and address." />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {claims.map((c) => (
            <Card key={c.id} className="min-w-0 space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
                <Badge className="shrink-0">{c.size}</Badge>
              </div>
              <p className="break-words text-sm">
                {c.address1}{c.address2 ? `, ${c.address2}` : ""}<br />
                {c.city}, {c.state} {c.zip}
                {c.phone ? <><br />{c.phone}</> : null}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                <Button size="sm" variant={c.shipped ? "secondary" : "default"} className="h-9" onClick={() => toggle(c)}>
                  {c.shipped ? "Shipped (undo)" : "Mark shipped"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}

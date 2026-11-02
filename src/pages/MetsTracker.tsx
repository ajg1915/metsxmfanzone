import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { METS_RADAR, type RadarStatus } from "@/data/metsRadar";

const METS_TEAM_ID = 121;
const ET = "America/New_York";

interface Tx {
  id: number;
  date: string;
  typeCode: string;
  typeDesc: string;
  player: string;
  description: string;
}

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(d);
const label = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: ET, month: "short", day: "numeric", year: "numeric" }).format(new Date(`${iso.slice(0, 10)}T12:00:00`));

const STATUS: Record<RadarStatus, { text: string; cls: string }> = {
  in_talks: { text: "In talks", cls: "bg-red-600 text-white" },
  linked: { text: "Linked", cls: "bg-amber-600 text-white" },
  long_shot: { text: "Long shot", cls: "bg-slate-600 text-white" },
};

const isTrade = (t: Tx) => t.typeCode === "TR" || /trade/i.test(t.typeDesc);
const isSigning = (t: Tx) => !isTrade(t) && (/signed|extension/i.test(t.typeDesc) || t.typeCode === "SGN" || t.typeCode === "SFA" || t.typeCode === "SE");

function Feed({ items, empty }: { items: Tx[]; empty: string }) {
  if (!items.length) return <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t.id} className="flex gap-4 rounded-xl border border-border/50 bg-card/70 px-4 py-3.5">
          <p className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label(t.date)}</p>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-foreground">{t.player || t.typeDesc}</p>
            <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{t.description}</p>
          </div>
          <span className="hidden h-fit shrink-0 rounded-full bg-[#0b3e75] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white sm:block">{t.typeDesc}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MetsTracker() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 150 * 86_400_000);
        const res = await fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${METS_TEAM_ID}&startDate=${ymd(start)}&endDate=${ymd(end)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const list: Tx[] = (json.transactions ?? []).map((x: any) => ({
          id: x.id,
          date: x.effectiveDate || x.date,
          typeCode: x.typeCode ?? "",
          typeDesc: x.typeDesc ?? "",
          player: x.person?.fullName ?? "",
          description: x.description ?? "",
        }));
        list.sort((a, b) => +new Date(b.date) - +new Date(a.date));
        if (!cancelled) setTxs(list);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const trades = txs.filter(isTrade);
  const signings = txs.filter(isSigning);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Tracker — Trades, Signings & Rumor Radar | MetsXMFanZone"
        description="Every New York Mets trade and signing, straight from MLB's transactions feed, plus the Radar: players the Mets are being linked to."
        keywords="Mets trades, Mets signings, Mets rumors, Mets transactions, Mets free agents"
        canonical="https://metsxmfanzone.com/mets-tracker"
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Mets Tracker", url: "/mets-tracker" }]}
      />
      <Navigation />
      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">New</p>
        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-wide text-foreground sm:text-6xl">Mets Tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">Every trade, every signing, and the rumors worth watching.</p>

        <Tabs defaultValue="trades" className="mt-6">
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
            {[["trades", "Trades"], ["signings", "Signings"], ["radar", "Radar"]].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="rounded-lg border border-[#ff5a1f] px-5 py-2.5 font-display text-lg font-bold uppercase tracking-wider data-[state=active]:bg-[#ff5a1f] data-[state=active]:text-white">{l}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="trades" className="mt-4">
            {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              : failed ? <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">The MLB transactions feed is not answering right now. Try again in a minute.</p>
              : <Feed items={trades} empty="No Mets trades in the last five months." />}
          </TabsContent>
          <TabsContent value="signings" className="mt-4">
            {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              : failed ? <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">The MLB transactions feed is not answering right now. Try again in a minute.</p>
              : <Feed items={signings} empty="No Mets signings in the last five months." />}
          </TabsContent>
          <TabsContent value="radar" className="mt-4">
            {METS_RADAR.length === 0 ? (
              <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">No active rumors on the Radar right now. Check back as the offseason heats up.</p>
            ) : (
              <ul className="space-y-2">
                {METS_RADAR.map((r) => (
                  <li key={r.player} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl font-bold uppercase tracking-wide text-foreground">{r.player} <span className="text-sm font-semibold text-muted-foreground">· {r.position} · {r.team}</span></p>
                      <p className="mt-0.5 text-[14px] text-muted-foreground">{r.why}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">Source: {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#ff5a1f] hover:underline">{r.source}<ExternalLink className="h-3 w-3" /></a> : r.source} · updated {label(r.updated)}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:w-64">
                      <div className="h-2.5 flex-1 rounded-full bg-muted" role="img" aria-label={`Rumor heat ${r.heat} of 5`}><div className="h-2.5 rounded-full bg-[#ff5a1f]" style={{ width: `${r.heat * 20}%` }} /></div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Radar shows players the Mets are being linked to, each with a source. Rumors are not confirmed moves. Official moves move to Trades or Signings.</p>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

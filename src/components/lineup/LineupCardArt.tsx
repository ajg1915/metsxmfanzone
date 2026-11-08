import { forwardRef } from "react";
import logo from "@/assets/metsxmfanzone-logo.png";
import type { LineupDesign, LineupGameInfo, LineupPitcher, LineupPlayerRow } from "@/lib/lineupDesign";

const TEAM_IDS: Record<string, number> = {
  diamondbacks: 109, braves: 144, orioles: 110, "red sox": 111, cubs: 112, "white sox": 145, reds: 113, guardians: 114,
  rockies: 115, tigers: 116, astros: 117, royals: 118, angels: 108, dodgers: 119, marlins: 146, brewers: 158, twins: 142,
  yankees: 147, athletics: 133, phillies: 143, pirates: 134, padres: 135, giants: 137, mariners: 136, cardinals: 138,
  rays: 139, rangers: 140, "blue jays": 141, nationals: 120,
};
export const oppLogo = (name?: string) => {
  const key = (name || "").toLowerCase();
  for (const [team, id] of Object.entries(TEAM_IDS)) if (key.includes(team)) return `https://www.mlbstatic.com/team-logos/${id}.svg`;
  return undefined;
};

export function palette(d: LineupDesign) {
  if (d.template === "classic")
    return { bg: "#ffffff", panel: "#f1f4f9", text: d.background, sub: "#5b6b86", row: "#f6f8fc", line: "#d9e0ec", onAccent: "#ffffff" };
  if (d.template === "night")
    return { bg: "#0b0d12", panel: "#151922", text: "#ffffff", sub: "#9aa3b5", row: "#151922", line: "#242a37", onAccent: "#ffffff" };
  return { bg: `linear-gradient(160deg, ${d.background} 0%, #001233 100%)`, panel: "rgba(255,255,255,.08)", text: "#ffffff", sub: "rgba(255,255,255,.7)", row: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.14)", onAccent: "#ffffff" };
}

interface Props {
  design: LineupDesign;
  game: LineupGameInfo | null;
  lineup: LineupPlayerRow[];
  pitcher: LineupPitcher | null;
}

/** The designed lineup card. Mobile first: fills the width it is given (up to 520px). */
export const LineupCardArt = forwardRef<HTMLDivElement, Props>(function LineupCardArt({ design, game, lineup, pitcher }, ref) {
  const p = palette(design);
  const rows = lineup.slice(0, 9);
  const opp = game?.opponent || "TBD";
  const oppImg = oppLogo(opp);

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: p.bg, color: p.text }}
    >
      <div style={{ height: 6, background: design.accent }} />

      {/* Header */}
      <div className="flex min-w-0 items-center gap-3 px-4 pt-4">
        <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover sm:h-12 sm:w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.22em]" style={{ color: design.accent }}>
            {design.subtitle}
          </p>
          <h3 className="truncate text-[26px] font-black uppercase leading-none tracking-tight sm:text-3xl">{design.title}</h3>
        </div>
      </div>

      {/* Matchup */}
      <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: p.panel }}>
        <div className="flex min-w-0 items-center gap-2">
          <img src="https://www.mlbstatic.com/team-logos/121.svg" alt="Mets" className="h-9 w-9 shrink-0 object-contain" />
          <span className="text-sm font-black uppercase">Mets</span>
        </div>
        <div className="shrink-0 text-center leading-tight">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: design.accent }}>
            {game ? (game.isHome ? "vs" : "at") : "vs"}
          </p>
          {game && (
            <p className="text-[11px] font-semibold" style={{ color: p.sub }}>
              {game.dateLabel} · {game.timeLabel}
            </p>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-sm font-black uppercase">{opp}</span>
          {oppImg && <img src={oppImg} alt="" className="h-9 w-9 shrink-0 object-contain" />}
        </div>
      </div>

      {/* Batting order */}
      <div className="px-4 pt-3">
        {rows.length === 0 ? (
          <div className="rounded-xl px-3 py-8 text-center text-sm font-semibold" style={{ background: p.row, color: p.sub }}>
            Lineup not available yet. Check back about two hours before first pitch.
          </div>
        ) : (
          <ol className="grid gap-1.5">
            {rows.map((r) => (
              <li key={r.position} className="flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-1.5" style={{ background: p.row, border: `1px solid ${p.line}` }}>
                <span className="w-5 shrink-0 text-center text-base font-black tabular-nums" style={{ color: design.accent }}>
                  {r.position}
                </span>
                {design.showPhotos && (
                  r.imageUrl ? (
                    <img src={r.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" style={{ background: p.panel }} />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: p.panel, color: p.sub }}>
                      {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                  )
                )}
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight">{r.name}</span>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black" style={{ background: design.accent, color: p.onAccent }}>
                  {r.fieldPosition}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Starting pitcher */}
      {design.showPitcher && pitcher && (
        <div className="mx-4 mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: p.panel }}>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: design.accent }}>Starting pitcher</p>
            <p className="truncate text-[15px] font-black">{pitcher.name}</p>
          </div>
          {pitcher.hand && <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-black" style={{ background: design.accent, color: p.onAccent }}>{pitcher.hand}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 px-4 pb-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: p.sub }}>
        <span className="truncate">{design.footer}</span>
        <span style={{ color: design.accent }}>LFGM</span>
      </div>
    </div>
  );
});

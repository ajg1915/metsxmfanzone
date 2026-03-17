import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Radio, ChevronRight, Activity, Zap } from "lucide-react";
import logoImage from "@/assets/metsxmfanzone-logo.png";

interface LiveGame {
  gamePk: number;
  status: { abstractGameState: string; detailedState: string };
  teams: {
    away: { team: { id: number; name: string }; score?: number };
    home: { team: { id: number; name: string }; score?: number };
  };
  linescore?: {
    currentInningOrdinal?: string;
    inningState?: string;
  };
  venue?: { name: string };
}

export default function GamecastBanner() {
  const [game, setGame] = useState<LiveGame | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        // Use ET date since MLB schedules are ET-based
        const etDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&date=${etDate}&hydrate=linescore,team,venue`);
        const data = await res.json();
        if (data.dates?.[0]?.games?.[0]) {
          setGame(data.dates[0].games[0]);
        }
      } catch {
        // silent fail
      }
    };
    fetchGame();
    const interval = setInterval(fetchGame, 60000);
    return () => clearInterval(interval);
  }, []);

  const isLive = game?.status.abstractGameState === 'Live';
  const isFinal = game?.status.abstractGameState === 'Final';
  const hasGame = !!game;

  return (
    <div className="px-3 sm:px-4 md:px-6 mt-4 sm:mt-8 mb-4 sm:mb-8">
      <Link to="/mets-gamecast" className="block group">
        <div className={`relative rounded-2xl overflow-hidden transition-all duration-500 group-hover:scale-[1.005] ${
          isLive
            ? 'bg-card/80 backdrop-blur-2xl border border-destructive/20 shadow-[0_0_40px_hsl(var(--destructive)/0.12),0_8px_32px_hsl(var(--background)/0.4)]'
            : 'bg-card/70 backdrop-blur-2xl border border-border/40 shadow-[0_8px_32px_hsl(var(--background)/0.3)]'
        }`}>
          {/* Animated top accent strip */}
          <div className={`h-[3px] w-full ${
            isLive
              ? 'bg-gradient-to-r from-transparent via-destructive to-transparent'
              : isFinal
              ? 'bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent'
              : 'bg-gradient-to-r from-transparent via-primary to-transparent'
          }`} />

          {/* Decorative background elements */}
          {isLive && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-32 h-32 bg-destructive/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-secondary/[0.03] pointer-events-none" />

          <div className="relative flex items-center gap-2 sm:gap-5 p-3 sm:p-5">
            {/* Logo + branding */}
            <div className="shrink-0 relative">
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center overflow-hidden border transition-all duration-300 shrink-0 ${
                isLive
                  ? 'border-destructive/30 shadow-[0_0_16px_hsl(var(--destructive)/0.2)]'
                  : 'border-primary/20'
              }`}>
                <img 
                  src={logoImage} 
                  alt="MetsXMFanZone" 
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              {isLive && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive border-2 border-background shadow-lg" />
                </span>
              )}
            </div>

            {/* Game info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] sm:text-sm font-black uppercase tracking-wider sm:tracking-widest text-foreground">
                  Gamecast
                </span>
                {isLive && (
                  <span className="flex items-center gap-0.5 sm:gap-1 text-[7px] sm:text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-1.5 sm:px-2 py-0.5 shadow-sm">
                    <Radio className="w-2 h-2 sm:w-2.5 sm:h-2.5 animate-pulse" />
                    LIVE
                  </span>
                )}
                {isFinal && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 border border-border/30 rounded-full px-2.5 py-0.5">
                    FINAL
                  </span>
                )}
              </div>

              {hasGame ? (
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Away team */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg bg-muted/30 flex items-center justify-center p-0.5 sm:p-1 shrink-0">
                      <img
                        src={`https://www.mlbstatic.com/team-logos/${game.teams.away.team.id}.svg`}
                        alt={game.teams.away.team.name}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight truncate max-w-[45px] sm:max-w-none">
                        {game.teams.away.team.name.split(' ').pop()}
                      </span>
                      {(isLive || isFinal) && (
                        <span className="text-base sm:text-xl font-black tabular-nums leading-tight text-foreground">{game.teams.away.score ?? 0}</span>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex flex-col items-center px-0.5 sm:px-1">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground/40 font-black tracking-widest">VS</span>
                  </div>

                  {/* Home team */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg bg-muted/30 flex items-center justify-center p-0.5 sm:p-1 shrink-0">
                      <img
                        src={`https://www.mlbstatic.com/team-logos/${game.teams.home.team.id}.svg`}
                        alt={game.teams.home.team.name}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight truncate max-w-[45px] sm:max-w-none">
                        {game.teams.home.team.name.split(' ').pop()}
                      </span>
                      {(isLive || isFinal) && (
                        <span className="text-base sm:text-xl font-black tabular-nums leading-tight text-foreground">{game.teams.home.score ?? 0}</span>
                      )}
                    </div>
                  </div>

                  {/* Live inning info */}
                  {(isLive && game.linescore?.currentInningOrdinal) && (
                    <span className="flex ml-auto items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[10px] text-destructive font-bold bg-destructive/10 border border-destructive/20 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1">
                      <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-pulse" />
                      {game.linescore.inningState} {game.linescore.currentInningOrdinal}
                    </span>
                  )}
                  {isFinal && (
                    <span className="flex ml-auto items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[10px] text-muted-foreground font-bold bg-muted/30 border border-border/30 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1">
                      FINAL
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">Live scores, play-by-play & box scores</p>
              )}
            </div>

            {/* CTA Arrow */}
            <div className="shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center group-hover:bg-primary/20 group-hover:border-primary/30 transition-all duration-300">
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-primary group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>

          {/* Bottom subtle accent */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border/20 to-transparent" />
        </div>
      </Link>
    </div>
  );
}

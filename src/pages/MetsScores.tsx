import { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, Trophy, Circle, Timer, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
interface GameData {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
  };
  teams: {
    home: {
      team: {
        name: string;
        id: number;
      };
      score?: number;
      isWinner?: boolean;
    };
    away: {
      team: {
        name: string;
        id: number;
      };
      score?: number;
      isWinner?: boolean;
    };
  };
  venue?: {
    name: string;
  };
  linescore?: {
    currentInning?: number;
    inningState?: string;
  };
}
const MetsScores = () => {
  const [previousGames, setPreviousGames] = useState<GameData[]>([]);
  const [currentGames, setCurrentGames] = useState<GameData[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<GameData[]>([]);
  const [highlightsMap, setHighlightsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [isOffSeason, setIsOffSeason] = useState(false);

  // Sample games to show during off-season
  const getSampleGames = (): {
    previous: GameData[];
    upcoming: GameData[];
  } => {
    const baseDate = new Date();
    const previousSample: GameData[] = [{
      gamePk: 1001,
      gameDate: new Date(2025, 9, 5, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 7
        },
        away: {
          team: {
            name: 'Atlanta Braves',
            id: 144
          },
          score: 4
        }
      },
      venue: {
        name: 'Citi Field'
      }
    }, {
      gamePk: 1002,
      gameDate: new Date(2025, 9, 4, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'Atlanta Braves',
            id: 144
          },
          score: 5
        },
        away: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 3
        }
      },
      venue: {
        name: 'Truist Park'
      }
    }, {
      gamePk: 1003,
      gameDate: new Date(2025, 9, 3, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 6
        },
        away: {
          team: {
            name: 'Philadelphia Phillies',
            id: 143
          },
          score: 2
        }
      },
      venue: {
        name: 'Citi Field'
      }
    }, {
      gamePk: 1004,
      gameDate: new Date(2025, 9, 2, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 4
        },
        away: {
          team: {
            name: 'Philadelphia Phillies',
            id: 143
          },
          score: 5
        }
      },
      venue: {
        name: 'Citi Field'
      }
    }, {
      gamePk: 1005,
      gameDate: new Date(2025, 9, 1, 13, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'Miami Marlins',
            id: 146
          },
          score: 2
        },
        away: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 8
        }
      },
      venue: {
        name: 'loanDepot Park'
      }
    }, {
      gamePk: 1006,
      gameDate: new Date(2025, 8, 30, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          },
          score: 5
        },
        away: {
          team: {
            name: 'Washington Nationals',
            id: 120
          },
          score: 1
        }
      },
      venue: {
        name: 'Citi Field'
      }
    }];
    const upcomingSample: GameData[] = [{
      gamePk: 2001,
      gameDate: new Date(2026, 1, 21, 13, 10).toISOString(),
      status: {
        abstractGameState: 'Preview',
        detailedState: 'Scheduled'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          }
        },
        away: {
          team: {
            name: 'Houston Astros',
            id: 117
          }
        }
      },
      venue: {
        name: 'Clover Park'
      }
    }, {
      gamePk: 2002,
      gameDate: new Date(2026, 1, 23, 13, 10).toISOString(),
      status: {
        abstractGameState: 'Preview',
        detailedState: 'Scheduled'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          }
        },
        away: {
          team: {
            name: 'St. Louis Cardinals',
            id: 138
          }
        }
      },
      venue: {
        name: 'Clover Park'
      }
    }, {
      gamePk: 2003,
      gameDate: new Date(2026, 1, 25, 13, 10).toISOString(),
      status: {
        abstractGameState: 'Preview',
        detailedState: 'Scheduled'
      },
      teams: {
        home: {
          team: {
            name: 'Boston Red Sox',
            id: 111
          }
        },
        away: {
          team: {
            name: 'New York Mets',
            id: 121
          }
        }
      },
      venue: {
        name: 'JetBlue Park'
      }
    }, {
      gamePk: 2004,
      gameDate: new Date(2026, 2, 26, 19, 10).toISOString(),
      status: {
        abstractGameState: 'Preview',
        detailedState: 'Scheduled'
      },
      teams: {
        home: {
          team: {
            name: 'New York Mets',
            id: 121
          }
        },
        away: {
          team: {
            name: 'Atlanta Braves',
            id: 144
          }
        }
      },
      venue: {
        name: 'Citi Field'
      }
    }];
    return {
      previous: previousSample,
      upcoming: upcomingSample
    };
  };
  useEffect(() => {
    fetchMetsGames();
    const interval = setInterval(fetchMetsGames, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  const fetchMetsGames = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 14); // Last 14 days
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7); // Next 7 days

      const formatDate = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}&hydrate=linescore,team,venue`);
      if (!response.ok) throw new Error('Failed to fetch games');
      const data = await response.json();
      const allGames: GameData[] = [];
      if (data.dates) {
        data.dates.forEach((date: {
          games: GameData[];
        }) => {
          allGames.push(...date.games);
        });
      }

      // If no games found, we're in off-season - use sample data
      if (allGames.length === 0) {
        setIsOffSeason(true);
        const sampleData = getSampleGames();
        setPreviousGames(sampleData.previous);
        setUpcomingGames(sampleData.upcoming);
        setCurrentGames([]);
        setLoading(false);
        return;
      }
      setIsOffSeason(false);
      const todayStr = formatDate(today);
      const previous = allGames.filter(game => game.status.abstractGameState === 'Final' && game.gameDate.split('T')[0] < todayStr).sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());
      const current = allGames.filter(game => game.status.abstractGameState === 'Live' || game.gameDate.split('T')[0] === todayStr && game.status.abstractGameState !== 'Final');
      const upcoming = allGames.filter(game => game.status.abstractGameState === 'Preview' && game.gameDate.split('T')[0] > todayStr).sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
      setPreviousGames(previous.slice(0, 10));
      setCurrentGames(current);
      setUpcomingGames(upcoming.slice(0, 5));
    } catch (error) {
      console.error('Error fetching Mets games:', error);
      // On error, show sample data
      setIsOffSeason(true);
      const sampleData = getSampleGames();
      setPreviousGames(sampleData.previous);
      setUpcomingGames(sampleData.upcoming);
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI-generated key highlights for previous games
  useEffect(() => {
    if (!previousGames.length) return;
    const dates = previousGames
      .map((g) => g.gameDate?.split('T')[0])
      .filter(Boolean) as string[];
    if (!dates.length) return;
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    (async () => {
      const { data, error } = await supabase
        .from('game_recaps' as any)
        .select('game_date, highlights')
        .eq('status', 'published')
        .gte('game_date', earliest)
        .lte('game_date', latest);
      if (error || !data) return;
      const map: Record<string, string[]> = {};
      for (const row of data as any[]) {
        const h = Array.isArray(row.highlights) ? row.highlights : [];
        if (row.game_date && h.length) map[row.game_date] = h.slice(0, 5);
      }
      setHighlightsMap(map);
    })();
  }, [previousGames]);

  const getTeamAbbrev = (teamName: string) => {
    const abbreviations: Record<string, string> = {
      'New York Mets': 'NYM',
      'New York Yankees': 'NYY',
      'Atlanta Braves': 'ATL',
      'Philadelphia Phillies': 'PHI',
      'Miami Marlins': 'MIA',
      'Washington Nationals': 'WSH',
      'Boston Red Sox': 'BOS',
      'Tampa Bay Rays': 'TB',
      'Baltimore Orioles': 'BAL',
      'Toronto Blue Jays': 'TOR',
      'Chicago Cubs': 'CHC',
      'Chicago White Sox': 'CWS',
      'St. Louis Cardinals': 'STL',
      'Milwaukee Brewers': 'MIL',
      'Pittsburgh Pirates': 'PIT',
      'Cincinnati Reds': 'CIN',
      'Los Angeles Dodgers': 'LAD',
      'San Diego Padres': 'SD',
      'San Francisco Giants': 'SF',
      'Arizona Diamondbacks': 'ARI',
      'Colorado Rockies': 'COL',
      'Houston Astros': 'HOU',
      'Texas Rangers': 'TEX',
      'Seattle Mariners': 'SEA',
      'Oakland Athletics': 'OAK',
      'Los Angeles Angels': 'LAA',
      'Minnesota Twins': 'MIN',
      'Cleveland Guardians': 'CLE',
      'Detroit Tigers': 'DET',
      'Kansas City Royals': 'KC'
    };
    return abbreviations[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || 'UNK';
  };
  const formatGameDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };
  const formatGameTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };
  const isMetsHome = (game: GameData) => game.teams.home.team.id === 121;
  const getCountdown = (gameDate: string) => {
    const now = new Date().getTime();
    const gameTime = new Date(gameDate).getTime();
    const diff = gameTime - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
    const minutes = Math.floor(diff % (1000 * 60 * 60) / (1000 * 60));
    if (days > 0) {
      return {
        days,
        hours,
        minutes,
        label: `${days}d ${hours}h`
      };
    } else if (hours > 0) {
      return {
        days: 0,
        hours,
        minutes,
        label: `${hours}h ${minutes}m`
      };
    } else {
      return {
        days: 0,
        hours: 0,
        minutes,
        label: `${minutes}m`
      };
    }
  };
  const [countdowns, setCountdowns] = useState<Record<number, ReturnType<typeof getCountdown>>>({});
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: Record<number, ReturnType<typeof getCountdown>> = {};
      upcomingGames.forEach(game => {
        newCountdowns[game.gamePk] = getCountdown(game.gameDate);
      });
      setCountdowns(newCountdowns);
    };
    updateCountdowns();
    const interval = setInterval(updateCountdowns, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [upcomingGames]);
  const getMetsResult = (game: GameData) => {
    const metsHome = isMetsHome(game);
    const metsScore = metsHome ? game.teams.home.score : game.teams.away.score;
    const oppScore = metsHome ? game.teams.away.score : game.teams.home.score;
    if (metsScore === undefined || oppScore === undefined) return null;
    if (metsScore > oppScore) return 'W';
    if (metsScore < oppScore) return 'L';
    return 'T';
  };
  const getTeamLogo = (teamId: number) => {
    return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  };
  const GameCard = ({
    game,
    showLive = false,
    showCountdown = false,
    highlights,
  }: {
    game: GameData;
    showLive?: boolean;
    showCountdown?: boolean;
    highlights?: string[];
  }) => {
    const metsHome = isMetsHome(game);
    const opponent = metsHome ? game.teams.away.team : game.teams.home.team;
    const metsScore = metsHome ? game.teams.home.score : game.teams.away.score;
    const oppScore = metsHome ? game.teams.away.score : game.teams.home.score;
    const result = getMetsResult(game);
    const isLive = game.status.abstractGameState === 'Live';
    const isFinal = game.status.abstractGameState === 'Final';
    return <Card className="border-border/50 hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatGameDate(game.gameDate)}</span>
            </div>
            {isLive && showLive && <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                <Circle className="h-2 w-2 fill-current" />
                LIVE
              </Badge>}
            {isFinal && result && <Badge variant={result === 'W' ? 'default' : 'secondary'} className={result === 'W' ? 'bg-green-600' : 'bg-red-600'}>
                {result}
              </Badge>}
            {!isLive && !isFinal && <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatGameTime(game.gameDate)}</span>
              </div>}
          </div>

          <div className="flex items-center gap-3">
            {/* Team logos matchup */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <img src={getTeamLogo(121)} alt="NYM" className="w-8 h-8 object-contain" onError={e => {
              e.currentTarget.style.display = 'none';
            }} />
              <span className="text-xs text-muted-foreground font-medium">vs</span>
              <img src={getTeamLogo(opponent.id)} alt={getTeamAbbrev(opponent.name)} className="w-8 h-8 object-contain" onError={e => {
              e.currentTarget.style.display = 'none';
            }} />
            </div>

            {/* Score display */}
            <div className="flex-1">
              <div className={`flex items-center justify-between py-1.5 ${metsHome ? 'border-l-2 border-primary pl-2' : ''}`}>
                <span className="font-bold text-foreground text-sm">NYM</span>
                {(isFinal || isLive) && <span className={`text-lg font-bold ${result === 'W' ? 'text-green-500' : ''}`}>
                    {metsScore ?? '-'}
                  </span>}
              </div>
              <div className={`flex items-center justify-between py-1.5 ${!metsHome ? 'border-l-2 border-muted-foreground/30 pl-2' : ''}`}>
                <span className="text-muted-foreground text-sm">{getTeamAbbrev(opponent.name)}</span>
                {(isFinal || isLive) && <span className={`text-lg font-bold ${result === 'L' ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {oppScore ?? '-'}
                  </span>}
              </div>
            </div>
          </div>

          {isLive && game.linescore && <div className="mt-2 pt-2 border-t border-border/50 text-center text-sm text-muted-foreground">
              {game.linescore.inningState} {game.linescore.currentInning}
            </div>}

          {game.venue && <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{game.venue.name}</span>
            </div>}

          {showCountdown && countdowns[game.gamePk] && <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Timer className="h-4 w-4" />
                <span className="text-sm font-semibold">First Pitch In:</span>
              </div>
              <div className="flex justify-center gap-3 mt-2">
                {countdowns[game.gamePk]!.days > 0 && <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{countdowns[game.gamePk]!.days}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Days</div>
                  </div>}
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{countdowns[game.gamePk]!.hours}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{countdowns[game.gamePk]!.minutes}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Min</div>
                </div>
              </div>
            </div>}
        </CardContent>
      </Card>;
  };
  const LoadingSkeleton = () => <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>;
  return <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Scores - Live & Previous Games"
        description="Check the latest New York Mets scores, live game updates, and previous game results. Stay updated with your favorite team."
        keywords="Mets scores, Mets live score, New York Mets game results, MLB scores, Mets today"
        canonical="https://www.metsxmfanzone.com/mets-scores"
      />

      <Navigation />

      <main className="pt-12 pb-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
              Mets Scores
            </h1>
            <p className="text-muted-foreground text-sm text-center font-normal">Live updates and game results</p>
          </div>

          {isOffSeason && <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Off-Season Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Showing sample games from the 2025 season and upcoming 2026 Spring Training schedule.
                    Live scores will appear when the season begins.
                  </p>
                </div>
              </CardContent>
            </Card>}

          {/* Current/Live Games */}
          {(currentGames.length > 0 || loading) && <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Today's Games</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? <>
                    <LoadingSkeleton />
                    <LoadingSkeleton />
                  </> : currentGames.length > 0 ? currentGames.map(game => <GameCard key={game.gamePk} game={game} showLive />) : <Card className="col-span-full border-border/50 bg-card/50">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No games scheduled for today
                    </CardContent>
                  </Card>}
              </div>
            </section>}

          {/* Latest Previous Score Highlight */}
          {previousGames.length > 0 && <section className="mb-8">
              <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Latest Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                const game = previousGames[0];
                const metsHome = isMetsHome(game);
                const opponent = metsHome ? game.teams.away.team.name : game.teams.home.team.name;
                const metsScore = metsHome ? game.teams.home.score : game.teams.away.score;
                const oppScore = metsHome ? game.teams.away.score : game.teams.home.score;
                const result = getMetsResult(game);
                return <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {formatGameDate(game.gameDate)} {metsHome ? 'vs' : '@'} {opponent}
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-3xl font-bold">NYM {metsScore}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-2xl text-muted-foreground">{getTeamAbbrev(opponent)} {oppScore}</span>
                          </div>
                        </div>
                        <Badge className={`text-lg px-4 py-2 ${result === 'W' ? 'bg-green-600' : 'bg-red-600'}`}>
                          {result === 'W' ? 'WIN' : 'LOSS'}
                        </Badge>
                      </div>;
              })()}
                </CardContent>
              </Card>
            </section>}

          {/* Previous Games */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Previous Games</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? <>
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                </> : previousGames.length > 0 ? previousGames.map(game => <GameCard key={game.gamePk} game={game} />) : <Card className="col-span-full border-border/50 bg-card/50">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No previous games found
                  </CardContent>
                </Card>}
            </div>
          </section>

          {/* Upcoming Games */}
          {upcomingGames.length > 0 && <section>
              <h2 className="text-xl font-bold mb-4">Upcoming Games</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {upcomingGames.map(game => <GameCard key={game.gamePk} game={game} showCountdown />)}
              </div>
            </section>}
        </div>
      </main>

      <Footer />
    </div>;
};
export default MetsScores;
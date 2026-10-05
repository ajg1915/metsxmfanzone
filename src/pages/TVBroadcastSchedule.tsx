import { useState, useMemo } from "react";
import { format, addDays, subDays, startOfDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Tv, Radio, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDevice } from "@/hooks/use-device";

interface ScheduleItem {
  id: string;
  network: string;
  show_title: string;
  description?: string;
  time_slot: string;
  is_live: boolean;
}

interface MetsGame {
  gameId: number;
  date: string;
  gameType: string;
  gameTypeLabel: string;
  status: string;
  isHome: boolean;
  opponent: string;
  venue: string;
}

const TVBroadcastSchedule = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const { isTV, isMobile } = useDevice();

  const { data: tvSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['tv-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tv_schedules')
        .select('*')
        .order('time_slot', { ascending: true });
      if (error) throw error;
      return data as ScheduleItem[];
    }
  });

  const { data: metsSchedule, isLoading: metsLoading } = useQuery({
    queryKey: ['mets-broadcast-schedule', selectedDate.getFullYear()],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-mets-schedule', {
        body: { year: selectedDate.getFullYear(), gameTypes: ['S', 'R'] }
      });
      if (error) throw error;
      return data?.games as MetsGame[] || [];
    },
    staleTime: 1000 * 60 * 30
  });

  const gamesForDate = useMemo(() => {
    if (!metsSchedule) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return metsSchedule.filter(game => format(parseISO(game.date), 'yyyy-MM-dd') === dateStr);
  }, [metsSchedule, selectedDate]);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(startOfDay(new Date()));
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const schedulesByNetwork = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    tvSchedules.forEach(schedule => {
      if (!grouped[schedule.network]) grouped[schedule.network] = [];
      grouped[schedule.network].push(schedule);
    });
    return grouped;
  }, [tvSchedules]);

  // TV-optimized layout: single-screen fit, large text, no scroll needed
  if (isTV) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background flex flex-col">
        <SEOHead
          title="TV Broadcast Schedule | MetsXMFanZone"
          description="View the complete broadcast schedule for New York Mets games."
          keywords="Mets TV schedule, Mets broadcast, SNY schedule"
        />

        {/* Compact TV Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card/50 shrink-0">
          <div className="flex items-center gap-4">
            <Tv className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Broadcast Schedule</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="lg" onClick={handlePrevDay} className="h-12 w-12">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              size="lg"
              onClick={handleToday}
              className="min-w-[200px] h-12 text-lg"
            >
              <Calendar className="w-5 h-5 mr-2" />
              {format(selectedDate, 'EEE, MMM d')}
            </Button>
            <Button variant="outline" size="lg" onClick={handleNextDay} className="h-12 w-12">
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1.5">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full mr-2 animate-pulse" />
              Live
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1.5">Spring</Badge>
            <Badge variant="default" className="text-sm px-3 py-1.5">Regular</Badge>
          </div>
        </div>

        {/* Two-panel TV layout */}
        <div className="flex-1 flex gap-4 p-6 min-h-0">
          {/* Left: Today's Games */}
          <div className="w-[40%] flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col border-primary/30 min-h-0">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Radio className="w-5 h-5 text-primary" />
                  Mets Games — {format(selectedDate, 'MMM d')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto min-h-0">
                {metsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : gamesForDate.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Calendar className="w-16 h-16 mb-3 opacity-40" />
                    <p className="text-lg">No games scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gamesForDate.map((game) => (
                      <div
                        key={game.gameId}
                        className={`p-4 rounded-lg border-2 ${
                          game.status === 'In Progress'
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-foreground">
                              {format(parseISO(game.date), 'h:mm a')}
                            </span>
                            <span className="text-lg text-foreground">
                              Mets {game.isHome ? 'vs' : '@'} {game.opponent}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={game.gameType === 'S' ? 'secondary' : 'default'} className="text-sm">
                              {game.gameTypeLabel}
                            </Badge>
                            <Badge
                              variant={game.status === 'In Progress' ? 'destructive' : 'outline'}
                              className={`text-sm ${game.status === 'In Progress' ? 'animate-pulse' : ''}`}
                            >
                              {game.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{game.venue}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Network Programming */}
          <div className="w-[60%] flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col border-border/50 min-h-0">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Tv className="w-5 h-5 text-primary" />
                  Network Programming
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto min-h-0">
                {schedulesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : Object.keys(schedulesByNetwork).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Tv className="w-16 h-16 mb-3 opacity-40" />
                    <p className="text-lg">No schedules available</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-base">Time</TableHead>
                        <TableHead className="text-base">Network</TableHead>
                        <TableHead className="text-base">Program</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tvSchedules.map((schedule) => (
                        <TableRow
                          key={schedule.id}
                          className={schedule.is_live ? 'bg-red-500/10' : ''}
                        >
                          <TableCell className="text-base font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {schedule.is_live && (
                                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                              )}
                              {schedule.time_slot}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-sm">
                              {schedule.network.replace(' Network', '')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-base font-medium">
                            {schedule.show_title}
                            {schedule.description && (
                              <span className="text-muted-foreground text-sm ml-2">
                                — {schedule.description}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Standard mobile/tablet/desktop layout
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="TV Broadcast Schedule | MetsXMFanZone"
        description="View the complete broadcast schedule for New York Mets games on SNY, ESPN, MLB Network, and more."
        keywords="Mets TV schedule, Mets broadcast, SNY schedule, MLB Network, ESPN Mets"
      />
      <Navigation />

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8 md:pt-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <Tv className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">Broadcast Schedule</h1>
              <p className="text-xs text-muted-foreground">All times ET</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={handlePrevDay} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              onClick={handleToday}
              className="min-w-[120px] sm:min-w-[140px] h-8 text-xs sm:text-sm"
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              {format(selectedDate, 'EEE, MMM d')}
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextDay} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mets Games */}
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <Radio className="w-4 h-4 text-primary" />
              Mets Games — {format(selectedDate, isMobile ? 'MMM d' : 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {metsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : gamesForDate.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No games scheduled</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Matchup</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      {!isMobile && <TableHead className="text-xs">Venue</TableHead>}
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gamesForDate.map((game) => (
                      <TableRow key={game.gameId}>
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          {format(parseISO(game.date), 'h:mm a')}
                        </TableCell>
                        <TableCell className="text-xs">
                          Mets {game.isHome ? 'vs' : '@'} {game.opponent}
                        </TableCell>
                        <TableCell>
                          <Badge variant={game.gameType === 'S' ? 'secondary' : 'default'} className="text-[10px]">
                            {game.gameTypeLabel}
                          </Badge>
                        </TableCell>
                        {!isMobile && (
                          <TableCell className="text-xs text-muted-foreground">{game.venue}</TableCell>
                        )}
                        <TableCell>
                          <Badge
                            variant={game.status === 'In Progress' ? 'destructive' : 'outline'}
                            className={`text-[10px] ${game.status === 'In Progress' ? 'animate-pulse' : ''}`}
                          >
                            {game.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Programming */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <Tv className="w-4 h-4 text-primary" />
              Network Programming
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {schedulesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : Object.keys(schedulesByNetwork).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Tv className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No schedules available</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Network</TableHead>
                      <TableHead className="text-xs">Program</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tvSchedules.map((schedule) => (
                      <TableRow
                        key={schedule.id}
                        className={schedule.is_live ? 'bg-red-500/10' : ''}
                      >
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {schedule.is_live && (
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                            )}
                            {schedule.time_slot}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {schedule.network.replace(' Network', '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {schedule.show_title}
                          {schedule.description && !isMobile && (
                            <span className="text-muted-foreground text-xs ml-1.5">
                              — {schedule.description}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <Badge variant="outline" className="text-xs px-2 py-1">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse" />
            Live
          </Badge>
          <Badge variant="secondary" className="text-xs px-2 py-1">Spring</Badge>
          <Badge variant="default" className="text-xs px-2 py-1">Regular</Badge>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TVBroadcastSchedule;

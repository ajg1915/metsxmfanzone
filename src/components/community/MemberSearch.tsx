import { useEffect, useState } from "react";
import { Search, Loader2, Users, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Member {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

const MemberSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_members", {
        q: query.trim().slice(0, 60),
      });
      if (!error && data) setResults(data as Member[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const initials = (name: string | null) =>
    (name || "?")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <Card className="mb-6 bg-card/90 backdrop-blur-xl border-muted/40">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Users className="w-4 h-4" />
          Find Mets Members
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search by name..."
            maxLength={60}
            className="pl-8 h-9 text-xs sm:text-sm"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {open && query.trim().length >= 2 && (
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {!loading && results.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-3">
                No paid members match "{query}".
              </p>
            )}
            {results.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="w-9 h-9">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name || "Member"} />}
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {m.full_name || "Mets Fan"}
                  </p>
                </div>
                {m.is_admin ? (
                  <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30 gap-1">
                    <Crown className="w-2.5 h-2.5" /> Admin
                  </Badge>
                ) : (
                  <Badge className="text-[9px] bg-secondary/20 text-secondary border-secondary/30">
                    Member
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
        {query.trim().length > 0 && query.trim().length < 2 && (
          <p className="text-[10px] text-muted-foreground">Type at least 2 characters.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MemberSearch;

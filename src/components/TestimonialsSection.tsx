import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Quote, Send, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Testimonial {
  id: string;
  content: string;
  rating: number | null;
  location: string | null;
  display_name: string | null;
  created_at: string;
}

const MAX_CHARS = 500;
const SHOWN = 12;

const Stars = ({ value, size = "h-4 w-4" }: { value: number; size?: string }) => (
  <div className="flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`${size} ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/50"}`} />
    ))}
  </div>
);

const TestimonialsSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justPosted, setJustPosted] = useState(false);

  const load = async () => {
    try {
      // Only non-identifying columns are readable by the app; submitter
      // identity (user_id) stays restricted at the database level.
      const { data, error, count } = await supabase
        .from("feedbacks")
        .select("id, content, rating, location, display_name, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setReviews((data ?? []) as Testimonial[]);
      setTotal(count ?? data?.length ?? 0);
    } catch (e) {
      console.error("Error fetching testimonials:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const average = useMemo(() => {
    const rated = reviews.filter((r) => r.rating);
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length;
  }, [reviews]);

  const submit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!text.trim()) {
      toast.error("Please write a few words first");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedbacks").insert({
        user_id: user.id,
        content: text.trim(),
        rating,
        location: place.trim() || null,
        display_name: name.trim() || null,
      });
      if (error) throw error;
      toast.success("Thanks! Your review is on the site.");
      setText("");
      setRating(5);
      setName("");
      setPlace("");
      setJustPosted(true);
      load();
    } catch (e) {
      console.error("Error submitting review:", e);
      toast.error("Couldn't post your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="fan-reviews-title" className="py-6 sm:py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
              <span className="h-0.5 w-4 bg-primary" /> From the community
            </p>
            <h2 id="fan-reviews-title" className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-3xl">
              What Fans Are Saying
            </h2>
          </div>
          {average !== null && (
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/70 px-3.5 py-2">
              <span className="font-display text-[34px] font-bold leading-none text-foreground">{average.toFixed(1)}</span>
              <div>
                <Stars value={Math.round(average)} />
                <p className="mt-0.5 text-xs text-muted-foreground">{total} reviews</p>
              </div>
            </div>
          )}
        </div>

        {/* Reviews */}
        {loading ? (
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[190px] w-[82vw] max-w-[340px] shrink-0 animate-pulse rounded-2xl bg-card/60 md:w-1/3 md:max-w-none" />
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide sm:mx-0 sm:px-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
            {reviews.slice(0, SHOWN).map((r) => {
              const who = r.display_name || "Mets Fan";
              return (
                <figure
                  key={r.id}
                  className="relative flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-2xl border border-border/50 bg-card/80 p-4 md:w-auto md:max-w-none"
                >
                  <Quote className="absolute right-3 top-3 h-6 w-6 text-primary/25" aria-hidden="true" />
                  <Stars value={r.rating || 5} />
                  <blockquote className="mt-3 line-clamp-6 flex-1 text-[15px] leading-relaxed text-foreground/90">“{r.content}”</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary" aria-hidden="true">
                      {who.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{who}</span>
                      {r.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          <span className="truncate">{r.location}</span>
                        </span>
                      )}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
        )}

        {/* Composer: always visible */}
        <div className="mt-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/70 to-card/60 p-4 sm:p-6">
          <h3 className="font-display text-2xl font-bold uppercase leading-none tracking-wide text-foreground">Share your experience</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {user ? "Tell other fans what you love about MetsXMFanZone. It shows up on the site right away." : "Log in to leave a review. It takes less than a minute."}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
            <div>
              <fieldset className="mb-3">
                <legend className="mb-1 text-[13px] font-bold text-foreground/80">Your rating</legend>
                <div className="-ml-1 flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      aria-pressed={n === rating}
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <Star className={`h-7 w-7 transition-transform active:scale-90 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/60"}`} />
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="review-text" className="mb-1 block text-[13px] font-bold text-foreground/80">Your review</label>
              <Textarea
                id="review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you like most? Streams, podcast, community…"
                maxLength={MAX_CHARS}
                className="min-h-[120px] text-base"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                {text.length}/{MAX_CHARS}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="review-name" className="mb-1 block text-[13px] font-bold text-foreground/80">Name (optional)</label>
                <Input id="review-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we call you?" maxLength={30} className="h-12 text-base" />
              </div>
              <div>
                <label htmlFor="review-place" className="mb-1 block text-[13px] font-bold text-foreground/80">Where are you from? (optional)</label>
                <Input id="review-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Queens, NY" maxLength={50} className="h-12 text-base" />
              </div>
              <Button
                onClick={submit}
                disabled={submitting || (!!user && !text.trim())}
                className="mt-auto h-[50px] gap-2 bg-[#d43700] text-base font-bold text-white hover:bg-[#d43700]/90"
              >
                <Send className="h-4 w-4" />
                {!user ? "Log in to post" : submitting ? "Posting…" : "Post review"}
              </Button>
              {justPosted && <p role="status" className="text-center text-sm text-green-400">Posted. Thank you!</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

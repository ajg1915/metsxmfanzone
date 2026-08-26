import { useState, useEffect } from "react";
import { Star, Quote, Send, MapPin } from "lucide-react";
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
  user_id: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const TestimonialsSection = () => {
  const { user } = useAuth();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newLocation, setNewLocation] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get display name - prioritize custom display_name, then first name from profile
  const getDisplayName = (testimonial: Testimonial): string => {
    if (testimonial.display_name) return testimonial.display_name;
    if (testimonial.profile?.full_name) return testimonial.profile.full_name.split(" ")[0];
    return "Mets Fan";
  };

  const fetchTestimonials = async () => {
    try {
      // Only non-identifying columns are readable by the app; submitter
      // identity (user_id) stays restricted at the database level.
      const { data: feedbacks, error } = await supabase
        .from("feedbacks")
        .select("id, content, rating, location, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      setTestimonials((feedbacks || []).map((feedback) => ({
        ...feedback,
        user_id: "",
        profile: null,
      })) as Testimonial[]);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchTestimonials();
  }, []);

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error("Please log in to submit a review");
      return;
    }

    if (!newReview.trim()) {
      toast.error("Please write a review");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedbacks").insert({
        user_id: user.id,
        content: newReview.trim(),
        rating: newRating,
        location: newLocation.trim() || null,
        display_name: newDisplayName.trim() || null
      });

      if (error) throw error;

      toast.success("Thank you for your review!");
      setNewReview("");
      setNewRating(5);
      setNewLocation("");
      setNewDisplayName("");
      setShowForm(false);
      fetchTestimonials();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number | null) => {
    const stars = rating || 5;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= stars ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderRatingSelector = () => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setNewRating(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              star <= newRating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <section className="py-6 sm:py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto glass-card glow-blue rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
        <div className="text-center mb-5 sm:mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1.5 sm:mb-2 leading-tight">
            What Fans Are Saying
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Join our community and share your experience
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card/50 rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6 animate-pulse">
                <div className="h-3 sm:h-4 bg-muted rounded w-3/4 mb-3 sm:mb-4" />
                <div className="h-12 sm:h-16 bg-muted rounded mb-3 sm:mb-4" />
                <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : testimonials.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 relative group hover:border-primary/30 transition-all duration-300"
              >
                <Quote className="absolute top-3 right-3 sm:top-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 text-primary/20" />
                <div className="mb-2 sm:mb-3">{renderStars(testimonial.rating)}</div>
                <p className="text-foreground/90 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 line-clamp-4">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs sm:text-sm">
                    {getDisplayName(testimonial)?.charAt(0)?.toUpperCase() || "F"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-medium text-foreground/80">
                      {getDisplayName(testimonial)}
                    </span>
                    {testimonial.location && (
                      <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5 sm:gap-1">
                        <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {testimonial.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        )}

        {/* Write Review Section */}
        {user && (
          <div className="mt-8 text-center">
            {!showForm ? (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-primary hover:bg-primary/90"
              >
                Write a Review
              </Button>
            ) : (
              <div className="max-w-md mx-auto bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Share Your Experience
                </h3>
                <div className="mb-4">
                  <label className="block text-sm text-muted-foreground mb-2">
                    Your Rating
                  </label>
                  {renderRatingSelector()}
                </div>
                <Textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                  placeholder="Tell us what you love about MetsXMFanZone..."
                  className="mb-4 min-h-[100px]"
                  maxLength={500}
                />
                <div className="mb-4">
                  <label className="block text-sm text-muted-foreground mb-2">
                    Your Name (optional)
                  </label>
                  <Input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="How would you like to be called?"
                    maxLength={30}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm text-muted-foreground mb-2">
                    Where are you from? (optional)
                  </label>
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Queens, NY"
                    maxLength={50}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setNewReview("");
                      setNewRating(5);
                      setNewLocation("");
                      setNewDisplayName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting || !newReview.trim()}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;

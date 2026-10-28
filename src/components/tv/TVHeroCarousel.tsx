import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export interface TVHeroSlide {
  id: string;
  kind: "live" | "article";
  badge: string;
  title: string;
  description: string;
  image?: string | null;
  primaryLabel: string;
  to: string;
}

interface TVHeroCarouselProps {
  slides: TVHeroSlide[];
}

// Hero from the TV Site design: the live stream first, then the latest articles.
// Rotates on its own, but stops while the remote is focused inside it so a
// button never changes under the viewer's thumb.
export function TVHeroCarousel({ slides }: TVHeroCarouselProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length, paused]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  if (slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  const live = slide.kind === "live";

  // Google TV style: edge-to-edge hero, artwork on the right fading into the page background,
  // text and the action button on the left.
  return (
    <div
      ref={ref}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className="relative w-full min-h-[54vh] bg-[color:var(--tv-bg)]"
      aria-roledescription="carousel"
    >
      <div className="absolute inset-0 overflow-hidden">
      <div
        className={
          live
            ? "absolute inset-0 bg-[radial-gradient(70%_90%_at_80%_20%,rgba(255,89,16,0.32),transparent_65%),radial-gradient(60%_80%_at_70%_80%,rgba(13,42,92,0.9),transparent_70%)]"
            : "absolute inset-0 bg-[radial-gradient(70%_90%_at_80%_20%,rgba(255,89,16,0.22),transparent_65%),radial-gradient(60%_80%_at_70%_80%,rgba(13,42,92,0.8),transparent_70%)]"
        }
      />
      {slide.image && (
        <img
          key={slide.id}
          src={slide.image}
          alt=""
          className="absolute right-0 top-0 h-full w-[68%] object-cover animate-in fade-in duration-700 [mask-image:linear-gradient(to_right,transparent_0%,#000_38%),linear-gradient(to_bottom,#000_70%,transparent_100%)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
        />
      )}
      {/* Fade to the page colour on the left and bottom so the text always reads */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--tv-bg)_0%,rgba(0,0,0,0)_55%),linear-gradient(0deg,var(--tv-bg)_0%,rgba(0,0,0,0)_28%)]" />
      </div>

      <div className="relative flex min-h-[54vh] w-[56%] flex-col justify-end items-start gap-[1.2vh] px-[3.2vw] pt-[8vh] pb-[5vh]">
        <span
          className={
            "inline-flex items-center gap-2 text-[1.1rem] font-semibold uppercase tracking-[0.18em] " +
            (live ? "text-[#fb7185]" : "text-[color:var(--tv-accent)]")
          }
        >
          {live && <span className="h-2.5 w-2.5 rounded-full bg-[#e11d48] animate-pulse" />}
          {slide.badge}
        </span>
        <h1 className="text-[clamp(2rem,3.2vw,3.4rem)] font-semibold leading-[1.1] text-white line-clamp-2 pb-[0.1em]">{slide.title}</h1>
        {slide.description && (
          <p className="max-w-[40rem] text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug text-[color:var(--tv-text)]/85 line-clamp-3">
            {slide.description}
          </p>
        )}
        <div className="mt-[1vh] flex items-center gap-[2vw]">
          <button
            type="button"
            onClick={() => navigate(slide.to)}
            className="rounded-full bg-white px-[2.2vw] py-[1.5vh] text-[1.35rem] font-bold text-[color:var(--tv-bg)]"
          >
            {slide.primaryLabel}
          </button>
          {slides.length > 1 && (
            <div className="flex gap-[0.5vw]" aria-hidden="true">
              {slides.map((s, i) => (
                <span
                  key={s.id}
                  className={
                    i === index
                      ? "h-[0.55rem] w-[2.2rem] rounded-full bg-white transition-all"
                      : "h-[0.55rem] w-[0.55rem] rounded-full bg-white/35 transition-all"
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div
      ref={ref}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className="relative w-full overflow-hidden rounded-[1.4rem] min-h-[34vh] max-h-[46vh] aspect-[21/8] bg-[#0a1d3d]"
      aria-roledescription="carousel"
    >
      {slide.image && (
        <img
          key={slide.id}
          src={slide.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-50 animate-in fade-in duration-700"
        />
      )}
      <div
        className={
          slide.kind === "live"
            ? "absolute inset-0 bg-[radial-gradient(90%_120%_at_85%_10%,rgba(255,89,16,0.35),transparent_60%),linear-gradient(120deg,rgba(13,42,92,0.85)_0%,rgba(10,29,61,0.8)_60%,#07101f_100%)]"
            : "absolute inset-0 bg-[radial-gradient(90%_120%_at_15%_10%,rgba(255,89,16,0.3),transparent_60%),linear-gradient(120deg,rgba(42,22,8,0.8)_0%,rgba(10,29,61,0.85)_70%,#07101f_100%)]"
        }
      />

      <div className="absolute inset-0 flex flex-col justify-end items-start gap-[1.4vh] p-[3vw] pb-[4vh]">
        <span
          className={
            slide.kind === "live"
              ? "inline-flex items-center gap-2 rounded-full bg-[#e11d48] px-4 py-1 text-[1rem] font-bold uppercase tracking-wider text-white"
              : "inline-flex items-center rounded-full bg-[#17263f] px-4 py-1 text-[1rem] font-bold uppercase tracking-wider text-[#9fb0c9]"
          }
        >
          {slide.kind === "live" && <span className="h-2 w-2 rounded-full bg-white animate-pulse" />}
          {slide.badge}
        </span>
        <h1 className="max-w-[60rem] text-[2.8rem] font-bold leading-[1.05] text-white">{slide.title}</h1>
        {slide.description && (
          <p className="max-w-[44rem] text-[1.3rem] text-[#9fb0c9] line-clamp-2">{slide.description}</p>
        )}
        <div className="mt-[0.8vh] flex gap-[1vw]">
          <button
            type="button"
            onClick={() => navigate(slide.to)}
            className="rounded-full bg-white px-[2vw] py-[1.4vh] text-[1.35rem] font-bold text-[#07101f]"
          >
            {slide.primaryLabel}
          </button>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute right-[3vw] bottom-[3vh] flex gap-[0.6vw]" aria-hidden="true">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={i === index ? "h-3 w-3 rounded-full bg-white" : "h-3 w-3 rounded-full bg-white/30"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

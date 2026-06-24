// Facebook-style colored backgrounds for text-only stories.
export interface StoryBgStyle {
  id: string;
  label: string;
  className: string; // tailwind classes for background
  textClassName?: string; // optional text color override
}

export const STORY_BG_STYLES: StoryBgStyle[] = [
  { id: "gradient", label: "Mets Glow", className: "bg-gradient-to-br from-primary/40 via-background to-orange-500/30" },
  { id: "blue", label: "Mets Blue", className: "bg-gradient-to-br from-blue-600 to-blue-900", textClassName: "text-white" },
  { id: "orange", label: "Mets Orange", className: "bg-gradient-to-br from-orange-500 to-orange-700", textClassName: "text-white" },
  { id: "navy-orange", label: "Navy / Orange", className: "bg-gradient-to-br from-blue-900 via-blue-800 to-orange-600", textClassName: "text-white" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500", textClassName: "text-white" },
  { id: "purple", label: "Purple Night", className: "bg-gradient-to-br from-purple-700 via-indigo-800 to-black", textClassName: "text-white" },
  { id: "green", label: "Field Green", className: "bg-gradient-to-br from-emerald-600 to-green-900", textClassName: "text-white" },
  { id: "black", label: "Midnight", className: "bg-gradient-to-br from-zinc-900 to-black", textClassName: "text-white" },
  { id: "white", label: "Clean", className: "bg-gradient-to-br from-white to-zinc-100", textClassName: "text-zinc-900" },
];

export const getStoryBgStyle = (id?: string | null): StoryBgStyle =>
  STORY_BG_STYLES.find((s) => s.id === id) || STORY_BG_STYLES[0];

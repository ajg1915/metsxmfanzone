export function esc(v: unknown): string;
export function renderEmail(o: {
  preheader?: string;
  heading?: string;
  content: string;
  cta?: { label: string; url: string };
  note?: string;
  unsubscribe?: boolean;
}): string;

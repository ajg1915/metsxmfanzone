// Saves an audio file to the device. Fetching it as a blob makes the browser save it
// with a proper file name even when the file lives on another domain (R2/CDN).
// If the host blocks that (CORS), fall back to opening the file so it can still be saved.
const fileName = (url: string, title: string) => {
  const ext = (url.split("?")[0].match(/\.(mp3|m4a|wav|aac|ogg|flac)$/i)?.[1] ?? "mp3").toLowerCase();
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "episode";
  return `${base}.${ext}`;
};

export async function downloadAudio(url: string, title: string): Promise<void> {
  const name = fileName(url, title);
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

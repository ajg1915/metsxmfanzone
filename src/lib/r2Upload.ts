import { supabase } from "@/integrations/supabase/client";

export interface R2UploadResult {
  key: string;
  publicUrl: string;
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

/** Builds a stable object key like "hero/1699999999999_photo.jpg". */
export const buildR2Key = (folder: string, fileName: string) =>
  `${folder.replace(/^\/+|\/+$/g, "") || "general"}/${Date.now()}_${safeName(fileName)}`;

// Upload signing runs on the owner's own Cloudflare Worker (r2-sign-upload),
// so files never touch Supabase storage. The Worker only allows the
// Content-Type header, so no auth/apikey headers may be sent here.
const SIGN_URL = "https://r2-sign-upload.metsxmfan.workers.dev";

async function signR2(key: string, action: "upload" | "delete") {
  // Gate on a signed-in session for UX only — the Worker does the real signing.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error("Not signed in");

  const res = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, action }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.uploadUrl) {
    throw new Error(data?.error || "Could not prepare the upload");
  }
  if (!data.publicUrl || String(data.publicUrl).startsWith("undefined")) {
    throw new Error(
      "Upload signer is missing its public URL setting (R2_PUBLIC_BASE_URL) — files cannot be linked yet"
    );
  }
  return data as { uploadUrl: string; key: string; publicUrl: string };
}

/** Uploads a file straight to Cloudflare R2 and returns its public URL. */
export async function uploadToR2(
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (percent: number) => void,
): Promise<R2UploadResult> {
  const name = fileName || (file instanceof File ? file.name : "upload.bin");
  const key = buildR2Key(folder, name);
  const signed = await signR2(key, "upload");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(file);
  });

  onProgress?.(100);
  return { key: signed.key, publicUrl: signed.publicUrl };
}

/** Removes an object from R2. Silently ignores files that are not stored in R2. */
export async function deleteFromR2(key: string): Promise<void> {
  const signed = await signR2(key, "delete");
  await fetch(signed.uploadUrl, { method: "DELETE" });
}

/** True when a stored URL is served from R2 rather than the built-in storage. */
export function isR2Url(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.includes("/storage/v1/object/");
}

import { supabase } from "@/integrations/supabase/client";

export interface R2UploadResult {
  key: string;
  publicUrl: string;
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

/** Builds a stable object key like "hero/1699999999999_photo.jpg". */
export const buildR2Key = (folder: string, fileName: string) =>
  `${folder.replace(/^\/+|\/+$/g, "") || "general"}/${Date.now()}_${safeName(fileName)}`;

// The signing function runs on the Lovable backend (where the R2 keys are stored);
// the app itself signs users in on the owner project, so we call it directly with
// the current session token.
const SIGN_URL = "https://clwghkbtkofacsjeyrtk.supabase.co/functions/v1/r2-sign-upload";
const SIGN_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2doa2J0a29mYWNzamV5cnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTI3NDIsImV4cCI6MjA3NzkyODc0Mn0.11mr9r-U-BAwy9Mmr2yrzjLhjljswgOotJeOOXyfllc";

async function signR2(key: string, action: "upload" | "delete") {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(SIGN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SIGN_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, action }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.uploadUrl) {
    throw new Error(data?.error || "Could not prepare the upload");
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

import { backend } from "./backend.js";

const SIGN_URL = "https://r2-sign-upload.metsxmfan.workers.dev";

const safeName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export const buildR2Key = (folder, fileName) =>
  `${folder.replace(/^\/+|\/+$/g, "") || "general"}/${Date.now()}_${safeName(fileName)}`;

async function signR2(key, action) {
  const { data: { session } } = await backend.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, action }),
  });
  
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.uploadUrl) {
    throw new Error(data?.error || "Could not prepare the upload");
  }
  return data;
}

/** Uploads a file straight to Cloudflare R2 and returns its public URL. */
export async function uploadToR2(file, folder, fileName, onProgress) {
  const name = fileName || (file instanceof File ? file.name : "upload.bin");
  const key = buildR2Key(folder, name);
  const signed = await signR2(key, "upload");

  await new Promise((resolve, reject) => {
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

  if (onProgress) onProgress(100);
  return { key: signed.key, publicUrl: signed.publicUrl };
}

export async function deleteFromR2(key) {
  const signed = await signR2(key, "delete");
  await fetch(signed.uploadUrl, { method: "DELETE" });
}

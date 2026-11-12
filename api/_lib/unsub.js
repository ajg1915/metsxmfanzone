import { createHmac, timingSafeEqual } from "node:crypto";
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.RESEND_CONTACTS_KEY || "mxfz";
export const unsubToken = (email) => createHmac("sha256", secret()).update(String(email).toLowerCase()).digest("hex").slice(0, 32);
export function validToken(email, token) {
  const a = Buffer.from(unsubToken(email));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const unsubUrl = (email) =>
  `https://metsxmfanzone.com/api/join-fan-list?e=${encodeURIComponent(String(email).toLowerCase())}&t=${unsubToken(email)}`;

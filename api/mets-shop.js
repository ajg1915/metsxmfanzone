// Mets gear from Fanatics via the Impact catalog API. Credentials stay on the server:
// set IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN (and optionally IMPACT_FANATICS_LINK, IMPACT_CATALOG_ID) in Vercel.
const BASE = "https://api.impact.com/Mediapartners";
const FALLBACK_URL = "https://www.fanatics.com/mlb/new-york-mets/o-1306+t-47360259+z-9-1738925264";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  const sid = process.env.IMPACT_ACCOUNT_SID;
  const token = process.env.IMPACT_AUTH_TOKEN;
  const shopUrl = process.env.IMPACT_FANATICS_LINK || FALLBACK_URL;
  if (!sid || !token) return res.status(200).json({ configured: false, shopUrl, items: [] });

  const auth = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  const get = async (path) => {
    const r = await fetch(`${BASE}/${sid}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
    if (!r.ok) throw new Error(`Impact ${r.status}`);
    return r.json();
  };

  try {
    let catalogId = process.env.IMPACT_CATALOG_ID;
    if (!catalogId) {
      const cats = await get("/Catalogs");
      const list = cats.Catalogs || [];
      const hit = list.find((c) => /fanatics/i.test(`${c.Name || ""} ${c.CampaignName || ""}`)) || list[0];
      catalogId = hit?.Id;
    }
    if (!catalogId) return res.status(200).json({ configured: true, shopUrl, items: [], note: "No catalog found" });

    const q = encodeURIComponent("Text LIKE '%Mets%'");
    const data = await get(`/Catalogs/${catalogId}/Items?PageSize=60&Query=${q}`);
    const items = (data.Items || [])
      .filter((i) => /mets/i.test(`${i.Name || ""} ${i.Description || ""}`) && i.ImageUrl && i.Url)
      .slice(0, 48)
      .map((i) => ({
        id: i.Id,
        name: i.Name,
        image: i.ImageUrl,
        price: i.CurrentPrice ?? i.OriginalPrice ?? null,
        was: i.OriginalPrice && i.CurrentPrice && i.OriginalPrice > i.CurrentPrice ? i.OriginalPrice : null,
        url: i.Url,
        brand: i.Manufacturer || "",
      }));
    return res.status(200).json({ configured: true, shopUrl, items });
  } catch (e) {
    return res.status(200).json({ configured: true, shopUrl, items: [], error: String(e.message || e) });
  }
}

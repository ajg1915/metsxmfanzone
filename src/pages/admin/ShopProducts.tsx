import { useEffect, useState } from "react";
import { Eye, EyeOff, ImagePlus, Loader2, Package, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadToR2 } from "@/lib/r2Upload";
import { AdminPage, AdminPageHeader, AdminLoading, AdminEmpty } from "@/components/admin/AdminUI";
import { adminCreateProduct, adminShopProducts, adminUpdateProduct, shopMoney, type ShopProduct } from "@/lib/shopApi";

type Form = {
  id?: number;
  title: string;
  description: string;
  price: string;
  images: string[];
  sizes: { size: string; stock: string }[];
  condition: string;
  gift_wrap: boolean;
  weight_oz: string;
  published: boolean;
  sort: string;
};

const blank: Form = {
  title: "", description: "", price: "", images: [],
  sizes: [
    ...["S", "M", "L", "XL", "2XL"].map((x) => `Men ${x}`),
    ...["S", "M", "L", "XL", "2XL"].map((x) => `Women ${x}`),
    ...["XS", "S", "M", "L", "XL"].map((x) => `Kids ${x}`),
  ].map((size) => ({ size, stock: "" })),
  condition: "New with tags", gift_wrap: true, weight_oz: "6", published: true, sort: "0",
};

const toForm = (p: ShopProduct): Form => ({
  id: p.id, title: p.title, description: p.description, price: p.price.toFixed(2), images: p.images,
  sizes: p.sizes.map((s) => ({ size: s.size, stock: s.stock === null || s.stock === undefined ? "" : String(s.stock) })),
  condition: p.condition, gift_wrap: p.gift_wrap, weight_oz: String(p.weight_oz ?? 6), published: !!p.published, sort: String(p.sort ?? 0),
});

export default function ShopProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => adminShopProducts().then(setProducts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const upload = async (files: FileList | null) => {
    if (!files?.length || !form) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 8 - form.images.length)) {
        if (!f.type.startsWith("image/")) continue;
        urls.push((await uploadToR2(f, "shop")).publicUrl);
      }
      set("images", [...form.images, ...urls]);
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        title: form.title, description: form.description, price: Number(form.price), images: form.images,
        sizes: form.sizes.filter((s) => s.size.trim()).map((s) => ({ size: s.size.trim(), stock: s.stock.trim() === "" ? null : Number(s.stock) })),
        condition: form.condition, gift_wrap: form.gift_wrap, weight_oz: Number(form.weight_oz), published: form.published, sort: Number(form.sort) || 0,
      };
      if (form.id) await adminUpdateProduct(form.id, body); else await adminCreateProduct(body);
      toast({ title: form.id ? "Product saved" : "Product added" });
      setForm(null);
      load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const togglePublished = async (p: ShopProduct) => {
    try { await adminUpdateProduct(p.id, { published: !p.published }); load(); }
    catch (e) { toast({ title: "Couldn't change it", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };

  return (
    <AdminPage>
      <AdminPageHeader icon={Package} title="Shop Products" count={products?.length} countLabel="products"
        description="Mets T-shirts and gear sold on metsxmfanzone.com/shop"
        actions={<Button size="sm" onClick={() => setForm({ ...blank })}><Plus className="mr-1 h-4 w-4" />Add product</Button>} />
      {error && <AdminEmpty message={error} />}
      {!products && !error && <AdminLoading />}
      {products?.length === 0 && <AdminEmpty message="No products yet. Tap Add product." />}
      <div className="grid gap-2">
        {products?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-2">
            <img src={p.images[0]} alt="" className="h-16 w-12 flex-shrink-0 rounded-md bg-muted object-cover" />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setForm(toForm(p))}>
              <p className="truncate text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {shopMoney(p.price)} · {p.sizes.map((s) => `${s.size}: ${s.stock ?? "∞"}`).join(" · ")}
              </p>
              <p className={`text-[11px] font-bold ${p.sold_out ? "text-red-400" : p.published ? "text-green-500" : "text-muted-foreground"}`}>
                {p.sold_out ? "Sold out" : p.published ? "Live in the shop" : "Hidden"}
              </p>
            </button>
            <Button size="icon" variant="ghost" title={p.published ? "Hide from shop" : "Show in shop"} onClick={() => togglePublished(p)}>
              {p.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => { if (!o && !saving) setForm(null); }}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="New York Mets Skubal #29 Short Sleeve Tee" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Price ($)</Label><Input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="24.48" /></div>
                <div><Label>Condition</Label><Input value={form.condition} onChange={(e) => set("condition", e.target.value)} /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div>
                <Label>Photos (first one is the main photo)</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {form.images.map((u, i) => (
                    <div key={u + i} className="relative h-24 w-[72px]">
                      <img src={u} alt="" className="h-full w-full rounded-md object-cover" />
                      <button type="button" aria-label="Remove photo" onClick={() => set("images", form.images.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-black/80 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                      {i > 0 && <button type="button" onClick={() => set("images", [u, ...form.images.filter((_, j) => j !== i)])} className="absolute bottom-0 left-0 right-0 rounded-b-md bg-black/70 text-[10px] text-white">Make main</button>}
                    </div>
                  ))}
                  {form.images.length < 8 && (
                    <label className="flex h-24 w-[72px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}Add
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label>Sizes and how many you have (leave blank for unlimited)</Label>
                <div className="mt-1 space-y-1.5">
                  {form.sizes.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={s.size} onChange={(e) => set("sizes", form.sizes.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} placeholder="Size" />
                      <Input className="w-24" inputMode="numeric" value={s.stock} onChange={(e) => set("sizes", form.sizes.map((x, j) => (j === i ? { ...x, stock: e.target.value.replace(/\D/g, "") } : x)))} placeholder="∞" />
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove size" onClick={() => set("sizes", form.sizes.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => set("sizes", [...form.sizes, { size: "", stock: "1" }])}><Plus className="mr-1 h-3.5 w-3.5" />Add size</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Shipping weight (oz)</Label><Input inputMode="decimal" value={form.weight_oz} onChange={(e) => set("weight_oz", e.target.value)} /></div>
                <div><Label>Order in shop (low first)</Label><Input inputMode="numeric" value={form.sort} onChange={(e) => set("sort", e.target.value)} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Offer Christmas gift wrap</Label><Switch checked={form.gift_wrap} onCheckedChange={(v) => set("gift_wrap", v)} /></div>
              <div className="flex items-center justify-between"><Label>Show in the shop</Label><Switch checked={form.published} onCheckedChange={(v) => set("published", v)} /></div>
              <Button className="w-full" onClick={save} disabled={saving || uploading}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Save changes" : "Add product"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

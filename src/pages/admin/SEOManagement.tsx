import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Globe, FileText, CheckCircle, AlertCircle, RefreshCw, Plus, Pencil, Trash2, Eye, Tag, Shield, Copy } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminSearch, AdminStatGrid, AdminStat } from "@/components/admin/AdminUI";
import sharePages from "@/data/share-pages.json";
import { clearSeoOverrideCache } from "@/lib/seoOverrides";

const SITE_URL = "https://metsxmfanzone.com";
const isNoindex = (robots?: string | null) => (robots || "").toLowerCase().includes("noindex");

interface SEOSetting {
  id: string;
  page_name: string;
  page_path: string;
  title: string;
  description: string;
  keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_card: string | null;
  canonical_url: string | null;
  robots: string | null;
  include_in_sitemap: boolean;
  sitemap_priority: number;
  created_at: string;
  updated_at: string;
}

interface VerificationTag {
  id: string;
  name: string;
  attribute_type: string;
  attribute_value: string;
  content: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export default function SEOManagement() {
  const [seoSettings, setSeoSettings] = useState<SEOSetting[]>([]);
  const [verificationTags, setVerificationTags] = useState<VerificationTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [currentSetting, setCurrentSetting] = useState<Partial<SEOSetting> | null>(null);
  const [currentTag, setCurrentTag] = useState<Partial<VerificationTag> | null>(null);
  const [saving, setSaving] = useState(false);
  const [seoScore, setSeoScore] = useState({ score: 0, issues: 0, warnings: 0, passed: 0 });

  useEffect(() => {
    fetchSEOSettings();
    fetchVerificationTags();
  }, []);

  const fetchSEOSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seo_settings")
      .select("*")
      .order("page_name");

    if (error) {
      console.error("Error fetching SEO settings:", error);
      toast.error("Failed to load SEO settings");
    } else {
      setSeoSettings(data || []);
      calculateSEOScore(data || []);
    }
    setLoading(false);
  };

  const fetchVerificationTags = async () => {
    setTagsLoading(true);
    const { data, error } = await supabase
      .from("verification_meta_tags")
      .select("*")
      .order("display_order");

    if (error) {
      console.error("Error fetching verification tags:", error);
      toast.error("Failed to load verification tags");
    } else {
      setVerificationTags(data || []);
    }
    setTagsLoading(false);
  };

  const calculateSEOScore = (settings: SEOSetting[]) => {
    let passed = 0;
    let warnings = 0;
    let issues = 0;

    settings.forEach((setting) => {
      if (setting.title.length >= 50 && setting.title.length <= 60) passed++;
      else if (setting.title.length > 0) warnings++;
      else issues++;

      if (setting.description.length >= 150 && setting.description.length <= 160) passed++;
      else if (setting.description.length > 0) warnings++;
      else issues++;

      if (setting.keywords && setting.keywords.length > 10) passed++;
      else warnings++;

      if (setting.og_image) passed++;
      else warnings++;
    });

    const total = passed + warnings + issues;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    setSeoScore({ score, issues, warnings, passed });
  };

  const handleSave = async () => {
    if (!currentSetting?.page_name || !currentSetting?.page_path || !currentSetting?.title || !currentSetting?.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    const isNew = !currentSetting.id;

    if (isNew) {
      const { error } = await supabase.from("seo_settings").insert({
        page_name: currentSetting.page_name,
        page_path: currentSetting.page_path,
        title: currentSetting.title,
        description: currentSetting.description,
        keywords: currentSetting.keywords || null,
        og_title: currentSetting.og_title || null,
        og_description: currentSetting.og_description || null,
        og_image: currentSetting.og_image || null,
        twitter_card: currentSetting.twitter_card || "summary_large_image",
        canonical_url: currentSetting.canonical_url || null,
        robots: currentSetting.robots || "index, follow",
        include_in_sitemap: currentSetting.include_in_sitemap ?? true,
        sitemap_priority: currentSetting.sitemap_priority ?? 0.7,
      });

      if (error) {
        console.error("Error creating SEO setting:", error);
        toast.error("Failed to create SEO setting");
      } else {
        toast.success("SEO setting created successfully");
        clearSeoOverrideCache();
        setEditDialogOpen(false);
        fetchSEOSettings();
      }
    } else {
      const { error } = await supabase
        .from("seo_settings")
        .update({
          page_name: currentSetting.page_name,
          page_path: currentSetting.page_path,
          title: currentSetting.title,
          description: currentSetting.description,
          keywords: currentSetting.keywords || null,
          og_title: currentSetting.og_title || null,
          og_description: currentSetting.og_description || null,
          og_image: currentSetting.og_image || null,
          twitter_card: currentSetting.twitter_card || "summary_large_image",
          canonical_url: currentSetting.canonical_url || null,
          robots: currentSetting.robots || "index, follow",
          include_in_sitemap: currentSetting.include_in_sitemap ?? true,
          sitemap_priority: currentSetting.sitemap_priority ?? 0.7,
        })
        .eq("id", currentSetting.id);

      if (error) {
        console.error("Error updating SEO setting:", error);
        toast.error("Failed to update SEO setting");
      } else {
        toast.success("SEO setting updated successfully");
        clearSeoOverrideCache();
        setEditDialogOpen(false);
        fetchSEOSettings();
      }
    }
    setSaving(false);
  };

  const handleSaveTag = async () => {
    if (!currentTag?.name || !currentTag?.attribute_value || !currentTag?.content) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    const isNew = !currentTag.id;

    if (isNew) {
      const { error } = await supabase.from("verification_meta_tags").insert({
        name: currentTag.name,
        attribute_type: currentTag.attribute_type || "name",
        attribute_value: currentTag.attribute_value,
        content: currentTag.content,
        description: currentTag.description || null,
        is_active: currentTag.is_active !== false,
        display_order: currentTag.display_order || verificationTags.length + 1,
      });

      if (error) {
        console.error("Error creating verification tag:", error);
        toast.error("Failed to create verification tag");
      } else {
        toast.success("Verification tag created successfully");
        setTagDialogOpen(false);
        fetchVerificationTags();
      }
    } else {
      const { error } = await supabase
        .from("verification_meta_tags")
        .update({
          name: currentTag.name,
          attribute_type: currentTag.attribute_type || "name",
          attribute_value: currentTag.attribute_value,
          content: currentTag.content,
          description: currentTag.description || null,
          is_active: currentTag.is_active !== false,
          display_order: currentTag.display_order || 0,
        })
        .eq("id", currentTag.id);

      if (error) {
        console.error("Error updating verification tag:", error);
        toast.error("Failed to update verification tag");
      } else {
        toast.success("Verification tag updated successfully");
        setTagDialogOpen(false);
        fetchVerificationTags();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SEO setting?")) return;

    const { error } = await supabase.from("seo_settings").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete SEO setting");
    } else {
      toast.success("SEO setting deleted");
      clearSeoOverrideCache();
      fetchSEOSettings();
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Are you sure you want to delete this verification tag?")) return;

    const { error } = await supabase.from("verification_meta_tags").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete verification tag");
    } else {
      toast.success("Verification tag deleted");
      fetchVerificationTags();
    }
  };

  const toggleTagActive = async (tag: VerificationTag) => {
    const { error } = await supabase
      .from("verification_meta_tags")
      .update({ is_active: !tag.is_active })
      .eq("id", tag.id);

    if (error) {
      toast.error("Failed to update tag status");
    } else {
      toast.success(`Tag ${!tag.is_active ? "activated" : "deactivated"}`);
      fetchVerificationTags();
    }
  };

  const copyMetaTag = (tag: VerificationTag) => {
    const metaTag = `<meta name="${tag.attribute_value}" content="${tag.content}" />`;
    navigator.clipboard.writeText(metaTag);
    toast.success("Meta tag copied to clipboard");
  };

  // Adds any public page the site knows about that isn't in SEO Settings yet.
  const [finding, setFinding] = useState(false);
  const findNewPages = async () => {
    setFinding(true);
    const have = new Set(seoSettings.map((s) => s.page_path.toLowerCase()));
    const missing = sharePages.filter((p) => !have.has(p.path.toLowerCase()));
    if (missing.length === 0) {
      toast.success("All pages are already listed");
      setFinding(false);
      return;
    }
    const { error } = await supabase.from("seo_settings").insert(
      missing.map((p) => ({
        page_name: p.label,
        page_path: p.path,
        title: p.title,
        description: p.description,
        og_image: p.image || null,
        canonical_url: `${SITE_URL}${p.path === "/" ? "/" : p.path}`,
        robots: "index, follow",
        twitter_card: "summary_large_image",
        include_in_sitemap: false,
        sitemap_priority: 0.7,
      })),
    );
    if (error) {
      toast.error("Couldn't add pages: " + error.message);
    } else {
      toast.success(`Added ${missing.length} new page${missing.length === 1 ? "" : "s"} — review and turn on "Include in sitemap"`);
      clearSeoOverrideCache();
      fetchSEOSettings();
    }
    setFinding(false);
  };

  const quickToggle = async (setting: SEOSetting, patch: Partial<SEOSetting>) => {
    setSeoSettings((list) => list.map((s) => (s.id === setting.id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("seo_settings").update(patch).eq("id", setting.id);
    if (error) {
      toast.error("Couldn't save: " + error.message);
      fetchSEOSettings();
    } else {
      clearSeoOverrideCache();
    }
  };

  const openEditDialog = (setting?: SEOSetting) => {
    setCurrentSetting(setting || { robots: "index, follow", twitter_card: "summary_large_image", include_in_sitemap: true, sitemap_priority: 0.7 });
    setEditDialogOpen(true);
  };

  const openTagDialog = (tag?: Partial<VerificationTag>) => {
    setCurrentTag(tag || { attribute_type: "name", is_active: true });
    setTagDialogOpen(true);
  };

  const filteredSettings = seoSettings.filter(
    (s) =>
      s.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.page_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Globe}
        title="SEO Management"
        description="Manage page titles, descriptions, meta tags & verification"
      />

      {/* SEO Score Overview */}
      <AdminStatGrid>
        <AdminStat label="SEO Score" value={`${seoScore.score}%`} tone={seoScore.score >= 80 ? "success" : seoScore.score >= 60 ? "warning" : "danger"} />
        <AdminStat icon={CheckCircle} label="Passed" value={seoScore.passed} tone="success" />
        <AdminStat icon={AlertCircle} label="Warnings" value={seoScore.warnings} tone="warning" />
        <AdminStat icon={Shield} label="Verification Tags" value={verificationTags.filter(t => t.is_active).length} />
      </AdminStatGrid>

      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="pages" className="text-xs px-3 h-7">Pages</TabsTrigger>
          <TabsTrigger value="verification" className="text-xs px-3 h-7">Verification Tags</TabsTrigger>
          <TabsTrigger value="tools" className="text-xs px-3 h-7">SEO Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-3 space-y-3">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search pages..." />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSEOSettings} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={findNewPages} disabled={finding} className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                {finding ? "Checking..." : "Find new pages"}
              </Button>
              <Button size="sm" onClick={() => openEditDialog()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Page
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {seoSettings.length} pages · {seoSettings.filter((s) => !isNoindex(s.robots)).length} open to Google ·{" "}
            {seoSettings.filter((s) => s.include_in_sitemap && !isNoindex(s.robots)).length} in sitemap. Blog posts are managed in the blog editor.
          </p>

          {/* SEO Settings Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Page</TableHead>
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Description</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-center">Google</TableHead>
                      <TableHead className="text-xs text-center">Sitemap</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredSettings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No SEO settings found. Add your first page SEO settings.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSettings.map((setting) => (
                        <TableRow key={setting.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium">{setting.page_name}</div>
                            <div className="text-muted-foreground">{setting.page_path}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {setting.title}
                          </TableCell>
                          <TableCell className="text-xs max-w-[250px] truncate hidden md:table-cell">
                            {setting.description}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={setting.title.length >= 50 && setting.description.length >= 150 ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {setting.title.length >= 50 && setting.description.length >= 150 ? "Optimized" : "Needs Work"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Switch
                                checked={!isNoindex(setting.robots)}
                                onCheckedChange={(v) => quickToggle(setting, { robots: v ? "index, follow" : "noindex, nofollow" })}
                                aria-label="Allow Google to index"
                              />
                              <span className={`text-[9px] ${isNoindex(setting.robots) ? "text-red-400" : "text-green-500"}`}>
                                {isNoindex(setting.robots) ? "Hidden" : "Indexed"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Switch
                                checked={setting.include_in_sitemap}
                                disabled={isNoindex(setting.robots)}
                                onCheckedChange={(v) => quickToggle(setting, { include_in_sitemap: v })}
                                aria-label="Include in sitemap"
                              />
                              <span className="text-[9px] text-muted-foreground">
                                {setting.include_in_sitemap && !isNoindex(setting.robots) ? "Listed" : "Not listed"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => window.open(setting.page_path, "_blank")}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openEditDialog(setting)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => handleDelete(setting.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tags Tab */}
        <TabsContent value="verification" className="mt-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Manage site verification meta tags for Google, Facebook, Bing, and other services.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchVerificationTags} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => openTagDialog()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Tag
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Meta Attribute</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Content</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : verificationTags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No verification tags found. Add your first verification tag.
                        </TableCell>
                      </TableRow>
                    ) : (
                      verificationTags.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-primary" />
                              <div>
                                <div className="font-medium">{tag.name}</div>
                                {tag.description && (
                                  <div className="text-muted-foreground text-[10px]">{tag.description}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                              {tag.attribute_type}="{tag.attribute_value}"
                            </code>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">
                            <code className="text-[10px]">{tag.content}</code>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={tag.is_active}
                              onCheckedChange={() => toggleTagActive(tag)}
                              className="scale-75"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => copyMetaTag(tag)}
                                title="Copy meta tag"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openTagDialog(tag)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => handleDeleteTag(tag.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reference Card */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Common Verification Tags
              </CardTitle>
              <CardDescription className="text-xs">
                Click to quickly add common verification tag templates
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: "Google Search Console", attr: "google-site-verification", desc: "Verify site ownership in Google Search Console" },
                  { name: "Bing Webmaster", attr: "msvalidate.01", desc: "Verify site ownership in Bing Webmaster Tools" },
                  { name: "Facebook Domain", attr: "facebook-domain-verification", desc: "Verify domain for Facebook Business" },
                  { name: "Pinterest", attr: "p:domain_verify", desc: "Verify site for Pinterest Rich Pins" },
                  { name: "Yandex", attr: "yandex-verification", desc: "Verify site in Yandex Webmaster" },
                  { name: "Norton Safe Web", attr: "norton-safeweb-site-verification", desc: "Verify site for Norton Safe Web" },
                ].map((template) => (
                  <Button
                    key={template.attr}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-3 flex flex-col items-start text-left"
                    onClick={() => openTagDialog({
                      name: template.name,
                      attribute_type: "name",
                      attribute_value: template.attr,
                      description: template.desc,
                      is_active: true,
                      content: "",
                    })}
                  >
                    <span className="text-xs font-medium">{template.name}</span>
                    <span className="text-[10px] text-muted-foreground">{template.attr}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://search.google.com/search-console", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Google Search Console</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">Monitor your search performance and indexing status</CardDescription>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://developers.facebook.com/tools/debug/", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Facebook Debugger</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">Debug Open Graph tags for Facebook sharing</CardDescription>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://cards-dev.twitter.com/validator", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Twitter Card Validator</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">Preview how your content appears on Twitter</CardDescription>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://www.linkedin.com/post-inspector/", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">LinkedIn Post Inspector</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">Preview LinkedIn sharing appearance</CardDescription>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://www.metsxmfanzone.com/sitemap.xml", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">View Sitemap</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">View your XML sitemap for search engines</CardDescription>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => window.open("https://www.metsxmfanzone.com/robots.txt", "_blank")}>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">View Robots.txt</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <CardDescription className="text-xs">View crawler directives for search engines</CardDescription>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit SEO Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{currentSetting?.id ? "Edit" : "Add"} Page SEO</DialogTitle>
            <DialogDescription className="text-xs">
              Configure SEO settings for this page
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Page Name *</Label>
                <Input
                  placeholder="Home"
                  value={currentSetting?.page_name || ""}
                  onChange={(e) => setCurrentSetting({ ...currentSetting, page_name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Page Path *</Label>
                <Input
                  placeholder="/"
                  value={currentSetting?.page_path || ""}
                  onChange={(e) => setCurrentSetting({ ...currentSetting, page_path: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Title * <span className="text-muted-foreground">({currentSetting?.title?.length || 0}/60 chars)</span>
              </Label>
              <Input
                placeholder="Page Title | MetsXMFanZone"
                value={currentSetting?.title || ""}
                onChange={(e) => setCurrentSetting({ ...currentSetting, title: e.target.value })}
                className="h-8 text-xs"
                maxLength={70}
              />
              <p className="text-[10px] text-muted-foreground">Ideal: 50-60 characters</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Description * <span className="text-muted-foreground">({currentSetting?.description?.length || 0}/160 chars)</span>
              </Label>
              <Textarea
                placeholder="A compelling description of this page..."
                value={currentSetting?.description || ""}
                onChange={(e) => setCurrentSetting({ ...currentSetting, description: e.target.value })}
                className="text-xs min-h-[60px]"
                maxLength={170}
              />
              <p className="text-[10px] text-muted-foreground">Ideal: 150-160 characters</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Keywords</Label>
              <Input
                placeholder="mets, baseball, live games, fan community"
                value={currentSetting?.keywords || ""}
                onChange={(e) => setCurrentSetting({ ...currentSetting, keywords: e.target.value })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Comma-separated keywords</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">OG Image URL</Label>
              <Input
                placeholder="https://www.metsxmfanzone.com/og-image.png"
                value={currentSetting?.og_image || ""}
                onChange={(e) => setCurrentSetting({ ...currentSetting, og_image: e.target.value })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Recommended: 1200x630 pixels</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Canonical URL</Label>
                <Input
                  placeholder="https://www.metsxmfanzone.com/"
                  value={currentSetting?.canonical_url || ""}
                  onChange={(e) => setCurrentSetting({ ...currentSetting, canonical_url: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Robots</Label>
                <Input
                  placeholder="index, follow"
                  value={currentSetting?.robots || ""}
                  onChange={(e) => setCurrentSetting({ ...currentSetting, robots: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-semibold">Allow Google to index this page</Label>
                  <p className="text-[10px] text-muted-foreground">Off = page is hidden from search results (noindex).</p>
                </div>
                <Switch
                  checked={!isNoindex(currentSetting?.robots)}
                  onCheckedChange={(v) => setCurrentSetting({ ...currentSetting, robots: v ? "index, follow" : "noindex, nofollow" })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-semibold">Include in sitemap</Label>
                  <p className="text-[10px] text-muted-foreground">Lists the page in /sitemap.xml so Google finds it faster.</p>
                </div>
                <Switch
                  checked={currentSetting?.include_in_sitemap ?? true}
                  disabled={isNoindex(currentSetting?.robots)}
                  onCheckedChange={(v) => setCurrentSetting({ ...currentSetting, include_in_sitemap: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-semibold">Sitemap priority</Label>
                  <p className="text-[10px] text-muted-foreground">How important this page is compared to your others.</p>
                </div>
                <Select
                  value={String(Number(currentSetting?.sitemap_priority ?? 0.7))}
                  onValueChange={(v) => setCurrentSetting({ ...currentSetting, sitemap_priority: Number(v) })}
                >
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "0.9", "0.8", "0.7", "0.6", "0.5", "0.3"].map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">{v === "1" ? "1.0 (top)" : v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save SEO Settings"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verification Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{currentTag?.id ? "Edit" : "Add"} Verification Tag</DialogTitle>
            <DialogDescription className="text-xs">
              Add a meta tag for site verification or analytics
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tag Name *</Label>
              <Input
                placeholder="Google Site Verification"
                value={currentTag?.name || ""}
                onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Attribute Type</Label>
                <Select
                  value={currentTag?.attribute_type || "name"}
                  onValueChange={(value) => setCurrentTag({ ...currentTag, attribute_type: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">name</SelectItem>
                    <SelectItem value="property">property</SelectItem>
                    <SelectItem value="http-equiv">http-equiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Attribute Value *</Label>
                <Input
                  placeholder="google-site-verification"
                  value={currentTag?.attribute_value || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, attribute_value: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Content Value *</Label>
              <Input
                placeholder="your-verification-code-here"
                value={currentTag?.content || ""}
                onChange={(e) => setCurrentTag({ ...currentTag, content: e.target.value })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">The verification code provided by the service</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                placeholder="What this verification is for..."
                value={currentTag?.description || ""}
                onChange={(e) => setCurrentTag({ ...currentTag, description: e.target.value })}
                className="text-xs min-h-[50px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={currentTag?.is_active !== false}
                  onCheckedChange={(checked) => setCurrentTag({ ...currentTag, is_active: checked })}
                />
                <Label className="text-xs">Active</Label>
              </div>
            </div>

            {/* Preview */}
            {currentTag?.attribute_value && currentTag?.content && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preview</Label>
                <code className="block bg-muted p-2 rounded text-[10px] break-all">
                  {`<meta ${currentTag.attribute_type || "name"}="${currentTag.attribute_value}" content="${currentTag.content}" />`}
                </code>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveTag} disabled={saving}>
                {saving ? "Saving..." : "Save Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

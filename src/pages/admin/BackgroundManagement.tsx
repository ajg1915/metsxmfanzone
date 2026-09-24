import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Check, Image, Palette, Sparkles, Upload, Loader2 } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";
import { uploadToR2 } from "@/lib/r2Upload";

interface BackgroundSetting {
  id: string;
  page_type: string;
  background_type: string;
  background_value: string;
  is_active: boolean;
  name: string;
  created_at: string;
  updated_at: string;
}

const BackgroundManagement = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newBackground, setNewBackground] = useState({
    page_type: "auth",
    background_type: "color",
    background_value: "#002D72",
    name: "",
  });

  const { data: backgrounds, isLoading } = useQuery({
    queryKey: ["background-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("background_settings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BackgroundSetting[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (background: typeof newBackground) => {
      const { error } = await supabase.from("background_settings").insert(background);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["background-settings"] });
      queryClient.invalidateQueries({ queryKey: ["active-background"] });
      toast.success("Background created successfully");
      setNewBackground({
        page_type: "auth",
        background_type: "color",
        background_value: "#002D72",
        name: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create background: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("background_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["background-settings"] });
      queryClient.invalidateQueries({ queryKey: ["active-background"] });
      toast.success("Background deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, pageType }: { id: string; pageType: string }) => {
      // First, deactivate all backgrounds for this page type
      const { error: deactivateError } = await supabase
        .from("background_settings")
        .update({ is_active: false })
        .eq("page_type", pageType);
      if (deactivateError) throw deactivateError;

      // Then activate the selected one
      const { error: activateError } = await supabase
        .from("background_settings")
        .update({ is_active: true })
        .eq("id", id);
      if (activateError) throw activateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["background-settings"] });
      queryClient.invalidateQueries({ queryKey: ["active-background"] });
      toast.success("Background activated");
    },
    onError: (error) => {
      toast.error("Failed to activate: " + error.message);
    },
  });

  const getBackgroundPreview = (type: string, value: string) => {
    if (type === "image") {
      const v = value.trim();
      const backgroundImage = v.startsWith("url(") ? v : `url(${v})`;
      return {
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    if (type === "gradient") {
      return { background: value };
    }
    return { backgroundColor: value };
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="h-4 w-4" />;
      case "gradient":
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Palette className="h-4 w-4" />;
    }
  };

  const uploadBackground = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadToR2(file, "auth-backgrounds");
      setNewBackground((current) => ({ ...current, background_type: "image", background_value: result.publicUrl }));
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const authBackgrounds = backgrounds?.filter((b) => b.page_type === "auth") || [];
  const loginBackgrounds = backgrounds?.filter((b) => b.page_type === "auth_login") || [];
  const signupBackgrounds = backgrounds?.filter((b) => b.page_type === "auth_signup") || [];
  const welcomeBackgrounds = backgrounds?.filter((b) => b.page_type === "welcome") || [];
  const renderBackgroundGrid = (items: BackgroundSetting[], emptyText: string) => isLoading ? (
    <p className="text-muted-foreground">Loading...</p>
  ) : items.length === 0 ? (
    <p className="text-muted-foreground">{emptyText}</p>
  ) : (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((bg) => (
        <div key={bg.id} className={`relative overflow-hidden rounded-lg border-2 ${bg.is_active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
          <div className="h-32" style={getBackgroundPreview(bg.background_type, bg.background_value)} />
          <div className="bg-background/95 p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">{getTypeIcon(bg.background_type)}<span className="truncate text-sm font-medium">{bg.name}</span></div>
              {bg.is_active && <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Active</span>}
            </div>
            <div className="mt-3 flex gap-2">
              {!bg.is_active && <Button size="sm" variant="outline" onClick={() => activateMutation.mutate({ id: bg.id, pageType: bg.page_type })} className="flex-1"><Check className="mr-1 h-3 w-3" />Activate</Button>}
              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(bg.id)} aria-label={`Delete ${bg.name}`}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Image}
        title="Background Management"
        description="Manage backgrounds for login and welcome screens"
      />

        {/* Create New Background */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Background
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Background name"
                  value={newBackground.name}
                  onChange={(e) => setNewBackground({ ...newBackground, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Page Type</Label>
                <Select
                  value={newBackground.page_type}
                  onValueChange={(value) => setNewBackground({ ...newBackground, page_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="auth_login">Login Blue Area</SelectItem>
                     <SelectItem value="auth_signup">Signup Blue Area</SelectItem>
                     <SelectItem value="auth">Both Login & Signup</SelectItem>
                    <SelectItem value="welcome">Welcome Screen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newBackground.background_type}
                  onValueChange={(value) => setNewBackground({ ...newBackground, background_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">Solid Color</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="image">Image URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {newBackground.background_type === "color"
                    ? "Color (Hex)"
                    : newBackground.background_type === "gradient"
                    ? "CSS Gradient"
                    : "Image URL"}
                </Label>
                {newBackground.background_type === "color" ? (
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={newBackground.background_value}
                      onChange={(e) => setNewBackground({ ...newBackground, background_value: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={newBackground.background_value}
                      onChange={(e) => setNewBackground({ ...newBackground, background_value: e.target.value })}
                      placeholder="#002D72"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input value={newBackground.background_value} onChange={(e) => setNewBackground({ ...newBackground, background_value: e.target.value })} placeholder={newBackground.background_type === "gradient" ? "linear-gradient(135deg, #002D72, #FF5910)" : "Image URL or upload"} />
                    {newBackground.background_type === "image" && <><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBackground(file); }} /><Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Upload background image">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</Button></>}
                  </div>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => createMutation.mutate(newBackground)}
                  disabled={!newBackground.name || !newBackground.background_value}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {/* Preview */}
            {newBackground.background_value && (
              <div className="mt-4">
                <Label>Preview</Label>
                <div
                  className="h-24 rounded-lg border border-border mt-2"
                  style={getBackgroundPreview(newBackground.background_type, newBackground.background_value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Login Blue Area</CardTitle></CardHeader>
          <CardContent>{renderBackgroundGrid(loginBackgrounds, "No login image configured")}</CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Signup Blue Area</CardTitle></CardHeader>
          <CardContent>{renderBackgroundGrid(signupBackgrounds, "No signup image configured")}</CardContent>
        </Card>

        {/* Auth/Login Backgrounds */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Login/Auth Screen Backgrounds</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : authBackgrounds.length === 0 ? (
              <p className="text-muted-foreground">No backgrounds configured</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {authBackgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    className={`relative rounded-lg border-2 overflow-hidden ${
                      bg.is_active ? "border-primary ring-2 ring-primary/20" : "border-border"
                    }`}
                  >
                    <div
                      className="h-32"
                      style={getBackgroundPreview(bg.background_type, bg.background_value)}
                    />
                    <div className="p-3 bg-background/95 backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(bg.background_type)}
                          <span className="font-medium text-sm">{bg.name}</span>
                        </div>
                        {bg.is_active && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        {!bg.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateMutation.mutate({ id: bg.id, pageType: bg.page_type })}
                            className="flex-1"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(bg.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Welcome Screen Backgrounds */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Welcome Screen Backgrounds</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : welcomeBackgrounds.length === 0 ? (
              <p className="text-muted-foreground">No backgrounds configured for welcome screen</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {welcomeBackgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    className={`relative rounded-lg border-2 overflow-hidden ${
                      bg.is_active ? "border-primary ring-2 ring-primary/20" : "border-border"
                    }`}
                  >
                    <div
                      className="h-32"
                      style={getBackgroundPreview(bg.background_type, bg.background_value)}
                    />
                    <div className="p-3 bg-background/95 backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(bg.background_type)}
                          <span className="font-medium text-sm">{bg.name}</span>
                        </div>
                        {bg.is_active && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        {!bg.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateMutation.mutate({ id: bg.id, pageType: bg.page_type })}
                            className="flex-1"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(bg.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </AdminPage>
  );
};

export default BackgroundManagement;

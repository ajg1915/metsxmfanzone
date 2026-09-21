import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Edit, Upload, Sparkles, Film, Download, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import VideoFramePicker from "@/components/admin/VideoFramePicker";

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  thumbnail_gif_url?: string;
  video_type: string;
  category: string;
  duration: number;
  published: boolean;
  published_at: string;
  created_at: string;
}

export default function VideoGalleryManagement() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [selectedFrameBlob, setSelectedFrameBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [_generatingGif] = useState(false);
  const [fetchingMLBHighlights, setFetchingMLBHighlights] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'youtube' | 'link'>('file');
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    video_url: "",
    thumbnail_url: "",
    thumbnail_gif_url: "",
    video_type: "highlight",
    category: "General",
    duration: 0,
    published: false,
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching videos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateThumbnailFromVideo = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        }
      };
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  };


  const fetchMLBHighlights = async () => {
    setFetchingMLBHighlights(true);
    try {
      const response = await supabase.functions.invoke("fetch-mets-highlights");
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch MLB highlights");
      }

      const data = response.data;
      const newHighlights = data?.highlights?.filter((h: any) => h.status === 'new')?.length || 0;
      
      toast({
        title: "MLB Highlights Synced",
        description: newHighlights > 0 
          ? `Added ${newHighlights} new Mets highlights from recent games!`
          : "All highlights are up to date.",
      });
      
      fetchVideos();
    } catch (error: any) {
      toast({
        title: "Error fetching MLB highlights",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFetchingMLBHighlights(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let videoUrl = formData.video_url;
      let thumbnailUrl = formData.thumbnail_url;
      let thumbnailGifUrl = formData.thumbnail_gif_url;
      let duration = formData.duration;

      // Handle file upload method
      if (uploadMethod === 'file' && videoFile) {
        const { publicUrl } = await uploadToR2(videoFile, 'videos', videoFile.name, setUploadProgress);
        videoUrl = publicUrl;

        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.onloadedmetadata = () => {
          duration = Math.round(videoElement.duration);
        };
        videoElement.src = URL.createObjectURL(videoFile);

          if (thumbnailFile) {
            const thumbExt = thumbnailFile.name.split('.').pop();
            const thumbName = `thumb_${Math.random()}.${thumbExt}`;
            const { error: thumbError } = await supabase.storage
              .from('videos')
              .upload(thumbName, thumbnailFile);

            if (thumbError) throw thumbError;

            const { data: { publicUrl: thumbUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(thumbName);

            thumbnailUrl = thumbUrl;
          } else if (selectedFrameBlob) {
            // Use the frame picked by the admin
            const thumbName = `thumb_${Math.random()}.jpg`;
            const { error: thumbError } = await supabase.storage
              .from('videos')
              .upload(thumbName, selectedFrameBlob);

            if (thumbError) throw thumbError;

            const { data: { publicUrl: thumbUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(thumbName);

            thumbnailUrl = thumbUrl;
          } else {
            setGeneratingThumbnail(true);
            try {
              const thumbDataUrl = await generateThumbnailFromVideo(videoFile);
              const thumbBlob = await fetch(thumbDataUrl).then(r => r.blob());
              const thumbName = `thumb_${Math.random()}.jpg`;
              
              const { error: thumbError } = await supabase.storage
                .from('videos')
                .upload(thumbName, thumbBlob);

              if (thumbError) throw thumbError;

              const { data: { publicUrl: thumbUrl } } = supabase.storage
                .from('videos')
                .getPublicUrl(thumbName);

              thumbnailUrl = thumbUrl;
            } catch (error) {
              console.error('Error generating thumbnail:', error);
            } finally {
              setGeneratingThumbnail(false);
            }
          }
        }


      if (editingVideo) {
        const { error } = await supabase
          .from("videos")
          .update({
            ...formData,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            thumbnail_gif_url: null,
            duration: duration,
            published_at: formData.published ? new Date().toISOString() : null,
          })
          .eq("id", editingVideo.id);

        if (error) throw error;

        toast({
          title: "Video updated",
          description: "Video has been updated successfully",
        });
      } else {
        const { error } = await supabase.from("videos").insert({
          ...formData,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          thumbnail_gif_url: null,
          duration: duration,
          published_at: formData.published ? new Date().toISOString() : null,
        });

        if (error) throw error;

        toast({
          title: "Video created",
          description: "Video has been created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Video deleted",
        description: "Video has been deleted successfully",
      });

      fetchVideos();
    } catch (error: any) {
      toast({
        title: "Error deleting video",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url,
      thumbnail_gif_url: video.thumbnail_gif_url || "",
      video_type: video.video_type,
      category: video.category,
      duration: video.duration,
      published: video.published,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      video_url: "",
      thumbnail_url: "",
      thumbnail_gif_url: "",
      video_type: "highlight",
      category: "General",
      duration: 0,
      published: false,
    });
    setEditingVideo(null);
    setVideoFile(null);
    setThumbnailFile(null);
    setSelectedFrameBlob(null);
    setUploadMethod('file');
    setUploadProgress(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading videos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full px-2 py-3 space-y-4 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-lg sm:text-xl font-bold">Video Gallery</h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={fetchMLBHighlights}
            disabled={fetchingMLBHighlights}
          >
            {fetchingMLBHighlights ? (
              <>
                <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Download className="mr-1 h-3.5 w-3.5" />
                Fetch MLB Highlights
              </>
            )}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm" className="h-8 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVideo ? "Edit Video" : "Add New Video"}
              </DialogTitle>
              <DialogDescription>
                {uploadMethod === 'file' && "Upload a video file with high-speed quality"}
                {uploadMethod === 'youtube' && "Add a YouTube video link"}
                {uploadMethod === 'link' && "Add a video link from any source"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Upload Method</Label>
                <Select
                  value={uploadMethod}
                  onValueChange={(value: 'file' | 'youtube' | 'link') => setUploadMethod(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">High-Speed File Upload</SelectItem>
                    <SelectItem value="youtube">YouTube Link</SelectItem>
                    <SelectItem value="link">Other Video Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uploadMethod === 'file' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="video-file">Video File</Label>
                    <Input
                      id="video-file"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setVideoFile(file);
                        setSelectedFrameBlob(null);
                      }}
                      required={!editingVideo}
                    />
                  </div>

                  {videoFile && (
                    <VideoFramePicker
                      videoFile={videoFile}
                      onFrameSelect={(blob) => {
                        setSelectedFrameBlob(blob);
                        setThumbnailFile(null);
                      }}
                    />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail-file">Or upload custom thumbnail</Label>
                    <Input
                      id="thumbnail-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setThumbnailFile(e.target.files?.[0] || null);
                        if (e.target.files?.[0]) setSelectedFrameBlob(null);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pick a frame above, upload a custom image, or one will be auto-generated
                    </p>
                  </div>
                </>
              )}

              {(uploadMethod === 'youtube' || uploadMethod === 'link') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="video-url">Video URL</Label>
                    <Input
                      id="video-url"
                      value={formData.video_url}
                      onChange={(e) =>
                        setFormData({ ...formData, video_url: e.target.value })
                      }
                      placeholder={uploadMethod === 'youtube' ? "https://youtube.com/watch?v=..." : "https://..."}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
                    <Input
                      id="thumbnail-url"
                      value={formData.thumbnail_url}
                      onChange={(e) =>
                        setFormData({ ...formData, thumbnail_url: e.target.value })
                      }
                      placeholder="https://..."
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="video-type">Type</Label>
                  <Select
                    value={formData.video_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, video_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highlight">Highlight</SelectItem>
                      <SelectItem value="replay">Replay</SelectItem>
                      <SelectItem value="live_stream">Live Stream</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, published: checked })
                  }
                />
                <Label htmlFor="published">Published</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading || generatingThumbnail}>
                  {uploading && <Upload className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? `Uploading${uploadProgress > 0 ? ` (${uploadProgress}%)` : '...'}` : generatingThumbnail ? "Generating Thumbnail..." : editingVideo ? "Update" : "Create"}
                </Button>
              </div>

              {uploading && uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {video.title}
                {video.video_type === 'highlight' && (
                  <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                    Highlight
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-48 object-cover rounded-md mb-2"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {video.description}
              </p>
              <div className="flex justify-between items-center text-sm mb-3">
                <span className={`px-2 py-1 rounded-full ${video.published ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {video.published ? 'Published' : 'Draft'}
                </span>
                <span className="text-muted-foreground">{video.category}</span>
              </div>
              
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(video)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(video.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos yet. Add your first video!</p>
        </div>
      )}
    </div>
  );
}

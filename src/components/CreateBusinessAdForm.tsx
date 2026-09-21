import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Megaphone, Upload, Loader2, Image } from "lucide-react";
interface CreateBusinessAdFormProps {
  userId: string;
}
const CreateBusinessAdForm = ({
  userId
}: CreateBusinessAdFormProps) => {
  const {
    toast
  } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    ad_title: "",
    ad_description: "",
    ad_image_url: "",
    website_url: "",
    contact_email: "",
    contact_phone: ""
  });
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, WebP, or GIF image.",
        variant: "destructive"
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }
    setUploadingImage(true);
    try {
      const { publicUrl } = await uploadToR2(file, `business-ads/${userId}`);
      setFormData(prev => ({
        ...prev,
        ad_image_url: publicUrl
      }));
      toast({
        title: "Image Uploaded",
        description: "Your ad image has been uploaded."
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name || !formData.ad_title || !formData.ad_description || !formData.contact_email) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    setSubmitting(true);
    try {
      const {
        error
      } = await supabase.from('business_ads').insert({
        user_id: userId,
        business_name: formData.business_name,
        ad_title: formData.ad_title,
        ad_description: formData.ad_description,
        ad_image_url: formData.ad_image_url || null,
        website_url: formData.website_url || null,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
        status: 'pending'
      });
      if (error) throw error;
      toast({
        title: "Ad Submitted!",
        description: "Your business ad has been submitted for review. It will appear once approved."
      });
      setFormData({
        business_name: "",
        ad_title: "",
        ad_description: "",
        ad_image_url: "",
        website_url: "",
        contact_email: "",
        contact_phone: ""
      });
      setDialogOpen(false);
    } catch (error) {
      console.error('Error submitting ad:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit your ad. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };
  const resetForm = () => {
    setFormData({
      business_name: "",
      ad_title: "",
      ad_description: "",
      ad_image_url: "",
      website_url: "",
      contact_email: "",
      contact_phone: ""
    });
  };
  return <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Megaphone className="w-5 h-5" />
          Business Advertising
        </CardTitle>
        <CardDescription>Promote your business to the MetsXMFanZone community</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Create an ad to showcase your business in our Community page. Ads are reviewed before going live.
        </p>
        <Dialog open={dialogOpen} onOpenChange={open => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Megaphone className="w-4 h-4" />
              Create Business Ad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Business Ad</DialogTitle>
              <DialogDescription>
                Fill in the details for your business advertisement.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input id="business_name" value={formData.business_name} onChange={e => setFormData(prev => ({
                ...prev,
                business_name: e.target.value
              }))} placeholder="Your Business Name" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ad_title">Ad Title *</Label>
                <Input id="ad_title" value={formData.ad_title} onChange={e => setFormData(prev => ({
                ...prev,
                ad_title: e.target.value
              }))} placeholder="Catchy headline for your ad" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ad_description">Description *</Label>
                <Textarea id="ad_description" value={formData.ad_description} onChange={e => setFormData(prev => ({
                ...prev,
                ad_description: e.target.value
              }))} placeholder="Describe your business and what you're offering..." rows={3} required />
              </div>
              
              <div className="space-y-2">
                <Label>Ad Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  {formData.ad_image_url ? <img src={formData.ad_image_url} alt="Ad preview" className="w-20 h-20 object-cover rounded-lg border" /> : <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>}
                  <div className="flex-1">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="w-full">
                      {uploadingImage ? <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </> : <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </>}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, WebP or GIF. Max 5MB.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website_url">Website URL (Optional)</Label>
                <Input id="website_url" type="url" value={formData.website_url} onChange={e => setFormData(prev => ({
                ...prev,
                website_url: e.target.value
              }))} placeholder="https://yourbusiness.com" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input id="contact_email" type="email" value={formData.contact_email} onChange={e => setFormData(prev => ({
                  ...prev,
                  contact_email: e.target.value
                }))} placeholder="email@business.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone (Optional)</Label>
                  <Input id="contact_phone" type="tel" value={formData.contact_phone} onChange={e => setFormData(prev => ({
                  ...prev,
                  contact_phone: e.target.value
                }))} placeholder="(555) 123-4567" />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </> : "Submit Ad for Review"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>;
};
export default CreateBusinessAdForm;
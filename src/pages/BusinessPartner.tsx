import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, TrendingUp, Target, Upload as UploadIcon } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";
const BusinessPartner = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    businessName: "",
    adTitle: "",
    adDescription: "",
    contactEmail: "",
    contactPhone: "",
    websiteUrl: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    toast
  } = useToast();
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please upload an image file",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Image must be less than 5MB",
          variant: "destructive"
        });
        return;
      }
      setImageFile(file);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a business ad",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }
    setIsLoading(true);
    try {
      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const { publicUrl } = await uploadToR2(imageFile, `business-ads/${user.id}`);
        imageUrl = publicUrl;
      }

      // Insert business ad
      const {
        error
      } = await supabase.from("business_ads").insert({
        user_id: user.id,
        business_name: formData.businessName,
        ad_title: formData.adTitle,
        ad_description: formData.adDescription,
        ad_image_url: imageUrl,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone || null,
        website_url: formData.websiteUrl || null,
        status: "pending"
      });
      if (error) throw error;
      toast({
        title: "Ad Submitted Successfully!",
        description: "Your business ad will be reviewed by our admin team within 3-5 business days."
      });

      // Reset form
      setFormData({
        businessName: "",
        adTitle: "",
        adDescription: "",
        contactEmail: "",
        contactPhone: "",
        websiteUrl: ""
      });
      setImageFile(null);
    } catch (error: any) {
      console.error("Error submitting ad:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit business ad",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const benefits = [{
    icon: Users,
    title: "Reach Thousands of Fans",
    description: "Connect with our engaged community of passionate Mets fans"
  }, {
    icon: TrendingUp,
    title: "Boost Your Brand",
    description: "Increase visibility and brand awareness in the sports community"
  }, {
    icon: Target,
    title: "Targeted Marketing",
    description: "Reach your ideal audience with precision marketing opportunities"
  }];
  return <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <img src={metsLogo} alt="MetsXMFanZone" className="w-20 h-20 mb-6 mx-auto object-scale-down" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-3 sm:mb-4">
              Business Advertisement
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Advertise your business to thousands of engaged Mets fans
            </p>
          </div>

          {/* Benefits Section */}
          <section className="mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-foreground mb-6 sm:mb-8">
              Why Partner With Us?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
                      <benefit.icon className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                    <CardDescription>{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>)}
            </div>
          </section>

          {/* Application Form */}
          <section className="max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Submit Your Business Ad</CardTitle>
                <CardDescription className="text-sm">
                  Fill out the form below to submit your advertisement for admin approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="businessName" className="text-sm font-medium mb-2 block">
                      Business Name *
                    </label>
                    <Input id="businessName" value={formData.businessName} onChange={e => setFormData({
                    ...formData,
                    businessName: e.target.value
                  })} required placeholder="Your Business Name" />
                  </div>

                  <div>
                    <label htmlFor="adTitle" className="text-sm font-medium mb-2 block">
                      Ad Title *
                    </label>
                    <Input id="adTitle" value={formData.adTitle} onChange={e => setFormData({
                    ...formData,
                    adTitle: e.target.value
                  })} required placeholder="Catchy title for your ad" />
                  </div>

                  <div>
                    <label htmlFor="adDescription" className="text-sm font-medium mb-2 block">
                      Ad Description *
                    </label>
                    <Textarea id="adDescription" rows={4} value={formData.adDescription} onChange={e => setFormData({
                    ...formData,
                    adDescription: e.target.value
                  })} required placeholder="Describe your product or service" />
                  </div>

                  <div>
                    <label htmlFor="adImage" className="text-sm font-medium mb-2 block">
                      Ad Image (Optional)
                    </label>
                    <Input id="adImage" type="file" accept="image/*" onChange={handleImageSelect} className="cursor-pointer" />
                    {imageFile && <p className="text-xs text-muted-foreground mt-1">
                        Selected: {imageFile.name}
                      </p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 5MB • JPG, PNG, GIF, WEBP
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contactEmail" className="text-sm font-medium mb-2 block">
                        Contact Email *
                      </label>
                      <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={e => setFormData({
                      ...formData,
                      contactEmail: e.target.value
                    })} required placeholder="your@email.com" />
                    </div>
                    <div>
                      <label htmlFor="contactPhone" className="text-sm font-medium mb-2 block">
                        Contact Phone
                      </label>
                      <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={e => setFormData({
                      ...formData,
                      contactPhone: e.target.value
                    })} placeholder="(123) 456-7890" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="websiteUrl" className="text-sm font-medium mb-2 block">
                      Website URL
                    </label>
                    <Input id="websiteUrl" type="url" value={formData.websiteUrl} onChange={e => setFormData({
                    ...formData,
                    websiteUrl: e.target.value
                  })} placeholder="https://yourbusiness.com" />
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-sm">Ad Review Process:</h3>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Your ad will be reviewed within 3-5 business days</li>
                      <li>• We'll contact you via email with approval status</li>
                      <li>• Approved ads will appear in the Community section</li>
                      <li>• All ads must comply with our content guidelines</li>
                    </ul>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? <>
                        <UploadIcon className="w-4 h-4 mr-2 animate-pulse" />
                        Submitting...
                      </> : "Submit Ad for Review"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>;
};
export default BusinessPartner;
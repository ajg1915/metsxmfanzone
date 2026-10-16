import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, LifeBuoy, Mail } from "lucide-react";

const SUPPORT_EMAIL = "support@metsxmfanzone.com";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Contact MetsXMFanZone - Get in Touch"
        description="Email MetsXMFanZone for questions or member support. We are a strictly online service."
        keywords="contact Mets fan zone, MetsXM support, Mets customer service, contact us"
        canonical="https://metsxmfanzone.com/contact"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "MetsXMFanZone",
          url: "https://metsxmfanzone.com",
          logo: "https://metsxmfanzone.com/og-image.png",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: SUPPORT_EMAIL,
            availableLanguage: "English",
          },
        }}
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary mb-3 sm:mb-4">
              Contact Us
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              MetsXMFanZone is a strictly online service. Email is the best way to reach us.
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                  Email us
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Questions, feedback or anything else about MetsXMFanZone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-base sm:text-lg font-semibold text-primary hover:underline break-all"
                >
                  {SUPPORT_EMAIL}
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <LifeBuoy className="w-4 h-4 sm:w-5 sm:h-5" />
                  Members: having an issue?
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Email us at {SUPPORT_EMAIL} from the email address on your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Tell us what happened, such as a login problem, a billing question or a stream that
                  will not play, and which device you are using. We will get back to you as soon as we can.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                  Online only
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm sm:text-base text-muted-foreground">
                  MetsXMFanZone is strictly an online service. We do not have an office, a store or a phone
                  line, and we cannot help in person. Everything is handled by email.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;

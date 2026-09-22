import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Book, Video, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const HelpCenter = () => {
  const categories = [
    {
      icon: Book,
      title: "Getting Started",
      description: "Learn the basics of MetsXMFanZone",
      articles: [
        { title: "How to create an account", path: "/help/create-account" },
        { title: "Navigating the platform", path: "/help/navigate-platform" },
        { title: "Watching live streams", path: "/help/watch-streams" },
        { title: "Community guidelines", path: "/help/community-guidelines" },
      ],
    },
    {
      icon: Video,
      title: "Streaming & Content",
      description: "Everything about our video content",
      articles: [
        { title: "Video quality settings", path: "/help/video-quality" },
        { title: "Accessing premium content", path: "/help/premium-content" },
        { title: "Download and offline viewing", path: "/help/offline-viewing" },
        { title: "Troubleshooting playback issues", path: "/help/playback-issues" },
      ],
    },
    {
      icon: MessageCircle,
      title: "Community & Engagement",
      description: "Connect with other fans",
      articles: [
        { title: "Posting in the community", path: "/help/post-community" },
        { title: "Commenting and reactions", path: "/help/comments-reactions" },
        { title: "Following other fans", path: "/help/follow-fans" },
        { title: "Reporting inappropriate content", path: "/help/report-content" },
      ],
    },
    {
      icon: HelpCircle,
      title: "Account & Billing",
      description: "Manage your account and subscriptions",
      articles: [
        { title: "Update profile information", path: "/help/update-profile" },
        { title: "Subscription plans explained", path: "/help/subscription-plans" },
        { title: "Payment methods", path: "/help/payment-methods" },
        { title: "Cancel or change subscription", path: "/help/cancel-subscription" },
        { title: "Return policy", path: "/help/return-policy" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Help Center - Support & Resources"
        description="Get help with MetsXMFanZone. Browse guides, tutorials, and resources for streaming, account management, troubleshooting, and more."
        keywords="Mets help center, streaming support, account help, video troubleshooting, MetsXM support"
        canonical="https://www.metsxmfanzone.com/help-center"
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-3 sm:mb-4">
              Help Center
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Find answers to your questions and learn how to get the most out of MetsXMFanZone
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {categories.map((category, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <category.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl text-primary">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.articles.map((article, articleIndex) => (
                      <li key={articleIndex}>
                        <Link to={article.path} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                          • {article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HelpCenter;

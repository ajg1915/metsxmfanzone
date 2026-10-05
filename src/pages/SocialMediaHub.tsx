import SEOHead from '@/components/SEOHead';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Facebook, Instagram, Twitter, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect } from 'react';

const SocialMediaHub = () => {
  // Social media profile links - update these with your actual URLs
  const socialLinks = {
    facebook: 'https://www.facebook.com/metsxmfanzoneofficial',
    instagram: 'https://www.instagram.com/metsxmfanzone',
    twitter: 'https://twitter.com/metsxmfanzone',
    tiktok: 'https://www.tiktok.com/@metsxmfanzone',
  };

  // Load Twitter widgets
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load Facebook SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);

    // Initialize FB
    (window as any).fbAsyncInit = function() {
      (window as any).FB?.init({
        xfbml: true,
        version: 'v18.0'
      });
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Follow MetsXMFanZone on Social Media"
        description="Follow MetsXMFanZone on all social media platforms. Stay connected with the latest Mets news, updates, and community content."
        keywords="MetsXMFanZone social media, Mets Twitter, Mets Instagram, Mets Facebook, Mets TikTok"
        canonical="https://www.metsxmfanzone.com/social-media-hub"
      />

      <Navigation />

      <main className="container mx-auto px-4 py-8 pt-12 md:pt-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
            Follow MetsXMFanZone
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay connected with us across all platforms for the latest Mets news, highlights, and community content.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Button
            variant="outline"
            className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
            onClick={() => window.open(socialLinks.facebook, '_blank')}
          >
            <Facebook className="h-5 w-5" />
            Facebook
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-pink-600 text-pink-600 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white hover:border-transparent"
            onClick={() => window.open(socialLinks.instagram, '_blank')}
          >
            <Instagram className="h-5 w-5" />
            Instagram
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
            onClick={() => window.open(socialLinks.twitter, '_blank')}
          >
            <Twitter className="h-5 w-5" />
            X (Twitter)
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
            onClick={() => window.open(socialLinks.tiktok, '_blank')}
          >
            <Video className="h-5 w-5" />
            TikTok
          </Button>
        </div>

        {/* Feeds Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Facebook Feed */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-6 w-6" />
                Facebook
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[500px] flex items-center justify-center">
              <div 
                className="fb-page" 
                data-href={socialLinks.facebook}
                data-tabs="timeline"
                data-width="500"
                data-height="500"
                data-small-header="false"
                data-adapt-container-width="true"
                data-hide-cover="false"
                data-show-facepile="true"
              >
                <blockquote cite={socialLinks.facebook} className="fb-xfbml-parse-ignore">
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View on Facebook
                    </Button>
                  </a>
                </blockquote>
              </div>
            </CardContent>
          </Card>

          {/* Twitter/X Feed */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background">
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-6 w-6" />
                X (Twitter)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[500px]">
              <a 
                className="twitter-timeline" 
                data-height="500"
                data-theme="dark"
                href="https://twitter.com/metsxmfanzone?ref_src=twsrc%5Etfw"
              >
                Tweets by MetsXMFanZone
              </a>
            </CardContent>
          </Card>

          {/* Instagram Feed */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-6 w-6" />
                Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[500px] flex flex-col items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                  <Instagram className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-xl font-semibold">@metsxmfanzone</h3>
                <p className="text-muted-foreground">
                  Follow us for behind-the-scenes content, game day highlights, and community features!
                </p>
                <Button 
                  className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:opacity-90"
                  onClick={() => window.open(socialLinks.instagram, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Follow on Instagram
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* TikTok Feed */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-6 w-6" />
                TikTok
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[500px] flex flex-col items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-foreground rounded-full flex items-center justify-center">
                  <Video className="h-12 w-12 text-background" />
                </div>
                <h3 className="text-xl font-semibold">@metsxmfanzone</h3>
                <p className="text-muted-foreground">
                  Watch our latest TikToks featuring game highlights, fan reactions, and exclusive content!
                </p>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(socialLinks.tiktok, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Follow on TikTok
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center bg-primary/10 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Join the MetsXMFanZone Community</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Connect with fellow Mets fans, get instant updates, and never miss a moment of the action!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={() => window.open(socialLinks.facebook, '_blank')} className="gap-2">
              <Facebook className="h-4 w-4" />
              Like us
            </Button>
            <Button onClick={() => window.open(socialLinks.twitter, '_blank')} variant="secondary" className="gap-2">
              <Twitter className="h-4 w-4" />
              Follow us
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SocialMediaHub;

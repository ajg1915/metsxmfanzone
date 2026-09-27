import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Terms of Service - MetsXMFanZone User Agreement</title>
        <meta name="description" content="Review MetsXMFanZone's terms of service and user agreement. Understand your rights and responsibilities when using our platform." />
        <meta name="keywords" content="terms of service, user agreement, terms and conditions, legal terms" />
        <link rel="canonical" href="https://metsxmfanzone.com/terms" />
        <meta property="og:title" content="Terms of Service — MetsXMFanZone" />
        <meta property="og:description" content="Your rights and responsibilities when using MetsXMFanZone. Read our full terms of service and user agreement." />
        <meta property="og:url" content="https://metsxmfanzone.com/terms" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Terms of Service — MetsXMFanZone" />
        <meta name="twitter:description" content="Your rights and responsibilities when using MetsXMFanZone. Read our full terms of service and user agreement." />
      </Helmet>
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto prose prose-lg dark:prose-invert">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-3 sm:mb-4">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Agreement to Terms</h2>
              <p className="text-muted-foreground">
                By accessing MetsXMFanZone, you agree to be bound by these Terms of Service and all applicable 
                laws and regulations. If you do not agree with any of these terms, you are prohibited from using 
                this site.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Use License</h2>
              <p className="text-muted-foreground mb-4">
                Permission is granted to temporarily access the materials on MetsXMFanZone for personal, 
                non-commercial viewing only. This is the grant of a license, not a transfer of title, and 
                under this license you may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Modify or copy the materials</li>
                <li>Use the materials for commercial purposes</li>
                <li>Attempt to reverse engineer any software</li>
                <li>Remove copyright or proprietary notations</li>
                <li>Transfer materials to another person</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials and for all 
                activities that occur under your account. You must immediately notify us of any unauthorized use 
                of your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Subscriptions and Payments</h2>
              <p className="text-muted-foreground mb-4">
                Subscription fees are billed in advance on a recurring basis. You can cancel at any time, but 
                refunds are not provided for partial billing periods. We reserve the right to modify subscription 
                prices with 30 days notice.
              </p>
              <p className="text-muted-foreground mb-4">
                Every membership is a secure plan billed through PayPal, can be watched on the go, works on all your
                devices (phone, tablet, computer and TV), and can be cancelled anytime from your Member Center. Paid
                memberships allow streaming on up to 2 devices at the same time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">NY Sports Streaming Package</h2>
              <p className="text-muted-foreground mb-4">
                The NY Sports Streaming package is a separate subscription billed at $19.99 per month through
                PayPal. It is independent of our Mets memberships (Free, Weekly, Monthly and Yearly): it can be added
                to any Mets membership or purchased on its own, and adding or cancelling it does not change your Mets
                membership.
              </p>
              <p className="text-muted-foreground mb-4">The NY Sports Streaming package covers only:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                <li>New York Giants</li>
                <li>New York Jets</li>
                <li>New York Knicks</li>
                <li>New York Rangers</li>
                <li>New York Islanders</li>
                <li>Brooklyn Nets</li>
                <li>Our 24/7 sports network streams, for as long as they are offered</li>
              </ul>
              <p className="text-muted-foreground">
                It does not include Mets streams, replays or other premium Mets content, which require a Weekly,
                Monthly or Yearly membership. Game availability depends on each team's schedule and may change. The
                24/7 sports network streams may be removed from the package in a future season; we will post any
                change on this page before it takes effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Content Guidelines</h2>
              <p className="text-muted-foreground mb-4">Users must not post content that:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Violates any laws or regulations</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains hate speech or harassment</li>
                <li>Promotes violence or illegal activities</li>
                <li>Contains spam or misleading information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, trademarks, and data on this platform, including but not limited to software, databases, 
                text, graphics, icons, and hyperlinks, are the property of MetsXMFanZone and are protected by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                MetsXMFanZone shall not be liable for any damages arising from the use or inability to use our 
                services, including but not limited to direct, indirect, incidental, punitive, and consequential damages.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to terminate or suspend your account and access to our services at our sole 
                discretion, without notice, for conduct that violates these Terms or is harmful to other users.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may revise these Terms at any time. By continuing to use MetsXMFanZone after changes are posted, 
                you agree to be bound by the revised terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Information</h2>
              <p className="text-muted-foreground">
                Questions about the Terms of Service should be sent to{" "}
                <a href="mailto:legal@metsxmfanzone.com" className="text-primary hover:underline">
                  legal@metsxmfanzone.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;

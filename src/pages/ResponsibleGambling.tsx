import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const ResponsibleGambling = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Responsible Gambling & Affiliate Disclosure - MetsXMFanZone</title>
        <meta name="description" content="MetsXMFanZone is not a sportsbook. Read our affiliate disclosure, 21+ notice, and responsible gambling resources, including the 1-800-GAMBLER helpline." />
        <link rel="canonical" href="https://metsxmfanzone.com/responsible-gambling" />
        <meta property="og:title" content="Responsible Gambling & Affiliate Disclosure — MetsXMFanZone" />
        <meta property="og:description" content="Affiliate disclosure, 21+ notice and responsible gambling resources from MetsXMFanZone." />
        <meta property="og:url" content="https://metsxmfanzone.com/responsible-gambling" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Responsible Gambling & Affiliate Disclosure — MetsXMFanZone" />
        <meta name="twitter:description" content="Affiliate disclosure, 21+ notice and responsible gambling resources from MetsXMFanZone." />
      </Helmet>
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto prose prose-lg dark:prose-invert">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-3 sm:mb-4">Responsible Gambling &amp; Affiliate Disclosure</h1>
            <p className="text-muted-foreground mb-8">Last updated: October 27, 2026</p>

            <section className="mb-8 rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-foreground font-semibold">
                You must be 21 or older (or the legal age in your state) to bet. Betting involves risk and most people lose money over time. Please bet responsibly.
              </p>
              <p className="text-muted-foreground mt-2">
                If you or someone you know has a gambling problem, call or text <strong>1-800-GAMBLER</strong> (1-800-426-2537) for confidential help, or visit{" "}
                <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ncpgambling.org</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">We Are Not a Sportsbook</h2>
              <p className="text-muted-foreground">
                MetsXMFanZone is a fan community and media site. We do not accept bets, hold your money, or operate any gambling service. Any bet you place is made directly with a licensed sportsbook under that sportsbook's own rules.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Affiliate Disclosure</h2>
              <p className="text-muted-foreground mb-4">
                Some links on our website, in our show descriptions and in our live chats are affiliate links to sportsbooks and other partners. If you click one and sign up, deposit or make a purchase, we may earn a commission or fee at no extra cost to you.
              </p>
              <p className="text-muted-foreground">
                We only recommend products and services we believe may interest our audience, but compensation may influence which partners we feature. Our opinions, commentary and picks are our own.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Picks Are Opinions, Not Guarantees</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Any picks, predictions or betting talk on our shows and posts are for entertainment and information only.</li>
                <li>We do not guarantee any result or profit, and past picks do not predict future outcomes.</li>
                <li>Nothing here is financial, legal or professional advice. Never bet money you cannot afford to lose.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Availability and Legal Age</h2>
              <p className="text-muted-foreground">
                Sports betting is legal only in certain states and jurisdictions, and the minimum age and rules vary by location. It is your responsibility to know and follow the laws where you live. Sportsbook offers may not be available in every state, and sportsbooks decide who is eligible for their promotions. Offers and terms are set by the sportsbook and can change at any time, so read their terms before you sign up.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Tips for Safer Play</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Set a budget before you play and stick to it.</li>
                <li>Never chase losses or bet to solve money problems.</li>
                <li>Use the deposit limits, time-outs and self-exclusion tools that licensed sportsbooks offer.</li>
                <li>Take breaks, and do not bet while upset, tired or under the influence.</li>
                <li>Talk to someone you trust, or call 1-800-GAMBLER, if gambling stops being fun.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Not Affiliated With the Mets or MLB</h2>
              <p className="text-muted-foreground">
                MetsXMFanZone is an independent fan site. It is not affiliated with, endorsed by or sponsored by the New York Mets, Major League Baseball or any sportsbook. Team and league names are used only to refer to them.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground">
                Questions about this page? Email{" "}
                <a href="mailto:support@metsxmfanzone.com" className="text-primary hover:underline">support@metsxmfanzone.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResponsibleGambling;

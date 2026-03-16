import SEOHead, { generateFAQSchema } from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQs = () => {
  const faqs = [
    {
      question: "What is MetsXMFanZone?",
      answer: "MetsXMFanZone is your ultimate destination for exclusive New York Mets content, including live streams, game highlights, community discussions, and in-depth analysis.",
    },
    {
      question: "How do I watch live streams?",
      answer: "Navigate to the Live section from the main menu or click on any live stream card on the homepage. Premium subscribers get access to all live content.",
    },
    {
      question: "What's the difference between Free and Premium plans?",
      answer: "Free plan gives you basic access to highlights and community features. Premium ($9.99/month) unlocks all live streams, full game replays, HD quality, ad-free experience, and exclusive content. Annual plan ($129.99/year) includes everything in Premium plus 2 months free savings.",
    },
    {
      question: "Can I switch between monthly and yearly billing?",
      answer: "Yes! You can switch between monthly and annual billing anytime from your account settings. When you switch to annual, you'll save the equivalent of 2 months compared to monthly billing.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept PayPal and all major credit/debit cards through our secure payment processing partners.",
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes! You can cancel your subscription at any time from your account settings. Your access will continue until the end of your billing period.",
    },
    {
      question: "How do I join the community?",
      answer: "Create a free account and head to the Community section. You can post, comment, and engage with other Mets fans instantly.",
    },
    {
      question: "Is there a mobile app?",
      answer: "Yes! Our website is fully responsive and works great on mobile browsers. You can also add it to your home screen for an app-like experience using PWA technology.",
    },
    {
      question: "How often is new content added?",
      answer: "We add new content daily, including game highlights, analysis videos, blog posts, and live streams during the baseball season.",
    },
    {
      question: "Can I watch on multiple devices?",
      answer: "Premium and Annual plans allow streaming on up to 2 devices simultaneously. Accounts found accessing from more than 2 devices may face restrictions.",
    },
    {
      question: "What happens to my unused access?",
      answer: "Your subscription access remains valid until the end of your billing period. If you cancel, you can continue using premium features until that date.",
    },
    {
      question: "How do I report inappropriate content?",
      answer: "Use the report button on any post or comment. Our moderation team reviews all reports within 24 hours.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Frequently Asked Questions - Help & Support"
        description="Find answers to common questions about MetsXMFanZone subscriptions, live streams, content access, and more. Get help with your account and features."
        keywords="Mets FAQs, MetsXM help, support questions, streaming help, subscription FAQ"
        canonical="https://www.metsxmfanzone.com/faqs"
        structuredData={generateFAQSchema(faqs)}
        pageType="faq"
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
              Frequently Asked Questions
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Find quick answers to common questions about MetsXMFanZone
            </p>
          </div>

          <div className="w-full">
            <Accordion type="single" collapsible className="w-full space-y-0">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border-b border-border py-1"
                >
                  <AccordionTrigger className="text-left text-base sm:text-lg font-medium text-foreground hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQs;
import SEOHead, { generateFAQSchema } from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, MessageCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FAQs = () => {
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("contact_submissions").insert({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        subject: contactForm.subject.trim() || null,
        message: contactForm.message.trim(),
        user_id: user?.id || null,
      } as any);
      if (error) throw error;
      toast.success("Your question has been submitted! We'll get back to you soon.");
      setContactForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
    {
      question: "Are there any blackouts on MetsXMFanZone streams?",
      answer: "No! There are absolutely no blackouts on any of our streams. You can watch every game without restrictions. If there is ever a rare schedule change or stream update, we will announce it on our Social Wall or on our official social media channels — so make sure to follow us to stay informed.",
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

          {/* Contact Form Section */}
          <Card className="mt-12 border-primary/20">
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-primary">Still Have Questions?</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Send us a message and we'll get back to you as soon as possible.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContactSubmit} className="space-y-4 max-w-lg mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name *</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email *</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="your@email.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      maxLength={255}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    placeholder="What's this about?"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Tell us your question or concern..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                    maxLength={1000}
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? "Sending..." : "Submit Question"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQs;
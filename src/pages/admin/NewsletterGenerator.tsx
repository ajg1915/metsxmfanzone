import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderEmail } from "../../../api/_lib/email-shell.js";
import { Mail, Loader2, Send, Newspaper, Eye, Sparkles, Copy, RefreshCw, Users, TestTube } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";

// Only these tags survive in the newsletter body.
const cleanBody = (content: string): string =>
  DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'h2', 'h3', 'ul', 'ol', 'li', 'br'],
    ALLOWED_ATTR: ['href', 'style'],
  });

// Same look as every other MetsXMFanZone email (small logo, navy card).
const generateNewsletterHtml = (title: string, content: string) =>
  renderEmail({
    preheader: title,
    heading: title,
    content: cleanBody(content),
    cta: { label: "Visit MetsXMFanZone", url: "https://metsxmfanzone.com" },
    note: "You are getting this because you signed up for MetsXMFanZone news.",
    unsubscribe: false,
  });

// Talks to our own /api/mail-admin (Resend list). Only works for signed-in admins.
const callMail = async (body: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/mail-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function NewsletterGenerator() {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSubscriberCount = async () => {
      try {
        const data = await callMail({ action: "count" });
        setSubscriberCount(data.count || 0);
      } catch {
        setSubscriberCount(0);
      }
    };
    fetchSubscriberCount();
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your newsletter",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-newsletter", {
        body: {
          topic,
          tone,
          sections: "introduction, main content, key highlights, call-to-action",
          audience: "Mets baseball fans",
        },
      });

      if (error) throw error;

      // Extract just the HTML content if it's wrapped
      let content = data.content || "";
      
      // If the response contains HTML, extract the body content
      if (content.includes("<body")) {
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1];
        }
      }
      
      setGeneratedContent(content);
      
      // Auto-generate subject from topic
      if (!subject.trim()) {
        setSubject(topic);
      }

      toast({
        title: "Newsletter Generated!",
        description: "Review the content and make any edits before sending.",
      });
    } catch (error: any) {
      console.error("Error generating newsletter:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate newsletter content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const fullHtml = generateNewsletterHtml(subject, generatedContent);
    navigator.clipboard.writeText(fullHtml);
    toast({
      title: "Copied!",
      description: "Newsletter HTML copied to clipboard",
    });
  };

  const handleSend = () => {
    if (!subject.trim() || !generatedContent.trim()) {
      toast({
        title: "Required Fields",
        description: "Please generate content and add a subject before sending",
        variant: "destructive",
      });
      return;
    }
    setShowSendDialog(true);
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address for testing",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim() || !generatedContent.trim()) {
      toast({
        title: "Required Fields",
        description: "Please generate content and add a subject before sending a test",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);

    try {
      await callMail({ action: "test", to: testEmail.trim(), subject, content: cleanBody(generatedContent) });

      toast({
        title: "Test Email Sent!",
        description: `Newsletter test sent to ${testEmail}`,
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      const message = error?.message || "Request failed";
      toast({
        title: "Send Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const confirmSend = async () => {
    setShowSendDialog(false);
    setIsSending(true);

    try {
      await callMail({ action: "send", subject, content: cleanBody(generatedContent) });

      toast({
        title: "Newsletter Sent!",
        description: "Sent to everyone on your MetsXMFanZone Newsletter list.",
      });
      
      // Clear form
      setSubject("");
      setTopic("");
      setGeneratedContent("");
    } catch (error: any) {
      console.error("Error sending newsletter:", error);
      const message = error?.message || "Request failed";
      toast({
        title: "Send Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const previewHtml = generateNewsletterHtml(subject || "Newsletter Preview", generatedContent || "<p>Your newsletter content will appear here...</p>");

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Newspaper}
        title="Newsletter Generator"
        description="Create AI-powered newsletters for your subscribers"
        actions={
          <Badge variant="secondary" className="flex items-center gap-1.5 text-[10px] h-5">
            <Users className="w-3 h-3" />
            {subscriberCount} Subscribers
          </Badge>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left Panel - Generator */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generate Newsletter
            </CardTitle>
            <CardDescription className="text-xs">
              Use AI to create engaging content for your fans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-sm">Newsletter Topic *</Label>
              <Input
                id="topic"
                placeholder="e.g., Spring Training Updates, Trade Deadline Recap..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone" className="text-sm">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="hype">Hype & Exciting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Newsletter
                </>
              )}
            </Button>

            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm">Email Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content" className="text-sm">Newsletter Content</Label>
                  {generatedContent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="h-6 px-2 text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                  )}
                </div>
                <Textarea
                  id="content"
                  placeholder="Generated newsletter content will appear here. You can edit it before sending."
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={12}
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Edit the generated content as needed. HTML formatting is supported.
                </p>
              </div>
            </div>

            {/* Test Email Section */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium">Send Test Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email for testing"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="text-sm flex-1"
                />
                <Button
                  onClick={sendTestEmail}
                  variant="outline"
                  size="sm"
                  disabled={isSendingTest || !testEmail.trim() || !generatedContent.trim()}
                >
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-1" />
                      Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send a test email to yourself to check the look before sending to all subscribers
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                size="sm"
                disabled={!generatedContent.trim()}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                disabled={!generatedContent.trim()}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy HTML
              </Button>
              <Button
                onClick={handleSend}
                variant="default"
                size="sm"
                disabled={isSending || !subject.trim() || !generatedContent.trim()}
                className="flex-1"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to All
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Live Preview */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Preview
            </CardTitle>
            <CardDescription className="text-xs">
              See how your newsletter will look
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-[#0a0a0a] rounded-lg p-2 overflow-auto max-h-[600px]">
              <iframe title="Newsletter preview" sandbox="" srcDoc={previewHtml} className="h-[560px] w-full rounded-lg border-0 bg-[#06101c]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Newsletter to All Subscribers?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send the newsletter to <strong>{subscriberCount}</strong> active subscribers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>
              <Send className="w-4 h-4 mr-2" />
              Send Newsletter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Newsletter Preview
            </AlertDialogTitle>
            <AlertDialogDescription>
              Subject: {subject || "No subject"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-[#0a0a0a] rounded-lg p-2 overflow-auto max-h-[60vh]">
            <iframe title="Newsletter preview" sandbox="" srcDoc={previewHtml} className="h-[560px] w-full rounded-lg border-0 bg-[#06101c]" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}

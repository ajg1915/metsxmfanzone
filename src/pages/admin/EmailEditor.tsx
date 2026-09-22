import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  Mail, Loader2, Send, Users, Newspaper, User, X, TestTube, RefreshCw,
  Paintbrush, FileText, PenSquare, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";

type RecipientType = "all_users" | "subscribers" | "specific";

interface RecipientCounts {
  allUsers: number;
  subscribers: number;
}

interface TemplateOption {
  key: string;
  label: string;
}

interface RenderedEmail {
  subject: string;
  from: string;
  html: string;
  label?: string;
}

const QUICK_BLOCKS = [
  {
    name: "Welcome Message",
    subject: "Welcome to MetsXMFanZone!",
    heading: "Welcome, {{name}}!",
    content:
      `<p style="margin:0 0 16px;text-align:center;">We're thrilled to have you in the MetsXMFanZone community.</p>`,
  },
  {
    name: "New Content Alert",
    subject: "New on MetsXMFanZone",
    heading: "Fresh content is up",
    content:
      `<p style="margin:0 0 16px;text-align:center;">Hey {{name}}, new podcast episodes, highlights and articles just dropped.</p>`,
  },
  {
    name: "Live Stream Reminder",
    subject: "We're going live soon!",
    heading: "We're going live",
    content:
      `<p style="margin:0 0 16px;text-align:center;">{{name}}, join us for exclusive Mets coverage — the stream starts shortly.</p>`,
  },
];

export default function EmailEditor() {
  const { toast } = useToast();

  // Compose state
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [content, setContent] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("all_users");
  const [specificEmails, setSpecificEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [recipientCounts, setRecipientCounts] = useState<RecipientCounts>({ allUsers: 0, subscribers: 0 });

  // Shared state
  const [mode, setMode] = useState<"compose" | "templates">("compose");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("signup_confirmation");
  const [rendered, setRendered] = useState<RenderedEmail | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [profilesRes, subscribersRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).not("email", "is", null),
          supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);
        setRecipientCounts({
          allUsers: profilesRes.count || 0,
          subscribers: subscribersRes.count || 0,
        });
      } catch (error) {
        console.error("Error fetching recipient counts:", error);
      }
    };
    fetchCounts();
  }, []);

  const invokeEmailFunction = useCallback(async (functionName: string, body: Record<string, unknown>) => {
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("The email service timed out. Please try again.")), 30000);
    });
    const result = await Promise.race([supabase.functions.invoke(functionName, { body }), timeout]);
    if (result.error) {
      if (result.error instanceof FunctionsHttpError) {
        const responseText = await result.error.context.text();
        let details: { error?: string } | null = null;
        try {
          details = JSON.parse(responseText) as { error?: string };
        } catch {
          details = null;
        }
        throw new Error(details?.error || responseText || "The email could not be sent.");
      }
      throw new Error(result.error.message || "The email could not be sent.");
    }
    return result.data;
  }, []);

  // Render the REAL branded email on the server, so preview == what recipients get.
  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const body = mode === "templates"
        ? { template: selectedTemplate }
        : { template: "custom", subject, heading, content };
      const data = await invokeEmailFunction("preview-email-template", body) as {
        subject: string; from: string; html: string; label?: string; templates?: TemplateOption[];
      };
      setRendered({ subject: data.subject, from: data.from, html: data.html, label: data.label });
      if (data.templates?.length) setTemplates(data.templates);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Preview could not be loaded";
      setRenderError(message);
      setRendered(null);
    } finally {
      setIsRendering(false);
    }
  }, [mode, selectedTemplate, subject, heading, content, invokeEmailFunction]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { renderPreview(); }, 450);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [renderPreview]);

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes("@") && !specificEmails.includes(email)) {
      setSpecificEmails([...specificEmails, email]);
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => setSpecificEmails(specificEmails.filter((e) => e !== email));

  const recipientCount = useMemo(() => {
    switch (recipientType) {
      case "all_users": return recipientCounts.allUsers;
      case "subscribers": return recipientCounts.subscribers;
      case "specific": return specificEmails.length;
      default: return 0;
    }
  }, [recipientType, recipientCounts, specificEmails]);

  const recipientLabel = recipientType === "all_users"
    ? "all registered users"
    : recipientType === "subscribers"
      ? "newsletter subscribers"
      : "specific recipients";

  const canSend = mode === "compose" && !!subject.trim() && !!content.trim() && !!rendered && recipientCount > 0;

  const sendThroughResend = async (to: string[], isTest: boolean) => {
    if (!rendered) throw new Error("Wait for the preview to finish loading.");
    return invokeEmailFunction("send-user-email", {
      subject: rendered.subject,
      content: rendered.html,
      rawHtml: true,
      recipientType: isTest ? "specific" : recipientType,
      specificEmails: isTest ? to : recipientType === "specific" ? specificEmails : undefined,
      useTestSender: isTest,
    });
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast({ title: "Invalid Email", description: "Enter a valid email address to send the test to.", variant: "destructive" });
      return;
    }
    if (mode === "compose" && (!subject.trim() || !content.trim())) {
      toast({ title: "Required Fields", description: "Add a subject and content before sending a test.", variant: "destructive" });
      return;
    }
    setIsSendingTest(true);
    try {
      await sendThroughResend([testEmail.trim().toLowerCase()], true);
      toast({ title: "Test Email Sent", description: `Sent to ${testEmail} through Resend.` });
    } catch (error: unknown) {
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send test email",
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
      const data = await sendThroughResend([], false) as { sent: number; total: number };
      toast({ title: "Email Sent", description: `Delivered to ${data.sent} of ${data.total} recipients.` });
      setSubject("");
      setHeading("");
      setContent("");
      setSpecificEmails([]);
    } catch (error: unknown) {
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const previewCard = (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" /> Real email preview
            </CardTitle>
            <CardDescription className="text-xs truncate">
              Exactly what recipients receive, sent through Resend
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={renderPreview} disabled={isRendering}>
            <RefreshCw className={`w-3.5 h-3.5 ${isRendering ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] space-y-0.5">
          <p className="truncate"><span className="text-muted-foreground">From:</span> {rendered?.from || "MetsXMFanZone <noreply@metsxmfanzone.com>"}</p>
          <p className="truncate"><span className="text-muted-foreground">Subject:</span> {rendered?.subject || "(No subject)"}</p>
        </div>
        {renderError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{renderError}</span>
          </div>
        ) : (
          <div className="relative rounded-md overflow-hidden border border-border bg-[#0a0a0a]">
            {isRendering && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <iframe
              title="Email preview"
              srcDoc={rendered?.html || "<p style='color:#888;font-family:sans-serif;padding:24px;text-align:center'>Nothing to preview yet.</p>"}
              sandbox=""
              className="w-full h-[460px] sm:h-[560px] bg-white"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const testCard = (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><TestTube className="w-4 h-4" /> Send a test</CardTitle>
        <CardDescription className="text-xs">Sends this exact email to one address through Resend</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button onClick={sendTestEmail} size="sm" variant="secondary" disabled={isSendingTest || !testEmail.trim() || !rendered}>
            {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Test</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Mail}
        title="Email Center"
        count={templates.length}
        countLabel="templates"
        description="Compose, preview and send — all through Resend"
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link to="/admin/email-templates"><Paintbrush className="w-3.5 h-3.5 mr-1" /> Branding</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span className="font-medium">Resend connected</span>
        <span className="text-muted-foreground">noreply@metsxmfanzone.com</span>
        <Badge variant="secondary" className="text-[10px]">{recipientCounts.allUsers} members</Badge>
        <Badge variant="secondary" className="text-[10px]">{recipientCounts.subscribers} subscribers</Badge>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "compose" | "templates")} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="compose" className="text-xs"><PenSquare className="w-3.5 h-3.5 mr-1.5" /> Compose</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1.5" /> System emails</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><PenSquare className="w-4 h-4" /> Compose email</CardTitle>
                  <CardDescription className="text-xs">
                    Use {"{{name}}"} and {"{{email}}"} to personalize each message
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Recipients</Label>
                    <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_users"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> All members ({recipientCounts.allUsers})</span></SelectItem>
                        <SelectItem value="subscribers"><span className="flex items-center gap-2"><Newspaper className="w-4 h-4" /> Subscribers ({recipientCounts.subscribers})</span></SelectItem>
                        <SelectItem value="specific"><span className="flex items-center gap-2"><User className="w-4 h-4" /> Specific people</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {recipientType === "specific" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Email addresses</Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Enter an email and press Enter"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                          className="flex-1 text-sm"
                        />
                        <Button type="button" onClick={addEmail} size="sm">Add</Button>
                      </div>
                      {specificEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {specificEmails.map((email) => (
                            <Badge key={email} variant="secondary" className="text-xs">
                              {email}
                              <button onClick={() => removeEmail(email)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm">Subject *</Label>
                    <Input id="subject" placeholder="Enter email subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heading" className="text-sm">Headline (optional)</Label>
                    <Input id="heading" placeholder="Shown in large text at the top" value={heading} onChange={(e) => setHeading(e.target.value)} className="text-sm" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content" className="text-sm">Message *</Label>
                    <Textarea
                      id="content"
                      placeholder="Write your message here. Basic HTML is supported."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={10}
                      className="text-sm font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Your logo, colors and footer are added automatically from the Branding page.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUICK_BLOCKS.map((block) => (
                      <Button
                        key={block.name}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setSubject(block.subject);
                          setHeading(block.heading);
                          setContent(block.content);
                        }}
                      >
                        {block.name}
                      </Button>
                    ))}
                  </div>

                  <Button
                    onClick={() => setShowSendDialog(true)}
                    size="sm"
                    disabled={!canSend || isSending}
                    className="w-full"
                  >
                    {isSending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                      : <><Send className="w-4 h-4 mr-2" /> Send to {recipientCount} {recipientCount === 1 ? "recipient" : "recipients"}</>}
                  </Button>
                </CardContent>
              </Card>
              {testCard}
            </div>
            {previewCard}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> System emails</CardTitle>
                  <CardDescription className="text-xs">
                    The automatic emails members receive — signups, resets, payments and more
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Email</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger><SelectValue placeholder="Choose an email" /></SelectTrigger>
                      <SelectContent>
                        {(templates.length ? templates : [{ key: "signup_confirmation", label: "Signup confirmation" }]).map((t) => (
                          <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    These send automatically through Resend. Change their look on the Branding page.
                  </p>
                </CardContent>
              </Card>
              {testCard}
            </div>
            {previewCard}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends the email to <strong>{recipientCount}</strong> {recipientLabel}. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}

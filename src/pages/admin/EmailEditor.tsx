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
import { Mail, Loader2, Send, Users, Newspaper, User, Eye, X, TestTube, ShieldCheck, UserPlus, CreditCard, Paintbrush, RotateCcw, Trophy, PenTool, CheckCircle, Clock, Wrench, Bell, Upload, ImageIcon } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useRef } from "react";

type RecipientType = "all_users" | "subscribers" | "specific";
type EmailTemplateType = "custom" | "otp" | "welcome" | "subscription" | "game_day" | "writer_approval" | "writer_revoked" | "email_confirm" | "sub_expiry" | "maintenance";

interface RecipientCounts {
  allUsers: number;
  subscribers: number;
}

const DEFAULT_LOGO_URL = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png';

interface EmailStyle {
  logoWidth: number;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  cardBgColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  borderRadius: number;
  emojis: {
    game_day: string;
    writer_approval: string;
    writer_revoked: string;
    email_confirm: string;
    sub_expiry: string;
    maintenance: string;
  };
}

const DEFAULT_STYLE: EmailStyle = {
  logoWidth: 85,
  logoUrl: DEFAULT_LOGO_URL,
  primaryColor: "#002D72",
  accentColor: "#FF5910",
  bgColor: "#0a0a0a",
  cardBgColor: "#1a1a2e",
  textColor: "#ffffff",
  mutedTextColor: "#a0a0a0",
  borderColor: "#2a2a3e",
  borderRadius: 8,
  emojis: {
    game_day: "⚾",
    writer_approval: "🎉",
    writer_revoked: "📝",
    email_confirm: "✉️",
    sub_expiry: "⏰",
    maintenance: "🔧",
  },
};

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const getEmailHeader = (style: EmailStyle, logoUrl?: string) => `
  <div style="text-align: center; margin-bottom: 16px;">
    <img src="${logoUrl || style.logoUrl}" alt="MetsXMFanZone" style="width: ${style.logoWidth}px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
    <div>
      <span style="color: ${style.primaryColor}; font-size: 18px; font-weight: bold;">Mets</span><span style="color: ${style.accentColor}; font-size: 18px; font-weight: bold;">XM</span><span style="color: ${style.textColor}; font-size: 18px; font-weight: bold;">FanZone</span>
    </div>
  </div>
`;

const getEmailFooter = (style: EmailStyle) => `
  <div style="border-top: 1px solid ${style.borderColor}; padding-top: 12px;">
    <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">
      The MetsXMFanZone Team
    </p>
    <div style="text-align: center; margin-bottom: 8px;">
      <a href="https://www.facebook.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook" style="width: 20px; height: 20px; opacity: 0.7;" />
      </a>
      <a href="https://twitter.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733579.png" alt="Twitter" style="width: 20px; height: 20px; opacity: 0.7;" />
      </a>
      <a href="https://www.instagram.com/MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" alt="Instagram" style="width: 20px; height: 20px; opacity: 0.7;" />
      </a>
      <a href="https://www.youtube.com/@MetsXMFanZone" style="display: inline-block; margin: 0 6px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733646.png" alt="YouTube" style="width: 20px; height: 20px; opacity: 0.7;" />
      </a>
    </div>
    <p style="color: #444; font-size: 9px; text-align: center; margin: 0;">
      <a href="https://metsxmfanzone.com" style="color: ${style.accentColor}; text-decoration: none;">metsxmfanzone.com</a>
    </p>
  </div>
`;

// ─── Template Generators ────────────────────────────────────

const generateOtpEmailHtml = (otp: string, style: EmailStyle) => {
  const safeOtp = escapeHtml(otp);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 12px;">Your verification code:</p>
    <div style="background: ${style.primaryColor}; padding: 12px 16px; text-align: center; border-radius: 6px; margin-bottom: 12px;">
      <span style="font-size: 24px; font-weight: bold; letter-spacing: 6px; color: ${style.textColor}; font-family: 'Courier New', monospace;">${safeOtp}</span>
    </div>
    <p style="color: #666; text-align: center; font-size: 11px; margin: 0 0 12px;">Expires in <strong style="color: ${style.accentColor};">5 min</strong></p>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateWelcomeEmailHtml = (name: string, style: EmailStyle) => {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Welcome, ${safeName}!</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Your account has been created successfully.</p>
    <div style="background: ${style.primaryColor}; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
      <p style="color: ${style.textColor}; font-size: 11px; margin: 0 0 8px; font-weight: bold;">What's Next:</p>
      <ul style="color: #d0d0d0; font-size: 10px; margin: 0; padding-left: 16px;">
        <li style="margin-bottom: 4px;">Choose a subscription plan</li>
        <li style="margin-bottom: 4px;">Watch live streams</li>
        <li style="margin-bottom: 4px;">Connect with fans</li>
      </ul>
    </div>
    <p style="color: ${style.accentColor}; text-align: center; font-size: 12px; font-weight: bold; margin: 0 0 12px;">Let's Go Mets!</p>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateSubscriptionEmailHtml = (name: string, planName: string, amount: string, style: EmailStyle) => {
  const safeName = escapeHtml(name);
  const safePlanName = escapeHtml(planName);
  const safeAmount = escapeHtml(amount);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <p style="color: #4ade80; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Payment Successful!</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Hi ${safeName}, your subscription is active.</p>
    <div style="background: ${style.primaryColor}; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color: ${style.mutedTextColor}; font-size: 11px; padding: 3px 0;">Plan:</td><td style="color: ${style.textColor}; font-size: 11px; font-weight: bold; text-align: right;">${safePlanName}</td></tr>
        <tr><td style="color: ${style.mutedTextColor}; font-size: 11px; padding: 3px 0;">Amount:</td><td style="color: ${style.textColor}; font-size: 11px; font-weight: bold; text-align: right;">$${safeAmount}</td></tr>
        <tr><td style="color: ${style.mutedTextColor}; font-size: 11px; padding: 3px 0;">Status:</td><td style="color: #4ade80; font-size: 11px; font-weight: bold; text-align: right;">Active</td></tr>
      </table>
    </div>
    <div style="background: #1f1f3a; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
      <p style="color: ${style.accentColor}; font-size: 10px; margin: 0 0 6px; font-weight: bold;">Your Benefits:</p>
      <p style="color: #d0d0d0; font-size: 10px; margin: 0; line-height: 1.4;">Live streams • Replays • Premium content • Ad-free</p>
    </div>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateGameDayEmailHtml = (opponent: string, gameDate: string, gameTime: string, style: EmailStyle) => {
  const safeOpponent = escapeHtml(opponent);
  const safeDate = escapeHtml(gameDate);
  const safeTime = escapeHtml(gameTime);

  const MLB_TEAM_IDS: Record<string, number> = {
    'braves': 144, 'phillies': 143, 'nationals': 120, 'marlins': 146,
    'cubs': 112, 'reds': 113, 'brewers': 158, 'pirates': 134, 'cardinals': 138,
    'dodgers': 119, 'padres': 135, 'giants': 137, 'diamondbacks': 109, 'rockies': 115,
    'yankees': 147, 'red sox': 111, 'rays': 139, 'blue jays': 141, 'orioles': 110,
    'guardians': 114, 'tigers': 116, 'royals': 118, 'twins': 142, 'white sox': 145,
    'astros': 117, 'angels': 108, 'athletics': 133, 'mariners': 136, 'rangers': 140,
  };
  const opponentKey = opponent.toLowerCase().trim();
  const opponentTeamId = MLB_TEAM_IDS[opponentKey];
  const metsLogoUrl = 'https://midfield.mlbstatic.com/v1/team/121/spots/72';
  const opponentLogoUrl = opponentTeamId ? `https://midfield.mlbstatic.com/v1/team/${opponentTeamId}/spots/72` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.primaryColor};">
  <div style="max-width: 420px; margin: 0 auto; padding: 20px 12px;">
    <div style="text-align: center; padding: 24px 0 16px 0;">
      <img src="${style.logoUrl}" alt="MetsXMFanZone" width="${style.logoWidth}" style="width: ${style.logoWidth}px; height: auto; display: block; margin: 0 auto 8px auto; border-radius: 12px;" />
      <span style="color: ${style.accentColor}; font-size: 18px; font-weight: 800;">MetsXMFanZone</span>
    </div>
    <div style="background: linear-gradient(180deg, #141a2e 0%, #0d1222 100%); border: 1px solid rgba(255,69,0,0.25); border-radius: 16px; padding: 28px 20px; margin-bottom: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
      ${opponentLogoUrl ? `
      <div style="text-align: center; padding: 16px 0 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 auto; max-width: 280px;">
          <tr>
            <td width="40%" style="text-align: center; vertical-align: middle;">
              <img src="${metsLogoUrl}" alt="New York Mets" width="64" height="64" style="width: 64px; height: 64px; display: block; margin: 0 auto;" />
              <div style="color: #ffffff; font-size: 11px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;">Mets</div>
            </td>
            <td width="20%" style="text-align: center; vertical-align: middle;">
              <div style="color: #FF4500; font-size: 20px; font-weight: 900; letter-spacing: 2px;">VS</div>
            </td>
            <td width="40%" style="text-align: center; vertical-align: middle;">
              <img src="${opponentLogoUrl}" alt="${safeOpponent}" width="64" height="64" style="width: 64px; height: 64px; display: block; margin: 0 auto;" />
              <div style="color: #ffffff; font-size: 11px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;">${safeOpponent}</div>
            </td>
          </tr>
        </table>
      </div>` : ''}
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 36px; margin-bottom: 12px;">${style.emojis.game_day}</div>
        <h1 style="color: white; font-size: 20px; font-weight: 800; margin: 0 0 8px 0;">Game Day Alert!</h1>
      </div>
      <div style="background: #0a0e1a; border: 1px solid rgba(255,69,0,0.3); border-radius: 12px; padding: 18px; margin: 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Opponent</td><td style="color: white; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">${safeOpponent}</td></tr>
          <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Date</td><td style="color: white; font-size: 13px; padding: 4px 0; text-align: right;">${safeDate}</td></tr>
          <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">First Pitch</td><td style="color: #FF4500; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 700;">${safeTime}</td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://metsxmfanzone.com" style="display: inline-block; background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">Open MetsXMFanZone</a>
      </div>
    </div>
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.08);">
      <p style="color: #6B7280; font-size: 10px; margin: 0;">&copy; ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.</p>
    </div>
  </div>
</body></html>`;
};

const generateWriterApprovalHtml = (writerName: string, style: EmailStyle) => {
  const safeName = escapeHtml(writerName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 32px;">${style.emojis.writer_approval}</span></div>
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Congratulations, ${safeName}!</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Your writer application has been <strong style="color: #4ade80;">approved</strong>! You can now publish articles on MetsXMFanZone.</p>
    <div style="text-align: center; margin-bottom: 16px;">
      <a href="https://metsxmfanzone.com/writer/dashboard" style="display: inline-block; background: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 13px;">Start Writing</a>
    </div>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateWriterRevokedHtml = (writerName: string, style: EmailStyle) => {
  const safeName = escapeHtml(writerName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 32px;">${style.emojis.writer_revoked}</span></div>
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Writer Access Update</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Hi ${safeName}, your writer privileges have been <strong style="color: #ef4444;">revoked</strong>. If you believe this is an error, please contact our support team.</p>
    <div style="text-align: center; margin-bottom: 16px;">
      <a href="https://metsxmfanzone.com/contact" style="display: inline-block; background: ${style.primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 13px;">Contact Support</a>
    </div>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateEmailConfirmHtml = (userName: string, style: EmailStyle) => {
  const safeName = escapeHtml(userName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 32px;">${style.emojis.email_confirm}</span></div>
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Confirm Your Email</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Hi ${safeName}, please click the button below to verify your email address.</p>
    <div style="text-align: center; margin-bottom: 16px;">
      <a href="#" style="display: inline-block; background: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 13px;">Verify Email</a>
    </div>
    <p style="color: #666; text-align: center; font-size: 10px; margin: 0 0 12px;">This link expires in 24 hours.</p>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateSubExpiryHtml = (userName: string, planName: string, daysLeft: string, style: EmailStyle) => {
  const safeName = escapeHtml(userName);
  const safePlan = escapeHtml(planName);
  const safeDays = escapeHtml(daysLeft);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 32px;">${style.emojis.sub_expiry}</span></div>
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Subscription Expiring Soon</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;">Hi ${safeName}, your <strong style="color: ${style.textColor};">${safePlan}</strong> plan expires in <strong style="color: ${style.accentColor};">${safeDays} days</strong>.</p>
    <div style="background: ${style.primaryColor}; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
      <p style="color: ${style.mutedTextColor}; font-size: 10px; margin: 0 0 6px;">You'll lose access to:</p>
      <p style="color: #d0d0d0; font-size: 10px; margin: 0; line-height: 1.6;">• Live streams & replays<br/>• Premium content<br/>• Ad-free experience</p>
    </div>
    <div style="text-align: center; margin-bottom: 16px;">
      <a href="https://metsxmfanzone.com/plans" style="display: inline-block; background: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 13px;">Renew Now</a>
    </div>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

const generateMaintenanceHtml = (issueCount: string, style: EmailStyle) => {
  const safeCount = escapeHtml(issueCount);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: ${style.bgColor};">
  <div style="max-width: 320px; margin: 0 auto; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; padding: 20px; border: 1px solid ${style.borderColor};">
    ${getEmailHeader(style)}
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 32px;">${style.emojis.maintenance}</span></div>
    <p style="color: ${style.textColor}; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Stream Health Report</p>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 12px; margin: 0 0 16px;"><strong style="color: #ef4444;">${safeCount} issue(s)</strong> detected with live streams that require attention.</p>
    <div style="background: #1f1f3a; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
      <p style="color: ${style.accentColor}; font-size: 10px; margin: 0 0 6px; font-weight: bold;">Common Issues:</p>
      <p style="color: #d0d0d0; font-size: 10px; margin: 0; line-height: 1.6;">• Stream buffering / low bitrate<br/>• Audio sync issues<br/>• Connection drops</p>
    </div>
    <div style="text-align: center; margin-bottom: 16px;">
      <a href="https://metsxmfanzone.com/admin/stream-health" style="display: inline-block; background: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 13px;">View Dashboard</a>
    </div>
    ${getEmailFooter(style)}
  </div>
</body></html>`;
};

// ─── Template metadata ──────────────────────────────────────

const TEMPLATE_META: Record<EmailTemplateType, { label: string; icon: typeof Mail; description: string }> = {
  custom: { label: "Custom", icon: Mail, description: "Send custom emails to users" },
  otp: { label: "2FA Code", icon: ShieldCheck, description: "OTP verification code email" },
  welcome: { label: "Welcome", icon: UserPlus, description: "Sent on new account creation" },
  subscription: { label: "Payment", icon: CreditCard, description: "Payment confirmation email" },
  game_day: { label: "Game Day", icon: Trophy, description: "Game alert with VS logos" },
  writer_approval: { label: "Writer ✓", icon: PenTool, description: "Writer application approved" },
  writer_revoked: { label: "Writer ✗", icon: PenTool, description: "Writer access revoked" },
  email_confirm: { label: "Confirm", icon: CheckCircle, description: "Email address verification" },
  sub_expiry: { label: "Expiry", icon: Clock, description: "Subscription expiring soon" },
  maintenance: { label: "Health", icon: Wrench, description: "Stream health report" },
};

export default function EmailEditor() {
  const [activeTab, setActiveTab] = useState<EmailTemplateType>("custom");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("all_users");
  const [specificEmails, setSpecificEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [recipientCounts, setRecipientCounts] = useState<RecipientCounts>({ allUsers: 0, subscribers: 0 });
  const [testEmail, setTestEmail] = useState("");
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [emailStyle, setEmailStyle] = useState<EmailStyle>({ ...DEFAULT_STYLE });
  const [emojiSaveStatus, setEmojiSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [emojisChanged, setEmojisChanged] = useState(false);

  // Template preview fields
  const [otpCode, setOtpCode] = useState("123456");
  const [welcomeName, setWelcomeName] = useState("Mets Fan");
  const [subscriptionName, setSubscriptionName] = useState("Mets Fan");
  const [subscriptionPlan, setSubscriptionPlan] = useState("Premium Monthly");
  const [subscriptionAmount, setSubscriptionAmount] = useState("4.99");
  const [gameOpponent, setGameOpponent] = useState("Braves");
  const [gameDate, setGameDate] = useState("March 28, 2026");
  const [gameTime, setGameTime] = useState("7:10 PM ET");
  const [writerName, setWriterName] = useState("John Doe");
  const [confirmName, setConfirmName] = useState("Mets Fan");
  const [expiryName, setExpiryName] = useState("Mets Fan");
  const [expiryPlan, setExpiryPlan] = useState("Premium Monthly");
  const [expiryDays, setExpiryDays] = useState("3");
  const [maintenanceCount, setMaintenanceCount] = useState("2");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid File", description: "Please upload a PNG, JPG, WebP, or GIF image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `email-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('email-assets').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      setEmailStyle(s => ({ ...s, logoUrl: publicUrl }));
      toast({ title: "Logo Uploaded", description: "Email logo updated successfully." });
    } catch (err: any) {
      console.error("Logo upload error:", err);
      toast({ title: "Upload Failed", description: err.message || "Could not upload logo.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // Load saved emoji settings from site_settings
  useEffect(() => {
    const loadEmojiSettings = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('setting_value')
          .eq('setting_key', 'email_emojis')
          .maybeSingle();
        if (data?.setting_value && typeof data.setting_value === 'object') {
          const saved = data.setting_value as Record<string, string>;
          setEmailStyle(s => ({
            ...s,
            emojis: { ...s.emojis, ...saved },
          }));
        }
      } catch (err) {
        console.error('Failed to load emoji settings:', err);
      }
    };
    loadEmojiSettings();
  }, []);

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
        console.error("Error fetching counts:", error);
      }
    };
    fetchCounts();
  }, []);

  const saveEmojiSettings = async () => {
    setEmojiSaveStatus('saving');
    try {
      const { data: existing } = await supabase
        .from('site_settings')
        .select('id')
        .eq('setting_key', 'email_emojis')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('site_settings')
          .update({ setting_value: emailStyle.emojis as unknown as Record<string, string>, updated_at: new Date().toISOString() })
          .eq('setting_key', 'email_emojis');
      } else {
        await supabase
          .from('site_settings')
          .insert({ setting_key: 'email_emojis', setting_type: 'json', setting_value: emailStyle.emojis as unknown as Record<string, string> });
      }

      setEmojiSaveStatus('saved');
      setEmojisChanged(false);
      toast({ title: "Emojis Saved ✓", description: "Template emojis updated successfully." });
      setTimeout(() => setEmojiSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to save emoji settings:', err);
      setEmojiSaveStatus('idle');
      toast({ title: "Save Failed", description: err.message || "Could not save emoji settings.", variant: "destructive" });
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && !specificEmails.includes(email) && email.includes("@")) {
      setSpecificEmails([...specificEmails, email]);
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setSpecificEmails(specificEmails.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  const getRecipientCount = () => {
    switch (recipientType) {
      case "all_users": return recipientCounts.allUsers;
      case "subscribers": return recipientCounts.subscribers;
      case "specific": return specificEmails.length;
      default: return 0;
    }
  };

  const getRecipientLabel = () => {
    switch (recipientType) {
      case "all_users": return "All Registered Users";
      case "subscribers": return "Newsletter Subscribers";
      case "specific": return "Specific Recipients";
      default: return "";
    }
  };

  const getCurrentEmailHtml = (): string => {
    switch (activeTab) {
      case "otp": return generateOtpEmailHtml(otpCode, emailStyle);
      case "welcome": return generateWelcomeEmailHtml(welcomeName, emailStyle);
      case "subscription": return generateSubscriptionEmailHtml(subscriptionName, subscriptionPlan, subscriptionAmount, emailStyle);
      case "game_day": return generateGameDayEmailHtml(gameOpponent, gameDate, gameTime, emailStyle);
      case "writer_approval": return generateWriterApprovalHtml(writerName, emailStyle);
      case "writer_revoked": return generateWriterRevokedHtml(writerName, emailStyle);
      case "email_confirm": return generateEmailConfirmHtml(confirmName, emailStyle);
      case "sub_expiry": return generateSubExpiryHtml(expiryName, expiryPlan, expiryDays, emailStyle);
      case "maintenance": return generateMaintenanceHtml(maintenanceCount, emailStyle);
      case "custom":
      default: return content;
    }
  };

  const getCurrentSubject = (): string => {
    switch (activeTab) {
      case "otp": return "Your MetsXMFanZone Verification Code";
      case "welcome": return "Welcome to MetsXMFanZone.com";
      case "subscription": return `Payment Confirmed - ${subscriptionPlan} Plan`;
      case "game_day": return `⚾ Game Day: Mets vs ${gameOpponent}`;
      case "writer_approval": return "Your Writer Application is Approved!";
      case "writer_revoked": return "Writer Access Update - MetsXMFanZone";
      case "email_confirm": return "Confirm Your Email - MetsXMFanZone";
      case "sub_expiry": return `Your ${expiryPlan} Plan Expires in ${expiryDays} Days`;
      case "maintenance": return "⚠️ Stream Health Report - MetsXMFanZone";
      case "custom":
      default: return subject;
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address for testing", variant: "destructive" });
      return;
    }
    if (activeTab === "custom" && (!subject.trim() || !content.trim())) {
      toast({ title: "Required Fields", description: "Please enter both subject and content before sending a test email", variant: "destructive" });
      return;
    }
    setIsSendingTest(true);
    try {
      if (activeTab === "otp") {
        const { error } = await supabase.functions.invoke("send-otp-email", { body: { to: testEmail, otp: otpCode } });
        if (error) throw error;
      } else if (activeTab === "welcome") {
        const { error } = await supabase.functions.invoke("send-confirmation-email", { body: { type: "welcome", email: testEmail, name: welcomeName } });
        if (error) throw error;
      } else if (activeTab === "subscription") {
        const { error } = await supabase.functions.invoke("send-confirmation-email", { body: { type: "subscription", email: testEmail, name: subscriptionName, planType: subscriptionPlan.toLowerCase().includes("annual") ? "annual" : "premium", amount: subscriptionAmount } });
        if (error) throw error;
      } else if (activeTab === "game_day") {
        const { error } = await supabase.functions.invoke("send-game-notification-email", {
          body: {
            title: `Game Day: Mets vs ${gameOpponent}`,
            message: `The Mets take on the ${gameOpponent} today!`,
            notificationType: "game_alert",
            gameInfo: { opponent: gameOpponent, date: gameDate, time: gameTime },
            targetUsers: [],
          }
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("send-user-email", {
          body: { subject: getCurrentSubject(), content: getCurrentEmailHtml(), recipientType: "specific", specificEmails: [testEmail] },
        });
        if (error) throw error;
      }
      toast({ title: "Test Email Sent!", description: `Test email sent to ${testEmail}` });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({ title: "Send Failed", description: error.message || "Failed to send test email", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSend = async () => {
    if (activeTab === "custom" && (!subject.trim() || !content.trim())) {
      toast({ title: "Required Fields", description: "Please enter both subject and content before sending", variant: "destructive" });
      return;
    }
    if (recipientType === "specific" && specificEmails.length === 0) {
      toast({ title: "No Recipients", description: "Please add at least one email address", variant: "destructive" });
      return;
    }
    setShowSendDialog(true);
  };

  const confirmSend = async () => {
    setShowSendDialog(false);
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-user-email", {
        body: { subject: getCurrentSubject(), content: getCurrentEmailHtml(), recipientType, specificEmails: recipientType === "specific" ? specificEmails : undefined },
      });
      if (error) throw error;
      toast({ title: "Email Campaign Sent!", description: `Successfully sent to ${data.sent} of ${data.total} recipients` });
      if (activeTab === "custom") { setSubject(""); setContent(""); }
      setSpecificEmails([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({ title: "Send Failed", description: error.message || "Failed to send email", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const emailTemplates = [
    { name: "Welcome Message", subject: "Welcome to MetsXMFanZone!", content: `<h1 style="color: #002D72;">Welcome to MetsXMFanZone, {{name}}!</h1><p>We're thrilled to have you join our community.</p>` },
    { name: "New Content Alert", subject: "New Content Available on MetsXMFanZone", content: `<h1 style="color: #002D72;">Hey {{name}}, check out what's new!</h1><p>New podcast episodes, highlights, and more.</p>` },
    { name: "Live Stream Reminder", subject: "🔴 Live Stream Starting Soon!", content: `<h1 style="color: #002D72;">{{name}}, we're going live!</h1><p>Join us for exclusive coverage.</p>` },
  ];

  const loadTemplate = (template: typeof emailTemplates[0]) => {
    setSubject(template.subject);
    setContent(template.content);
    toast({ title: "Template Loaded", description: `"${template.name}" template has been loaded` });
  };

  const resetStyle = () => {
    setEmailStyle({ ...DEFAULT_STYLE });
    toast({ title: "Style Reset", description: "Email styling restored to defaults" });
  };

  // ─── Reusable preview layout ──────────────────────────────

  const TemplatePreviewLayout = ({ children, previewHtml }: { children: React.ReactNode; previewHtml: string }) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {(() => { const Icon = TEMPLATE_META[activeTab].icon; return <Icon className="w-4 h-4" />; })()}
            {TEMPLATE_META[activeTab].label} Email
          </CardTitle>
          <CardDescription className="text-xs">{TEMPLATE_META[activeTab].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <Button onClick={() => setShowPreview(true)} variant="outline" size="sm" className="w-full">
            <Eye className="w-4 h-4 mr-2" /> Full Preview
          </Button>
        </CardContent>
      </Card>
      <Card className="bg-[#0a0a0a] border-[#2a2a3e] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[500px]">
          <div className="scale-[0.85] origin-top-left" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </CardContent>
      </Card>
    </div>
  );

  const StylePanel = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Paintbrush className="w-4 h-4" /> Style Editor</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetStyle} className="h-7 px-2"><RotateCcw className="w-3 h-3 mr-1" /><span className="text-xs">Reset</span></Button>
        </div>
        <CardDescription className="text-xs">Tweak colors, sizing & borders live</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Email Logo</Label>
          <div className="flex items-center gap-3">
            <img src={emailStyle.logoUrl} alt="Current logo" className="w-12 h-12 rounded-lg border border-border object-cover bg-muted" />
            <div className="flex-1 space-y-1">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={isUploadingLogo}
                onClick={() => { if (logoInputRef.current) { logoInputRef.current.value = ''; logoInputRef.current.click(); } }}
              >
                {isUploadingLogo ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</> : <><Upload className="w-3 h-3 mr-1" /> Upload Logo</>}
              </Button>
              {emailStyle.logoUrl !== DEFAULT_LOGO_URL && (
                <Button variant="ghost" size="sm" className="w-full text-xs h-6" onClick={() => setEmailStyle(s => ({ ...s, logoUrl: DEFAULT_LOGO_URL }))}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset to Default
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Logo Size: {emailStyle.logoWidth}px</Label>
          <Slider value={[emailStyle.logoWidth]} onValueChange={([v]) => setEmailStyle(s => ({ ...s, logoWidth: v }))} min={40} max={120} step={5} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Border Radius: {emailStyle.borderRadius}px</Label>
          <Slider value={[emailStyle.borderRadius]} onValueChange={([v]) => setEmailStyle(s => ({ ...s, borderRadius: v }))} min={0} max={24} step={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "primaryColor" as const, label: "Primary" },
            { key: "accentColor" as const, label: "Accent" },
            { key: "bgColor" as const, label: "Background" },
            { key: "cardBgColor" as const, label: "Card BG" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={emailStyle[key]} onChange={e => setEmailStyle(s => ({ ...s, [key]: e.target.value }))} className="w-8 h-8 rounded border border-border cursor-pointer" />
                <span className="text-xs text-muted-foreground font-mono">{emailStyle[key]}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Emoji Icons */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">Template Emojis</Label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "game_day" as const, label: "Game Day" },
              { key: "writer_approval" as const, label: "Approved" },
              { key: "writer_revoked" as const, label: "Revoked" },
              { key: "email_confirm" as const, label: "Confirm" },
              { key: "sub_expiry" as const, label: "Expiry" },
              { key: "maintenance" as const, label: "Health" },
            ]).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{label}</Label>
                <Input
                  value={emailStyle.emojis[key]}
                  onChange={e => {
                    setEmailStyle(s => ({ ...s, emojis: { ...s.emojis, [key]: e.target.value } }));
                    setEmojisChanged(true);
                    setEmojiSaveStatus('idle');
                  }}
                  className="h-8 text-center text-lg px-1"
                  maxLength={4}
                />
              </div>
            ))}
          </div>
          <Button
            onClick={saveEmojiSettings}
            disabled={!emojisChanged || emojiSaveStatus === 'saving'}
            size="sm"
            variant={emojiSaveStatus === 'saved' ? 'outline' : 'default'}
            className="w-full mt-2"
          >
            {emojiSaveStatus === 'saving' ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</>
            ) : emojiSaveStatus === 'saved' ? (
              <><CheckCircle className="w-3 h-3 mr-1 text-green-500" /> Saved ✓</>
            ) : (
              <><Upload className="w-3 h-3 mr-1" /> Save Emojis</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Email Templates</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Preview, test & manage all email templates ({Object.keys(TEMPLATE_META).length} types)
          </p>
        </div>
        <Button variant={showStylePanel ? "default" : "outline"} size="sm" onClick={() => setShowStylePanel(!showStylePanel)}>
          <Paintbrush className="w-4 h-4 mr-1" /> Style
        </Button>
      </div>

      {showStylePanel && <div className="mb-4"><StylePanel /></div>}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EmailTemplateType)} className="space-y-4">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max gap-1 p-1">
            {(Object.entries(TEMPLATE_META) as [EmailTemplateType, typeof TEMPLATE_META[EmailTemplateType]][]).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <TabsTrigger key={key} value={key} className="text-xs whitespace-nowrap px-3">
                  <Icon className="w-3 h-3 mr-1.5" />
                  {meta.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Test Email - all tabs */}
        <Card className="border-dashed border-2 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TestTube className="w-4 h-4" /> Send Test Email</CardTitle>
            <CardDescription className="text-xs">Test the current template before sending to users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input type="email" placeholder="Enter test email address" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1 text-sm" />
              <Button onClick={sendTestEmail} size="sm" variant="secondary" disabled={isSendingTest || !testEmail.trim()}>
                {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Test</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── OTP ─── */}
        <TabsContent value="otp">
          <TemplatePreviewLayout previewHtml={generateOtpEmailHtml(otpCode || "123456", emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">OTP Code (Preview)</Label>
              <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" maxLength={6} className="font-mono text-lg tracking-widest" />
              <p className="text-xs text-muted-foreground">Preview only. Actual OTP codes are generated automatically.</p>
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Welcome ─── */}
        <TabsContent value="welcome">
          <TemplatePreviewLayout previewHtml={generateWelcomeEmailHtml(welcomeName || "Mets Fan", emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">User Name (Preview)</Label>
              <Input value={welcomeName} onChange={(e) => setWelcomeName(e.target.value)} placeholder="Mets Fan" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Payment ─── */}
        <TabsContent value="subscription">
          <TemplatePreviewLayout previewHtml={generateSubscriptionEmailHtml(subscriptionName || "Mets Fan", subscriptionPlan, subscriptionAmount || "4.99", emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">User Name</Label>
              <Input value={subscriptionName} onChange={(e) => setSubscriptionName(e.target.value)} placeholder="Mets Fan" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Plan</Label>
              <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Premium Monthly">Premium Monthly</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Amount</Label>
              <Input value={subscriptionAmount} onChange={(e) => setSubscriptionAmount(e.target.value)} placeholder="4.99" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Game Day ─── */}
        <TabsContent value="game_day">
          <TemplatePreviewLayout previewHtml={generateGameDayEmailHtml(gameOpponent, gameDate, gameTime, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">Opponent</Label>
              <Select value={gameOpponent} onValueChange={setGameOpponent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Braves", "Phillies", "Nationals", "Marlins", "Yankees", "Red Sox", "Dodgers", "Cubs", "Cardinals", "Padres", "Astros", "Guardians", "Twins", "Rays", "Orioles", "Tigers", "Royals", "Brewers", "Reds", "Pirates", "Giants", "Diamondbacks", "Rockies", "White Sox", "Angels", "Athletics", "Mariners", "Rangers", "Blue Jays"].map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Game Date</Label>
              <Input value={gameDate} onChange={(e) => setGameDate(e.target.value)} placeholder="March 28, 2026" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">First Pitch</Label>
              <Input value={gameTime} onChange={(e) => setGameTime(e.target.value)} placeholder="7:10 PM ET" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Writer Approval ─── */}
        <TabsContent value="writer_approval">
          <TemplatePreviewLayout previewHtml={generateWriterApprovalHtml(writerName, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">Writer Name</Label>
              <Input value={writerName} onChange={(e) => setWriterName(e.target.value)} placeholder="John Doe" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Writer Revoked ─── */}
        <TabsContent value="writer_revoked">
          <TemplatePreviewLayout previewHtml={generateWriterRevokedHtml(writerName, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">Writer Name</Label>
              <Input value={writerName} onChange={(e) => setWriterName(e.target.value)} placeholder="John Doe" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Email Confirmation ─── */}
        <TabsContent value="email_confirm">
          <TemplatePreviewLayout previewHtml={generateEmailConfirmHtml(confirmName, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">User Name</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Mets Fan" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Subscription Expiry ─── */}
        <TabsContent value="sub_expiry">
          <TemplatePreviewLayout previewHtml={generateSubExpiryHtml(expiryName, expiryPlan, expiryDays, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">User Name</Label>
              <Input value={expiryName} onChange={(e) => setExpiryName(e.target.value)} placeholder="Mets Fan" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Plan</Label>
              <Select value={expiryPlan} onValueChange={setExpiryPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Premium Monthly">Premium Monthly</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Days Left</Label>
              <Input value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} placeholder="3" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Maintenance / Health ─── */}
        <TabsContent value="maintenance">
          <TemplatePreviewLayout previewHtml={generateMaintenanceHtml(maintenanceCount, emailStyle)}>
            <div className="space-y-2">
              <Label className="text-sm">Issue Count</Label>
              <Input value={maintenanceCount} onChange={(e) => setMaintenanceCount(e.target.value)} placeholder="2" />
            </div>
          </TemplatePreviewLayout>
        </TabsContent>

        {/* ─── Custom Email ─── */}
        <TabsContent value="custom" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Mail className="w-4 h-4" /> Compose Email</CardTitle>
                  <CardDescription className="text-xs">Use {"{{name}}"} to personalize with recipient's name</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Recipients</Label>
                    <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_users"><div className="flex items-center gap-2"><Users className="w-4 h-4" /> All Users ({recipientCounts.allUsers})</div></SelectItem>
                        <SelectItem value="subscribers"><div className="flex items-center gap-2"><Newspaper className="w-4 h-4" /> Subscribers ({recipientCounts.subscribers})</div></SelectItem>
                        <SelectItem value="specific"><div className="flex items-center gap-2"><User className="w-4 h-4" /> Specific</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {recipientType === "specific" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Add Email Addresses</Label>
                      <div className="flex gap-2">
                        <Input type="email" placeholder="Enter email and press Enter" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 text-sm" />
                        <Button type="button" onClick={addEmail} size="sm">Add</Button>
                      </div>
                      {specificEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
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
                    <Label htmlFor="content" className="text-sm">Email Content (HTML) *</Label>
                    <Textarea id="content" placeholder="Write your email content here using HTML..." value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="text-sm font-mono" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button onClick={() => setShowPreview(true)} variant="outline" size="sm" disabled={!content.trim()} className="flex-1">
                      <Eye className="w-4 h-4 mr-2" /> Preview
                    </Button>
                    <Button onClick={handleSend} variant="default" size="sm" disabled={isSending || !subject.trim() || !content.trim() || getRecipientCount() === 0} className="flex-1">
                      {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send to {getRecipientCount()} {getRecipientCount() === 1 ? "recipient" : "recipients"}</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quick Templates</CardTitle>
                  <CardDescription className="text-xs">Click to load a template</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {emailTemplates.map((template, index) => (
                    <Button key={index} variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => loadTemplate(template)}>
                      {template.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Personalization</CardTitle>
                  <CardDescription className="text-xs">Available variables</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded block">{"{{name}}"} - Recipient's name</code>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">{"{{email}}"} - Recipient's email</code>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Email Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the email to <strong>{getRecipientCount()}</strong> {getRecipientLabel().toLowerCase()}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>Send Email</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
        <AlertDialogContent className="max-w-md max-h-[90vh] overflow-auto bg-[#0a0a0a] border-[#2a2a3e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Email Preview</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Subject:</strong> {getCurrentSubject() || "(No subject)"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                activeTab === "custom"
                  ? content.replace(/\{\{name\}\}/g, "John Doe").replace(/\{\{email\}\}/g, "johndoe@example.com")
                  : getCurrentEmailHtml(),
                {
                  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'img', 'div', 'span', 'table', 'tr', 'td', 'th'],
                  ALLOWED_ATTR: ['href', 'src', 'style', 'alt', 'width', 'height', 'cellpadding', 'cellspacing'],
                  ALLOW_DATA_ATTR: false,
                }
              )
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

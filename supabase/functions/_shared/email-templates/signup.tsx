/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export interface EmailStyleProps {
  logoUrl?: string
  primaryColor?: string
  cardBgColor?: string
  bodyBgColor?: string
  headingColor?: string
  textColor?: string
  footerText?: string
  buttonBorderRadius?: string
  logoWidth?: number
}

interface SignupEmailProps extends EmailStyleProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  logoUrl = 'https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png',
  primaryColor = '#FF5910',
  cardBgColor = '#1a1a2e',
  bodyBgColor = '#0a0a0a',
  headingColor = '#ffffff',
  textColor = '#d1d5db',
  footerText = '© 2026 MetsXMFanZone — The Ultimate Mets Fan Community',
  buttonBorderRadius = '10px',
  logoWidth = 85,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>Welcome to {siteName} — Confirm your email to join the fan zone!</Preview>
    <Body style={{ backgroundColor: bodyBgColor, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '20px 0' }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Section style={{ textAlign: 'center' as const, padding: '30px 0 20px' }}>
          <Img src={logoUrl} width={String(logoWidth)} height={String(logoWidth)} alt="MetsXMFanZone" style={{ margin: '0 auto', borderRadius: '12px' }} />
        </Section>
        <Section style={{ backgroundColor: cardBgColor, borderRadius: '16px', padding: '32px 28px', margin: '0 16px', border: `1px solid ${primaryColor}33` }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold' as const, color: headingColor, margin: '0 0 20px', textAlign: 'center' as const }}>Welcome to the Fan Zone! 🏟️</Heading>
          <Text style={{ fontSize: '15px', color: textColor, lineHeight: '1.6', margin: '0 0 20px' }}>
            Hey there! Thanks for signing up for{' '}
            <Link href={siteUrl} style={{ color: primaryColor, textDecoration: 'underline' }}><strong>{siteName}</strong></Link>!
          </Text>
          <Text style={{ fontSize: '15px', color: textColor, lineHeight: '1.6', margin: '0 0 20px' }}>
            Please confirm your email address (<Link href={`mailto:${recipient}`} style={{ color: primaryColor, textDecoration: 'underline' }}>{recipient}</Link>) by clicking the button below:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button style={{ backgroundColor: primaryColor, color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: buttonBorderRadius, padding: '14px 32px', textDecoration: 'none' }} href={confirmationUrl}>
              Verify My Email
            </Button>
          </Section>
          <Text style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center' as const, margin: '0' }}>
            This link will expire in 24 hours.
          </Text>
        </Section>
        <Section style={{ padding: '24px 16px', textAlign: 'center' as const }}>
          <Text style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px', textAlign: 'center' as const }}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
          <Text style={{ fontSize: '11px', color: '#4b5563', margin: '0', textAlign: 'center' as const }}>{footerText}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

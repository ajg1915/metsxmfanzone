/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { EmailStyleProps } from './signup.tsx'

interface ReauthenticationEmailProps extends EmailStyleProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
  logoUrl = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png',
  primaryColor = '#FF5910',
  cardBgColor = '#1a1a2e',
  bodyBgColor = '#0a0a0a',
  headingColor = '#ffffff',
  textColor = '#d1d5db',
  footerText = '© 2026 MetsXMFanZone — The Ultimate Mets Fan Community',
  logoWidth = 85,
}: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>Your verification code</Preview>
    <Body style={{ backgroundColor: bodyBgColor, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '20px 0' }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Section style={{ textAlign: 'center' as const, padding: '30px 0 20px' }}>
          <Img src={logoUrl} width={String(logoWidth)} height={String(logoWidth)} alt="MetsXMFanZone" style={{ margin: '0 auto', borderRadius: '12px' }} />
        </Section>
        <Section style={{ backgroundColor: cardBgColor, borderRadius: '16px', padding: '32px 28px', margin: '0 16px', border: `1px solid ${primaryColor}33` }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold' as const, color: headingColor, margin: '0 0 20px', textAlign: 'center' as const }}>Confirm Your Identity 🔒</Heading>
          <Text style={{ fontSize: '15px', color: textColor, lineHeight: '1.6', margin: '0 0 20px', textAlign: 'center' as const }}>Use the code below to confirm your identity:</Text>
          <Text style={{ fontFamily: 'Courier, monospace', fontSize: '32px', fontWeight: 'bold' as const, color: primaryColor, margin: '0 0 24px', textAlign: 'center' as const, letterSpacing: '6px', backgroundColor: `${primaryColor}1a`, padding: '16px', borderRadius: '10px' }}>{token}</Text>
          <Text style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center' as const, margin: '0' }}>
            This code will expire shortly.
          </Text>
        </Section>
        <Section style={{ padding: '24px 16px', textAlign: 'center' as const }}>
          <Text style={{ fontSize: '11px', color: '#4b5563', margin: '0', textAlign: 'center' as const }}>{footerText}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

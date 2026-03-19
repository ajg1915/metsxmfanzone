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

interface ReauthenticationEmailProps {
  token: string
}

const LOGO_URL = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Img src={LOGO_URL} width="85" height="85" alt="MetsXMFanZone" style={logo} />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm Your Identity 🔒</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={subtext}>
            This code will expire shortly. If you didn't request this, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>
            © {new Date().getFullYear()} MetsXMFanZone — The Ultimate Mets Fan Community
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '20px 0',
}
const wrapper = { maxWidth: '600px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '30px 0 20px' }
const logo = { margin: '0 auto', borderRadius: '12px' }
const card = {
  backgroundColor: '#1a1a2e',
  borderRadius: '16px',
  padding: '32px 28px',
  margin: '0 16px',
  border: '1px solid rgba(255, 89, 16, 0.2)',
}
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 20px', textAlign: 'center' as const }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#FF5910',
  margin: '0 0 24px',
  textAlign: 'center' as const,
  letterSpacing: '6px',
  backgroundColor: 'rgba(255, 89, 16, 0.1)',
  padding: '16px',
  borderRadius: '10px',
}
const subtext = { fontSize: '13px', color: '#9ca3af', textAlign: 'center' as const, margin: '0' }
const footerSection = { padding: '24px 16px', textAlign: 'center' as const }
const footerBrand = { fontSize: '11px', color: '#4b5563', margin: '0', textAlign: 'center' as const }

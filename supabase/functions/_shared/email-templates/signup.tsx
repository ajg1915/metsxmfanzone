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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/metsxmfanzone-logo.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>Welcome to {siteName} — Confirm your email to join the fan zone!</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Img src={LOGO_URL} width="85" height="85" alt="MetsXMFanZone" style={logo} />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Welcome to the Fan Zone! 🏟️</Heading>
          <Text style={text}>
            Hey there! Thanks for signing up for{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            . You're one step away from joining the ultimate Mets fan community.
          </Text>
          <Text style={text}>
            Please confirm your email address (
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            ) by clicking the button below:
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={confirmationUrl}>
              Verify My Email
            </Button>
          </Section>
          <Text style={subtext}>
            This link will expire in 24 hours. If it expires, you can request a new one.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footer}>
            If you didn't create an account on {siteName}, you can safely ignore this email.
          </Text>
          <Text style={footerBrand}>
            © {new Date().getFullYear()} MetsXMFanZone — The Ultimate Mets Fan Community
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '20px 0',
}
const wrapper = {
  maxWidth: '600px',
  margin: '0 auto',
}
const header = {
  textAlign: 'center' as const,
  padding: '30px 0 20px',
}
const logo = {
  margin: '0 auto',
  borderRadius: '12px',
}
const card = {
  backgroundColor: '#1a1a2e',
  borderRadius: '16px',
  padding: '32px 28px',
  margin: '0 16px',
  border: '1px solid rgba(255, 89, 16, 0.2)',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const text = {
  fontSize: '15px',
  color: '#d1d5db',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#FF5910', textDecoration: 'underline' }
const buttonContainer = {
  textAlign: 'center' as const,
  margin: '28px 0',
}
const button = {
  backgroundColor: '#FF5910',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const subtext = {
  fontSize: '13px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '0',
}
const footerSection = {
  padding: '24px 16px',
  textAlign: 'center' as const,
}
const footer = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}
const footerBrand = {
  fontSize: '11px',
  color: '#4b5563',
  margin: '0',
  textAlign: 'center' as const,
}

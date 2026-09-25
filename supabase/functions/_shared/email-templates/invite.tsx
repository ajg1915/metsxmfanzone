/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { BrandFooter, BrandHeader } from './brand.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#0e1c43', color: '#d1d5db', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#0e1c43', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', margin: '0 auto', maxWidth: '560px', padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#d1d5db',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#FF5910', textDecoration: 'underline' }
const button = {
  backgroundColor: '#FF5910',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #FF5910',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#8b93a1', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #FF5910 !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #FF5910 !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #FF5910 !important; color: #ffffff !important; }
`

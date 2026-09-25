/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

const SITE_NAME = 'MetsXMFanZone'

interface Props {
  name?: string
  claimUrl: string
  optOutUrl: string
}

const Email = ({ name, claimUrl, optOutUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've earned a free {SITE_NAME} T-Shirt!</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>You earned a free T-Shirt! 🎉</Heading>
        <Text style={text}>
          {name ? `Hey ${name},` : 'Hey there,'} thanks for being an active {SITE_NAME} member
          for 60 days straight. As a thank you, we'd love to send you a free
          official {SITE_NAME} T-Shirt — on us.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={claimUrl} style={button}>Claim My Free T-Shirt</Button>
        </Section>
        <Text style={text}>
          Just confirm your shipping address and shirt size, and we'll ship it out.
        </Text>
        <Hr style={hr} />
        <Text style={small}>
          Not interested?{' '}
          <a href={optOutUrl} style={link}>Opt out of this gift</a>.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: "🎁 You've earned a free MetsXMFanZone T-Shirt!",
  displayName: 'Loyalty reward available',
  previewData: {
    name: 'Jane',
    claimUrl: 'https://www.metsxmfanzone.com/rewards/claim?token=demo',
    optOutUrl: 'https://www.metsxmfanzone.com/rewards/claim?token=demo&action=optout',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#0e1c43', color: '#d1d5db', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#0e1c43', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', margin: '0 auto', maxWidth: '560px', padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '13px', color: '#8b93a1', margin: '8px 0' }
const link = { color: '#FF5910' }
const button = {
  backgroundColor: '#FF5910', color: '#ffffff', padding: '14px 28px',
  borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px',
}
const hr = { borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#8b93a1', margin: '20px 0 0' }

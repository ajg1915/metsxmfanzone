/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

const SITE_NAME = 'MetsXMFanZone'
const SITE_URL = 'https://www.metsxmfanzone.com'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let's go Mets!</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>Welcome{name ? `, ${name}` : ''}!</Heading>
        <Text style={text}>
          Thanks for joining {SITE_NAME} — your home for Mets streams, gameday alerts,
          podcasts, and the most passionate fan community on the web.
        </Text>
        <Section style={{ textAlign: 'center', margin: '30px 0' }}>
          <Button href={SITE_URL} style={button}>Explore the Fan Zone</Button>
        </Section>
        <Text style={text}>
          Stick around for live game alerts, exclusive content, and community discussions.
          Let's go Mets!
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to MetsXMFanZone!',
  displayName: 'Welcome email',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#002D72', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#FF5910',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '15px',
}
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }

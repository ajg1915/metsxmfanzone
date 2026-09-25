/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

interface Props {
  memberName?: string
  memberEmail: string
  shippingName: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  country: string
  shirtSize: string
  phone?: string
  adminUrl: string
}

const Email = (p: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New free t-shirt claim — ship to {p.shippingName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>New Free T-Shirt Claim</Heading>
        <Text style={text}>
          <strong>{p.memberName || p.memberEmail}</strong> ({p.memberEmail}) just claimed
          their loyalty reward.
        </Text>
        <Hr style={hr} />
        <Section>
          <Text style={label}>Ship to:</Text>
          <Text style={text}>
            {p.shippingName}<br />
            {p.address1}<br />
            {p.address2 ? <>{p.address2}<br /></> : null}
            {p.city}, {p.state} {p.zip}<br />
            {p.country}
          </Text>
          <Text style={label}>Shirt size: <span style={{ fontWeight: 'normal' }}>{p.shirtSize}</span></Text>
          {p.phone ? <Text style={label}>Phone: <span style={{ fontWeight: 'normal' }}>{p.phone}</span></Text> : null}
        </Section>
        <Hr style={hr} />
        <Text style={text}>
          <a href={p.adminUrl} style={{ color: '#FF5910' }}>Manage in admin panel →</a>
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'New free t-shirt claim — action needed',
  displayName: 'Loyalty reward admin notification',
  previewData: {
    memberName: 'Jane Doe', memberEmail: 'jane@example.com',
    shippingName: 'Jane Doe', address1: '123 Main St',
    city: 'Queens', state: 'NY', zip: '11368', country: 'United States',
    shirtSize: 'L', adminUrl: 'https://www.metsxmfanzone.com/admin/loyalty-rewards',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#0e1c43', color: '#d1d5db', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#0e1c43', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', margin: '0 auto', maxWidth: '560px', padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 12px' }
const label = { fontSize: '14px', fontWeight: 'bold', color: '#d1d5db', margin: '12px 0 4px' }
const hr = { borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' }

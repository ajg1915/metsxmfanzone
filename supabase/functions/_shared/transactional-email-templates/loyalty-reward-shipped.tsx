/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

interface Props {
  name?: string
  trackingNumber?: string
  carrier?: string
}

const Email = ({ name, trackingNumber, carrier }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your free MetsXMFanZone T-Shirt is on the way!</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>Your T-Shirt is on the way! 📦</Heading>
        <Text style={text}>
          {name ? `Hey ${name},` : 'Hey there,'} we just shipped your free MetsXMFanZone T-Shirt.
        </Text>
        {trackingNumber ? (
          <Text style={text}>
            <strong>{carrier || 'Carrier'} tracking:</strong> {trackingNumber}
          </Text>
        ) : null}
        <Text style={text}>Thanks for being part of the fan zone. Let's go Mets!</Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your free MetsXMFanZone T-Shirt has shipped!',
  displayName: 'Loyalty reward shipped',
  previewData: { name: 'Jane', trackingNumber: '1Z999AA10123456784', carrier: 'UPS' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#002D72', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333', lineHeight: '1.6', margin: '0 0 12px' }

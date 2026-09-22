/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

const SITE_NAME = 'MetsXMFanZone'

interface OrderProps {
  name?: string
  orderId?: string
  items?: Array<{ name: string; quantity: number; price: string }>
  total?: string
  shippingAddress?: string
}

const OrderConfirmationEmail = ({ name, orderId, items, total, shippingAddress }: OrderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} order is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>Order Confirmed!</Heading>
        <Text style={text}>
          {name ? `Hi ${name}, t` : 'T'}hanks for your order. We've received it and will
          let you know as soon as it ships.
        </Text>
        {orderId && (
          <Text style={meta}>
            <strong>Order #:</strong> {orderId}
          </Text>
        )}
        <Hr style={hr} />
        {items && items.length > 0 && (
          <Section>
            <Heading as="h2" style={h2}>Items</Heading>
            {items.map((item, i) => (
              <Text key={i} style={text}>
                {item.quantity}× {item.name} — {item.price}
              </Text>
            ))}
          </Section>
        )}
        {total && (
          <Text style={totalStyle}>
            <strong>Total:</strong> {total}
          </Text>
        )}
        {shippingAddress && (
          <>
            <Hr style={hr} />
            <Heading as="h2" style={h2}>Shipping to</Heading>
            <Text style={text}>{shippingAddress}</Text>
          </>
        )}
        <Hr style={hr} />
        <Text style={footer}>Questions? Reply to this email and we'll help out.</Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data?.orderId ? `Order #${data.orderId} confirmed` : 'Your order is confirmed',
  displayName: 'Order confirmation',
  previewData: {
    name: 'Jane',
    orderId: 'MX-1024',
    items: [
      { name: 'Mets Cap', quantity: 1, price: '$24.99' },
      { name: 'Fan Zone T-Shirt', quantity: 2, price: '$39.98' },
    ],
    total: '$64.97',
    shippingAddress: '123 Citi Field Way, Queens, NY 11368',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#002D72', margin: '0 0 16px' }
const h2 = { fontSize: '17px', fontWeight: 'bold', color: '#002D72', margin: '20px 0 8px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 8px' }
const meta = { fontSize: '14px', color: '#555555', margin: '8px 0' }
const totalStyle = { fontSize: '16px', color: '#002D72', margin: '12px 0', fontWeight: 'bold' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#888888', margin: '6px 0' }

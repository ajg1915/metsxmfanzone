/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

const SITE_NAME = 'MetsXMFanZone'

interface NotificationProps {
  name?: string
  title?: string
  message?: string
  actionUrl?: string
  actionLabel?: string
}

const NotificationEmail = ({ name, title, message, actionUrl, actionLabel }: NotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title || `Update from ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>{title || 'Notification'}</Heading>
        {name && <Text style={text}>Hi {name},</Text>}
        <Text style={text}>{message || `You have a new update from ${SITE_NAME}.`}</Text>
        {actionUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={actionUrl} style={button}>{actionLabel || 'View details'}</Button>
          </Section>
        )}
        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NotificationEmail,
  subject: (data: Record<string, any>) => data?.title || `Update from ${SITE_NAME}`,
  displayName: 'General notification',
  previewData: {
    name: 'Jane',
    title: 'New Mets highlights are live',
    message: 'Catch the latest plays from last night\'s game on the Fan Zone.',
    actionUrl: 'https://www.metsxmfanzone.com',
    actionLabel: 'Watch now',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#002D72', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 14px' }
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

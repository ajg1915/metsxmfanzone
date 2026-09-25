import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BrandHeader, BrandFooter } from './brand.tsx'

const SITE_NAME = 'MetsXMFanZone'

interface GamedayAlertProps {
  title?: string
  message?: string
  opponent?: string
  gameTime?: string
  venue?: string
  linkUrl?: string
  triggerType?: string
}

const GamedayAlertEmail = ({
  title = 'Game Time!',
  message = 'The Mets are about to take the field.',
  opponent = '',
  gameTime = '',
  venue = '',
  linkUrl = '/',
  triggerType = '',
}: GamedayAlertProps) => {
  const url = linkUrl.startsWith('http')
    ? linkUrl
    : `https://metsxmfanzone.com${linkUrl}`

  const labelMap: Record<string, string> = {
    pregame_20min: '20 MINUTES TO FIRST PITCH',
    pregame_5min: '5 MINUTES TO FIRST PITCH',
  }
  const label = labelMap[triggerType] || 'GAMEDAY ALERT'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <BrandHeader />
          <Section style={header}>
            <Text style={badge}>{label}</Text>
            <Heading style={h1}>{title}</Heading>
          </Section>

          <Section style={card}>
            <Text style={messageStyle}>{message}</Text>
            {opponent && (
              <Text style={meta}><strong>Opponent:</strong> {opponent}</Text>
            )}
            {gameTime && (
              <Text style={meta}><strong>First Pitch:</strong> {gameTime} ET</Text>
            )}
            {venue && (
              <Text style={meta}><strong>Venue:</strong> {venue}</Text>
            )}
            <Section style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button href={url} style={button}>Watch Live</Button>
            </Section>
          </Section>

          <BrandFooter />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: GamedayAlertEmail,
  subject: (data: Record<string, any>) =>
    data?.title || '⚾ Mets Game Alert',
  displayName: 'Gameday alert',
  previewData: {
    title: '⚾ 20 Minutes to First Pitch!',
    message: 'The Mets take on the Washington Nationals at Citi Field. Tune in now!',
    opponent: 'Washington Nationals',
    gameTime: '7:10 PM',
    venue: 'Citi Field',
    linkUrl: '/live',
    triggerType: 'pregame_20min',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#0e1c43', color: '#d1d5db', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#0e1c43', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', margin: '0 auto', maxWidth: '560px', padding: '20px 25px' }
const header = { textAlign: 'center' as const, padding: '8px 0 16px' }
const badge = {
  display: 'inline-block',
  backgroundColor: '#ff5910',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 'bold' as const,
  letterSpacing: '1.5px',
  padding: '6px 14px',
  borderRadius: '999px',
  margin: '0 0 12px',
}
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0 0 8px' }
const card = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
}
const messageStyle = { fontSize: '15px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 16px' }
const meta = { fontSize: '14px', color: '#d1d5db', margin: '4px 0' }
const button = {
  backgroundColor: '#FF5910',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#8b93a1', textAlign: 'center' as const, margin: '24px 0 0' }

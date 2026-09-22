/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Section, Img, Text, Link, Hr,
} from 'npm:@react-email/components@0.0.22'

export const BrandHeader = () => (
  <Section style={{ textAlign: 'center', marginBottom: '18px' }}>
    <Img
      src="https://metsxmfanzone.com/metsxmfanzone-logo.png"
      width={80}
      alt="MetsXMFanZone"
      style={{ borderRadius: '12px', margin: '0 auto 10px' }}
    />
    <Text style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>
      <span style={{ color: '#002D72' }}>Mets</span>
      <span style={{ color: '#FF5910' }}>XM</span>
      <span style={{ color: '#111827' }}>FanZone</span>
    </Text>
  </Section>
)

export const BrandFooter = () => (
  <>
    <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 16px' }} />
    <Text style={{ fontSize: '13px', fontWeight: 'bold', color: '#FF5910', textAlign: 'center', margin: '0 0 4px' }}>
      Let&rsquo;s Go Mets!
    </Text>
    <Text style={{ fontSize: '11px', color: '#8b93a1', textAlign: 'center', margin: '0 0 4px' }}>
      © 2026 MetsXMFanZone — The Ultimate Mets Fan Community
    </Text>
    <Text style={{ fontSize: '11px', textAlign: 'center', margin: 0 }}>
      <Link href="https://metsxmfanzone.com" style={{ color: '#FF5910', fontSize: '11px' }}>
        https://metsxmfanzone.com
      </Link>
    </Text>
  </>
)

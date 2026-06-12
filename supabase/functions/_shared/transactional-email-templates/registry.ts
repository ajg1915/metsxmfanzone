/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as notification } from './notification.tsx'
import { template as gamedayAlert } from './gameday-alert.tsx'
import { template as loyaltyRewardAvailable } from './loyalty-reward-available.tsx'
import { template as loyaltyRewardAdminNotify } from './loyalty-reward-admin-notify.tsx'
import { template as loyaltyRewardShipped } from './loyalty-reward-shipped.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'order-confirmation': orderConfirmation,
  'notification': notification,
  'gameday-alert': gamedayAlert,
  'loyalty-reward-available': loyaltyRewardAvailable,
  'loyalty-reward-admin-notify': loyaltyRewardAdminNotify,
  'loyalty-reward-shipped': loyaltyRewardShipped,
}

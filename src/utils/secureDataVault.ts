import { supabase } from "@/integrations/supabase/client";
import { trackBulkExport } from "@/utils/securityAlerts";


/**
 * Always attach the *user's* access token to vault calls.
 * Without this, supabase.functions.invoke() falls back to the anon key,
 * which the edge function correctly rejects with 401 Unauthorized.
 */
export async function vaultAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in as an admin to access secure data.');
  }
  return { Authorization: `Bearer ${token}` };
}

type EncryptableDataType = 'activity_logs' | 'profiles' | 'business_ads' | 'newsletter_subscribers' | 'notification_subscriptions';

/**
 * Secure Data Vault - AES-256-GCM Encryption System
 * All sensitive data is encrypted at rest and only admins can decrypt
 */

/**
 * Encrypts sensitive fields before storing in database
 * Only admins can call this function
 */
export async function encryptSensitiveData(
  dataType: EncryptableDataType,
  data: Record<string, any>
): Promise<Record<string, string> | null> {
  try {
    const { data: result, error } = await supabase.functions.invoke('secure-data-vault', {
      headers: await vaultAuthHeaders(),
      body: {
        action: 'encrypt',
        dataType,
        data
      }
    });

    if (error) {
      console.error('Encryption failed:', error);
      return null;
    }

    return result?.encrypted || null;
  } catch (error) {
    console.error('Error encrypting data:', error);
    return null;
  }
}

/**
 * Decrypts records that have been fetched from the database
 * Only admins can decrypt - requires valid admin session
 */
export async function decryptRecords(
  dataType: EncryptableDataType,
  records: any[]
): Promise<any[]> {
  try {
    const { data, error } = await supabase.functions.invoke('secure-data-vault', {
      headers: await vaultAuthHeaders(),
      body: {
        action: 'decrypt',
        dataType,
        data: { records }
      }
    });

    if (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt records - admin access required');
    }

    return data?.records || [];
  } catch (error) {
    console.error('Error decrypting records:', error);
    throw error;
  }
}

/**
 * Fetches and decrypts records in a single secure operation
 * Only admins can access this data
 */
export async function fetchDecryptedData(
  dataType: EncryptableDataType,
  options?: {
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
  }
): Promise<any[]> {
  try {
    const { data, error } = await supabase.functions.invoke('secure-data-vault', {
      headers: await vaultAuthHeaders(),
      body: {
        action: 'fetch-decrypted',
        dataType,
        data: {
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          filters: options?.filters
        }
      }
    });

    if (error) {
      console.error('Failed to fetch decrypted data:', error);
      throw new Error('Failed to fetch data - admin access required');
    }

    const records = data?.records || [];
    
    // Track bulk exports for security alerts (threshold check happens in edge function)
    if (records.length >= 50) {
      const { data: userData } = await supabase.auth.getUser();
      const adminEmail = userData?.user?.email || 'unknown';
      trackBulkExport(adminEmail, dataType, records.length);
    }

    return records;
  } catch (error) {
    console.error('Error fetching decrypted data:', error);
    throw error;
  }
}

// Convenience functions for specific data types

export async function fetchDecryptedProfiles(limit = 100, offset = 0) {
  return fetchDecryptedData('profiles', { limit, offset });
}

export async function fetchDecryptedBusinessAds(limit = 100, offset = 0) {
  return fetchDecryptedData('business_ads', { limit, offset });
}

export async function fetchDecryptedActivityLogs(limit = 100, offset = 0) {
  return fetchDecryptedData('activity_logs', { limit, offset });
}

export async function fetchDecryptedNewsletterSubscribers(limit = 100, offset = 0) {
  return fetchDecryptedData('newsletter_subscribers', { limit, offset });
}

export async function fetchDecryptedNotificationSubscriptions(limit = 100, offset = 0) {
  return fetchDecryptedData('notification_subscriptions', { limit, offset });
}

/**
 * Masks sensitive data for display to non-admin users
 * Shows only last 4 characters with asterisks
 */
export function maskSensitiveField(value: string | null | undefined): string {
  if (!value) return '****';
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

/**
 * Masks email for display - shows first 2 chars and domain
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '****@****.***';
  const [local, domain] = email.split('@');
  if (!domain) return '****@****.***';
  const maskedLocal = local.slice(0, 2) + '****';
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks phone number - shows only last 4 digits
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '****-****';
  return '****-' + phone.slice(-4);
}

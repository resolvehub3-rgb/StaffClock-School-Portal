import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'staffclock_supabase_url';
const STORAGE_KEY_ANON = 'staffclock_supabase_anon';

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const savedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const savedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ANON) || '' : '';

  const url = envUrl || savedUrl;
  const anonKey = envKey || savedKey;

  // Simple validation: must start with https:// and anon key non-empty
  const isConfigured = Boolean(
    url &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey &&
    anonKey.length > 20
  );

  return { url, anonKey, isConfigured };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    // Reset client instance so it re-initializes
    cachedClient = null;
  }
}

export function clearCustomSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
    cachedClient = null;
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Uploads attendance selfie to the private 'attendance-evidence' bucket
 */
export async function uploadAttendanceSelfie(
  userId: string,
  imageBlob: Blob
): Promise<{ path: string | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { path: null, error: new Error('Supabase client not configured') };
  }

  try {
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}.jpg`;

    const { data, error } = await supabase.storage
      .from('attendance-evidence')
      .upload(filename, imageBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (err: any) {
    return { path: null, error: err };
  }
}

/**
 * Generates short-lived signed URL for private attendance evidence photo
 */
export async function getEvidenceSignedUrl(
  evidencePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || !evidencePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from('attendance-evidence')
      .createSignedUrl(evidencePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error('Error generating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return null;
  }
}

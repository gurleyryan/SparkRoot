import type { NextApiRequest, NextApiResponse } from 'next';

// Helper to extract a cookie value by name
function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Helper to extract access_token from Supabase session cookie
function extractSupabaseAccessToken(cookieHeader: string | undefined, cookieName: string): string | undefined {
  const cookieVal = getCookieValue(cookieHeader, cookieName);
  if (!cookieVal) return undefined;
  try {
    let decoded = cookieVal;
    // Remove 'base64-' prefix if present
    if (decoded.startsWith('base64-')) {
      decoded = decoded.slice('base64-'.length);
      decoded = Buffer.from(decoded, 'base64').toString('utf-8');
    }
    // Parse as JSON
    const session = JSON.parse(decoded);
    if (typeof session === 'object' && session.access_token) {
      return session.access_token;
    }
    if (Array.isArray(session) && session[0]?.access_token) {
      return session[0].access_token;
    }
  } catch (e) {
    console.log('Failed to extract access token:', e);
    return undefined;
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/generate-deck${req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

  // Extract Supabase access_token from session cookie
  const supabaseAccessToken = extractSupabaseAccessToken(req.headers.cookie, 'sb-mwcqdsgplmfbjfahhhxr-auth-token');
  // Prepare headers
  const headers: Record<string, string> = {};
  if (supabaseAccessToken) {
    headers['Authorization'] = `Bearer ${supabaseAccessToken}`;
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    headers['apikey'] = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  // Forward the GET request to the backend
  const backendRes = await fetch(backendUrl, {
    method: 'GET',
    headers,
  });

  const data = await backendRes.text();
  let parsed;
  try {
    parsed = JSON.parse(data);
    res.status(backendRes.status).json(parsed);
  } catch {
    res.status(backendRes.status).send(data);
  }
}

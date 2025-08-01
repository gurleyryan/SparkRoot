import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      decoded = decoded.slice(7);
    }
    // Decode base64
    decoded = Buffer.from(decoded, 'base64').toString('utf-8');
    // Parse as JSON
    const session = JSON.parse(decoded);
    if (typeof session === 'object' && session.access_token) {
      return session.access_token;
    }
    if (Array.isArray(session) && session[0]?.access_token) {
      return session[0].access_token;
    }
  } catch (e) {
    console.log("Failed to extract access token:", e);
    return undefined;
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/generate-deck-stream`;

  // Extract Supabase access_token from session cookie
  const supabaseAccessToken = extractSupabaseAccessToken(req.headers.cookie, "sb-mwcqdsgplmfbjfahhhxr-auth-token");
  console.log("Raw cookie:", req.headers.cookie);
  console.log("Extracted access token:", supabaseAccessToken?.slice(0, 20), "(len:", supabaseAccessToken?.length, ")");

  // Prepare headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (supabaseAccessToken) {
    headers["Authorization"] = `Bearer ${supabaseAccessToken}`;
    console.log("Proxying Authorization header:", `Bearer ${supabaseAccessToken.slice(0, 10)}... (len: ${supabaseAccessToken.length})`);
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    headers["apikey"] = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  // Manually read the raw body
  let rawBody = '';
  await new Promise((resolve, reject) => {
    req.on('data', chunk => {
      rawBody += chunk;
    });
    req.on('end', resolve);
    req.on('error', reject);
  });

  let parsedBody: unknown = {};
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Forward the request body and headers
  const backendRes = await fetch(backendUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(parsedBody),
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
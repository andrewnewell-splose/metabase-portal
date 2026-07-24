// Vercel Edge Middleware. Runs before every request, including static files.
// Redirects to Google sign-in unless a valid, unexpired session cookie is present.

export const config = {
  // Protect everything except the auth endpoints themselves and favicon.
  matcher: ['/((?!api/auth/|favicon.ico).*)'],
};

const COOKIE_NAME = 'portal_session';

function base64urlToBytes(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifySession(cookieValue, secret) {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot === -1) return null;

  const payloadB64 = cookieValue.slice(0, dot);
  const sigB64 = cookieValue.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64urlToBytes(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function middleware(request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new Response('Server misconfigured: SESSION_SECRET not set', { status: 500 });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const session = await verifySession(match ? match[1] : null, secret);

  if (session) {
    return; // Valid session, let the request through.
  }

  const url = new URL(request.url);

  // API routes get a 401 rather than an HTML redirect.
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Preserve the originally requested path so callback can return the user there.
  const loginUrl = new URL('/api/auth/login', url.origin);
  loginUrl.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(loginUrl.toString(), 302);
}

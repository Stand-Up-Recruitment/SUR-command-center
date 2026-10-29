// Vercel function: minimal OAuth 2.1 server for the Claude connector (api/mcp.ts).
// Claude registers itself, sends the user to a password page, then swaps the code for an access token.
// GET  /api/oauth?step=resource|server   metadata (also served at /.well-known/*, see vercel.json)
// POST /api/oauth?step=register          dynamic client registration
// GET  /api/oauth?step=authorize         password page;  POST submits it
// POST /api/oauth?step=token             code + PKCE verifier -> access token
import { timingSafeEqual } from 'node:crypto';
import { sign, verify, sha256 } from './_lib/oauth.js';

// Only Claude's callback may receive codes, so a stolen login link can't send tokens elsewhere.
const REDIRECTS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
// shortcut: no refresh tokens, so people reconnect after 30 days; add refresh_token grant if that annoys.
const ACCESS_TTL = 30 * 86_400;

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const oauthError = (error: string, status = 400) => Response.json({ error }, { status });

function passwordOk(given: string): boolean {
  const expected = process.env.MCP_LOGIN_PASSWORD;
  return Boolean(expected) && timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(sha256(expected!)));
}

function loginPage(params: URLSearchParams, error?: string): Response {
  const hidden = ['redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'client_id']
    .map(k => `<input type="hidden" name="${k}" value="${esc(params.get(k) ?? '')}">`).join('');
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Claude — SUR Command Center</title>
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#1e293b;padding:32px;border-radius:12px;width:min(340px,90vw)}h1{font-size:18px;margin:0 0 8px}p{color:#94a3b8;font-size:14px}
input[type=password]{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:inherit;font-size:16px}
button{margin-top:16px;width:100%;padding:10px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-size:16px;cursor:pointer}.err{color:#f87171}</style></head>
<body><form method="post"><h1>Connect Claude to SUR Command Center</h1><p>Claude will be able to read dashboard numbers. It can't change anything.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}<label for="pw">Connector password</label>
<input id="pw" type="password" name="password" autofocus required>${hidden}<button type="submit">Connect</button></form></body></html>`,
  { status: error ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function checkAuthorizeParams(p: URLSearchParams): string | null {
  if (!REDIRECTS.includes(p.get('redirect_uri') ?? '')) return 'Unknown redirect_uri';
  if (p.get('code_challenge_method') !== 'S256' || !p.get('code_challenge')) return 'PKCE S256 required';
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  switch (url.searchParams.get('step')) {
    case 'resource':
      return Response.json({ resource: `${origin}/api/mcp`, authorization_servers: [origin] });
    case 'server':
      return Response.json({
        issuer: origin,
        authorization_endpoint: `${origin}/api/oauth?step=authorize`,
        token_endpoint: `${origin}/api/oauth?step=token`,
        registration_endpoint: `${origin}/api/oauth?step=register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    case 'authorize': {
      const bad = checkAuthorizeParams(url.searchParams);
      return bad ? oauthError(bad) : loginPage(url.searchParams);
    }
    default:
      return oauthError('not_found', 404);
  }
}

export async function POST(request: Request): Promise<Response> {
  const step = new URL(request.url).searchParams.get('step');

  if (step === 'register') {
    const body = await request.json().catch(() => ({})) as { redirect_uris?: string[]; client_name?: string };
    const uris = body.redirect_uris ?? [];
    if (!uris.length || !uris.every(u => REDIRECTS.includes(u))) return oauthError('invalid_redirect_uri');
    return Response.json({
      client_id: 'claude', client_name: body.client_name, redirect_uris: uris,
      grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none',
    }, { status: 201 });
  }

  const form = new URLSearchParams(await request.text());

  if (step === 'authorize') {
    const bad = checkAuthorizeParams(form);
    if (bad) return oauthError(bad);
    if (!passwordOk(form.get('password') ?? '')) return loginPage(form, 'Wrong password');
    const code = sign('code', 300, { redirect_uri: form.get('redirect_uri'), challenge: form.get('code_challenge') });
    const to = new URL(form.get('redirect_uri')!);
    to.searchParams.set('code', code);
    if (form.get('state')) to.searchParams.set('state', form.get('state')!);
    return Response.redirect(to.toString(), 302);
  }

  if (step === 'token') {
    if (form.get('grant_type') !== 'authorization_code') return oauthError('unsupported_grant_type');
    const code = verify(form.get('code'), 'code');
    if (!code || code.redirect_uri !== form.get('redirect_uri') || code.challenge !== sha256(form.get('code_verifier') ?? '')) {
      return oauthError('invalid_grant');
    }
    return Response.json(
      { access_token: sign('access', ACCESS_TTL), token_type: 'Bearer', expires_in: ACCESS_TTL },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return oauthError('not_found', 404);
}

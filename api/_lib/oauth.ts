// Stateless signed tokens for the MCP connector's OAuth flow (api/oauth.ts, api/mcp.ts).
// A token is base64url(JSON payload) + "." + HMAC-SHA256 signature keyed by MCP_AUTH_SECRET.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

type Kind = 'code' | 'access';
type Payload = { kind: Kind; exp: number; [k: string]: unknown };

const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');

export function sign(kind: Kind, ttlSeconds: number, extra: Record<string, unknown> = {}): string {
  const secret = process.env.MCP_AUTH_SECRET;
  if (!secret) throw new Error('MCP_AUTH_SECRET not configured');
  const body = Buffer.from(JSON.stringify({ ...extra, kind, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  return `${body}.${mac(body, secret)}`;
}

/** Returns the payload when the token is ours, of this kind and unexpired; otherwise null. */
export function verify(token: string | null | undefined, kind: Kind): Payload | null {
  const secret = process.env.MCP_AUTH_SECRET;
  const [body, sig] = token?.split('.') ?? [];
  if (!secret || !body || !sig) return null;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
  return p.kind === kind && p.exp > Date.now() ? p : null;
}

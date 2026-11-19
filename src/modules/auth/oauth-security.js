import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export const OAUTH_STATE_COOKIE = 'serveq_oauth_state';
const stateCookieOptions = req => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production' || Boolean(req?.secure), sameSite: 'lax', path: '/api/auth/google' });

export const oauthResponseHeaders = res => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
};

export const oauthClientUrl = path => {
  const client = new URL(process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://serveq.tech' : 'http://localhost:5173'));
  if (!['https:', 'http:'].includes(client.protocol) || client.username || client.password || (process.env.NODE_ENV === 'production' && client.protocol !== 'https:')) throw new Error('Invalid OAuth CLIENT_URL configuration');
  return new URL(path, client.origin).href;
};

export const beginOAuth = (req, res) => {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const proof = jwt.sign({ nonce, role: req.query.role === 'owner' ? 'owner' : 'customer', purpose: 'google-oauth-state' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  res.cookie(OAUTH_STATE_COOKIE, proof, { ...stateCookieOptions(req), maxAge: 10 * 60 * 1000 });
  return nonce;
};

export const validateOAuthState = (req, res) => {
  res.clearCookie(OAUTH_STATE_COOKIE, stateCookieOptions(req));
  try {
    const state = req.query.state;
    const proof = req.cookies?.[OAUTH_STATE_COOKIE];
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof proof !== 'string') return false;
    const decoded = jwt.verify(proof, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== 'google-oauth-state' || typeof decoded.nonce !== 'string' || decoded.nonce.length !== state.length || !crypto.timingSafeEqual(Buffer.from(decoded.nonce), Buffer.from(state))) return false;
    req.oauthRole = decoded.role === 'owner' ? 'owner' : 'customer';
    return true;
  } catch { return false; }
};

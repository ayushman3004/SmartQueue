# OAuth sessions and cookies

Google login now redirects to `/auth/callback` without a session JWT in the URL, fragment, or response body. The API sets a host-only HttpOnly session cookie. The browser callback clears stale bearer credentials and loads `/api/auth/me` with credentials; it does not copy the OAuth session into localStorage. Reloading the app restores the cookie session. Existing password and OTP bearer-token responses remain supported.

OAuth starts with a fresh random state nonce and a signed, HttpOnly, ten-minute state cookie scoped to `/api/auth/google`. The callback validates the nonce against that cookie before invoking Passport, then clears the state cookie. Role intent comes from the signed state cookie. The previous literal `owner`/`customer` state values are rejected. Cookies are required for OAuth; provider authorization codes still supply Google's code replay protection.

All authentication responses use `Cache-Control: no-store`. OAuth responses also use `Referrer-Policy: no-referrer`. Provider exceptions are represented by controlled error codes rather than reflected messages.

Session cookies use `HttpOnly`, `Path=/`, no `Domain`, and `SameSite=Lax` by default. Production always sets `Secure`, regardless of request scheme or forwarding headers. Login and logout share the same cookie options. Local HTTP development remains supported. `AUTH_COOKIE_SAME_SITE=none` is an explicit option for cross-site frontend/API deployments and always enables `Secure`; these deployments also depend on browser third-party-cookie policies. Use the same-site `https://serveq.tech` and `https://api.serveq.tech` deployment where possible. `strict` is also supported; unsupported values fail configuration validation.

Set `CLIENT_URL` to the HTTPS frontend origin in production and `SERVER_URL` to the HTTPS API origin. Register `${SERVER_URL}/api/auth/google/callback` in Google's authorized redirect URIs. Never configure a client-supplied redirect destination. OAuth's temporary state cookie remains Lax so it can accompany Google's top-level callback navigation.

Browser logout now calls the server to clear the HttpOnly cookie. Socket reconnection waits for that request; a failed logout reports an error and leaves reconnection blocked. Cookie-authenticated writes retain the existing trusted-Origin checks. Socket.IO now checks origins at the WebSocket handshake as well as through CORS.

Tests cover local HTTP requests with mocked Passport and database calls, plus browser session helpers. A real Google consent round trip and deployed browser cookie delivery require the configured deployment and were not exercised by these tests.

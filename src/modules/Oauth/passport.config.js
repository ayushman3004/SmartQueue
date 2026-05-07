import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findOrCreateGoogleUser } from "../auth/auth.service.js";

// Derive the server's own URL for the OAuth callback
// In production on Render, use RENDER_EXTERNAL_URL or SERVER_URL or CLIENT_URL's backend equivalent
const getServerUrl = () => {
  if (process.env.SERVER_URL) return process.env.SERVER_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  return `http://localhost:${process.env.PORT || 3001}`;
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${getServerUrl()}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await findOrCreateGoogleUser({
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    },
  ),
);

export default passport;

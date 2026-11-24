import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { useSeo } from "../utils/useSeo";
import BusinessEmailVerification from "../components/BusinessEmailVerification";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import HubCommandCenter from "../components/HubCommandCenter";
import { hasActiveSubscription } from "../utils/subscription";
import "../styles/business-admission.css";
export function HubHome() {
  const { user } = useAuth();
  if (user?.role !== "admin" && !user?.isEmailVerified && user?.authProvider !== "google")
    return <Navigate to="/business/onboarding" replace />;
  if (user?.role !== "admin" && !hasActiveSubscription(user.subscription))
    return <Navigate to="/subscription" replace />;
  return <HubCommandCenter />;
}
export function OwnerPasswordPage() {
  const { user, logIn } = useAuth(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.newPassword !== data.confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/auth/change-password", data);
      logIn(response.data.data.user);
      navigate("/hub/dashboard", {
        replace: true,
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to change your password. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admission">
      <header className="admission-nav">
        <Link to="/hub/dashboard">← Business hub</Link>
      </header>
      <section className="admission-form admission-login">
        <p className="admission-eyebrow">Keep your account yours</p>
        <h1>Choose your own password.</h1>
        <p>
          {user?.ownerAccess?.mustChangePassword
            ? "Replace the temporary password from your invitation."
            : "Update the password you use to sign in."}{" "}
          Use at least 8 characters, with uppercase, lowercase, a number and a
          symbol.
        </p>
        <form onSubmit={submit}>
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength="128"
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength="8"
              maxLength="128"
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength="8"
              maxLength="128"
            />
          </label>
          {error && (
            <p role="alert" className="admission-error">
              {error}
            </p>
          )}
          <button className="admission-primary" disabled={busy}>
            {busy ? "Saving…" : "Save new password →"}
          </button>
        </form>
      </section>
    </div>
  );
}
export default function HubLoginPage() {
  useSeo({
    title: "Business owner sign in",
    description:
      "Activate your approved ServeQ owner invitation or sign in to your business.",
    robots: "noindex, nofollow",
  });
  const { user, logIn, logOut } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [activationRequested, setActivationRequested] = useState(false);
  const [notice, setNotice] = useState("");
  const activation =
    location.pathname === "/hub/activate" || activationRequested;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(() => {
      const params = new URLSearchParams(location.search);
      return (
        params.get("message")?.slice(0, 500) ||
        (params.get("error")
          ? "Google sign-in could not complete. Use an existing approved account or sign in with your password."
          : "")
      );
    }),
    [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false),
    [code, setCode] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const invited =
    user?.role === "owner" && user.ownerAccess?.status === "INVITED";
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const response = await api.post("/auth/signin", {
        ...data,
        requiredRole: "owner",
      });
      logIn(response.data.data.user);
    } catch (error) {
      if (error.response?.data?.code === "OWNER_ACTIVATION_REQUIRED") {
        setActivationRequested(true);
        setNotice(
          "Enter the single-use activation code from your approval email. Your email and password have been kept in this form.",
        );
      } else {
        setNotice("");
        setError(
          error.response?.data?.message ||
            "Unable to sign in. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/email/send-otp");
      setSent(true);
      setCooldown(30);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to send the verification email.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/auth/email/verify-otp", {
        otp: code,
      });
      logIn(response.data.data.user);
      navigate("/hub/change-password", {
        replace: true,
      });
    } catch (error) {
      setError(error.response?.data?.message || "Unable to verify the code.");
    } finally {
      setBusy(false);
    }
  }
  if (invited)
    return (
      <div className="admission">
        {error && (
          <p role="alert" className="admission-error admission-otp-error">
            {error}
          </p>
        )}
        <BusinessEmailVerification
          email={user.email}
          sent={sent}
          code={code}
          onCodeChange={setCode}
          onSend={send}
          onVerify={verify}
          sending={busy && !sent}
          verifying={busy && sent}
          cooldown={cooldown}
          onSignOut={() => {
            logOut();
            navigate("/hub/login");
          }}
        />
      </div>
    );
  if (user?.role === "owner" || user?.role === "admin")
    return <Navigate to="/hub/dashboard" replace />;
  return (
    <div className="admission">
      <header className="admission-nav">
        <Link to="/business">
          <img src="/serveq-logo.png" alt="serveQ" width="130" />
        </Link>
        <Link to="/business/apply">Apply to join →</Link>
      </header>
      <section className="admission-form admission-login">
        <p className="admission-eyebrow">Your business, a little calmer</p>
        <h1>{activation ? "Your invitation starts here." : "Welcome back."}</h1>
        <p>
          {activation
            ? "Enter the login details and activation code from your approval email. Complete email OTP verification before the five-hour deadline."
            : "Sign in to your approved business account. Invited for the first time? Use the activation link in your email."}
        </p>
        {notice && (
          <p className="admission-notice" role="status">
            {notice}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Business email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength="254"
            />
          </label>
          <label>
            {activation ? "Temporary password" : "Password"}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength="128"
            />
          </label>
          {activation && (
            <label>
              Single-use activation code (6 digits)
              <input
                name="activationCredential"
                autoFocus={activationRequested}
                type="password"
                autoComplete="off"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                title="Enter the six-digit activation code from your invitation email"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="admission-error">
              {error}
            </p>
          )}
          <button className="admission-primary" disabled={busy}>
            {busy
              ? "Checking…"
              : activation
                ? "Continue to email verification →"
                : "Sign in →"}
          </button>
        </form>
        {!activation && (
          <div className="admission-google-login">
            <a
              className="admission-secondary"
              href={`${api.defaults.baseURL}/auth/google?role=owner`}
            >
              Continue with Google
            </a>
            <p className="admission-fine">
              For existing approved owner accounts.
            </p>
          </div>
        )}
        <div className="admission-login-links">
          <button onClick={() => setForgot(true)}>Forgot password?</button>
          {!activation && <Link to="/doctor/login">Doctor sign in</Link>}
          <Link
            to={activation ? "/hub/login" : "/hub/activate"}
            onClick={() => {
              setActivationRequested(false);
              setNotice("");
              setError("");
            }}
          >
            {activation
              ? "Already activated? Sign in"
              : "Activate an invitation"}
          </Link>
        </div>
        {user && (
          <button onClick={() => logOut()}>
            Sign out of your customer account
          </button>
        )}
      </section>
      <ForgotPasswordModal isOpen={forgot} onClose={() => setForgot(false)} />
    </div>
  );
}

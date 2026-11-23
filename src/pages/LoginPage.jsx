import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Ticket,
} from "lucide-react";
import "../styles/customer-auth.css";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signup, signin } from "../api/auth.api";
import { toast } from "react-hot-toast";
import { useSeo } from "../utils/useSeo";
import { isValidEmail, validatePasswordStrength } from "../utils/validators";
import { useDebounce } from "../hooks/useDebounce";
import { safeReturnTo } from "../utils/authRedirect";
import ForgotPasswordModal from "../components/ForgotPasswordModal";

export default function LoginPage() {
  const [tab, setTab] = useState("signin"); // 'signin' or 'signup'
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [ownerMismatch, setOwnerMismatch] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Debounced password validation for signup requirements
  const debouncedPassword = useDebounce(form.password, 250);
  const passwordStrength = validatePasswordStrength(debouncedPassword);
  const passwordRules = [
    ["8+ characters", passwordStrength.hasMinLength],
    [
      "Upper & lowercase",
      passwordStrength.hasUpper && passwordStrength.hasLower,
    ],
    ["A number", passwordStrength.hasNumber],
    ["A symbol", passwordStrength.hasSpecial],
  ];
  const { logIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useSeo({
    title: tab === "signup" ? "Create an Account" : "Sign In",
    description:
      "Sign in to serveQ to join queues, track estimated wait times, and manage bookings.",
    robots: "noindex, follow",
    canonical: "https://www.serveq.tech/login",
  });

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOwnerMismatch(null);
    setError("");

    if (!acceptPrivacy) {
      toast.error(
        "Please click the checkbox to accept our Privacy Policy to continue.",
      );
      return;
    }

    if (!isValidEmail(form.email)) {
      toast.error("Please enter a valid email address (e.g. name@example.com)");
      return;
    }

    if (tab === "signup") {
      const strength = validatePasswordStrength(form.password);
      if (!strength.isValid) {
        toast.error(
          "Password must contain at least 8 characters, numbers, capital letters, and symbols.",
        );
        return;
      }
    }

    setLoading(true);
    try {
      const apiFn = tab === "signup" ? signup : signin;
      const payload =
        tab === "signup"
          ? {
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              role: "customer",
            }
          : {
              email: form.email.trim(),
              password: form.password,
              requiredRole: "customer",
            };

      const res = await apiFn(payload);
      const { user, token } = res.data.data;

      if (user?.role === "owner") {
        setOwnerMismatch({ email: form.email });
        toast.error(
          "This account is registered as a Hub Owner, not a Customer.",
        );
        return;
      }

      logIn(user, token);
      toast.success(
        tab === "signin"
          ? "Welcome back! Logged in successfully."
          : "Welcome to serveQ! Account created.",
        {
          style: {
            borderRadius: "14px",
            background: "#ffffff",
            color: "#09090b",
            border: "1px solid #e4e4e7",
          },
        },
      );
      navigate(
        safeReturnTo(
          searchParams.get("returnTo"),
          user?.role === "admin" ? "/admin" : "/customers",
        ),
        { replace: true },
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Unable to sign in. Please check your details.";
      if (
        (err.response?.status === 403 || err.response?.status === 409) &&
        (msg.toLowerCase().includes("hub owner") ||
          msg.toLowerCase().includes("owner"))
      ) {
        setOwnerMismatch({ email: form.email });
      }
      setError(msg);
      toast.error(msg, {
        style: {
          borderRadius: "14px",
          background: "#ffffff",
          color: "#09090b",
          border: "1px solid #fee2e2",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    if (!acceptPrivacy) {
      toast.error(
        "Please click the checkbox to accept our Privacy Policy to continue.",
      );
      return;
    }
    localStorage.setItem(
      "auth_redirect",
      safeReturnTo(searchParams.get("returnTo")),
    );
    const apiUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiUrl}/api/auth/google?role=customer`;
  };

  const changeTab = (next) => {
    setTab(next);
    setError("");
    setOwnerMismatch(null);
    setShowPassword(false);
  };

  return (
    <div className="customer-auth">
      <header className="customer-auth-header">
        <Link to="/" aria-label="serveQ home">
          <img src="/serveq-logo.png" alt="serveQ" />
        </Link>
        <Link to="/hub/login" className="customer-auth-owner-link">
          Business owner? <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <main className="customer-auth-layout">
        <section
          className="customer-auth-intro"
          aria-labelledby="customer-auth-intro-title"
        >
          <p className="customer-auth-eyebrow">Your time, well spent</p>
          <h2 id="customer-auth-intro-title">
            A little less waiting.
            <br />
            <span>A little more living.</span>
          </h2>
          <p className="customer-auth-intro-copy">
            Your next visit, with time for yourself. Find a clinic,
            save your place, and follow your turn from your phone.
          </p>
          <div
            className="customer-auth-preview"
            aria-label="How your digital queue pass works"
          >
            <span className="customer-auth-ticket" aria-hidden="true">
              <Ticket size={27} strokeWidth={1.4} />
            </span>
            <div>
              <p>Your place, saved.</p>
              <span>Join a queue. Keep your day moving.</span>
            </div>
            <Check size={19} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="customer-auth-benefits">
            <span>
              <Clock3 size={16} strokeWidth={1.5} aria-hidden="true" />
              Follow your turn
            </span>
            <span>
              <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
              Plan your visit
            </span>
          </div>
        </section>

        <section
          className="customer-auth-card"
          aria-labelledby="customer-auth-title"
        >
          <div
            className="customer-auth-modes"
            role="group"
            aria-label="Account action"
          >
            <button
              type="button"
              aria-pressed={tab === "signin"}
              disabled={loading}
              onClick={() => changeTab("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={tab === "signup"}
              disabled={loading}
              onClick={() => changeTab("signup")}
            >
              Create account
            </button>
          </div>
          <div className="customer-auth-card-heading">
            <p className="customer-auth-eyebrow">Your serveQ account</p>
            <h1 id="customer-auth-title">
              {tab === "signup" ? "Make yourself at home." : "Welcome back."}
            </h1>
            <p>
              {tab === "signup"
                ? "A few details, then you’re ready for your next visit."
                : "Sign in to find your queues and upcoming visits."}
            </p>
          </div>

          {ownerMismatch && (
            <div className="customer-auth-account-note" role="alert">
              <strong>This is a business owner account.</strong>
              <p>Use the owner sign-in page to manage your business.</p>
              <Link to="/hub/login">
                Go to owner sign-in <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="customer-auth-form"
            aria-busy={loading}
          >
            {tab === "signup" && (
              <div className="customer-auth-field">
                <label htmlFor="customer-auth-name">Full name</label>
                <input
                  id="customer-auth-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={onChange}
                  placeholder="Your full name"
                  disabled={loading}
                />
              </div>
            )}
            <div className="customer-auth-field">
              <label htmlFor="customer-auth-email">Email address</label>
              <input
                id="customer-auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={onChange}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
            <div className="customer-auth-field">
              <div className="customer-auth-password-label">
                <label htmlFor="customer-auth-password">Password</label>
                {tab === "signin" && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="customer-auth-password">
                <input
                  id="customer-auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    tab === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={tab === "signup" ? 8 : undefined}
                  value={form.password}
                  onChange={onChange}
                  placeholder={
                    tab === "signup"
                      ? "Choose a strong password"
                      : "Enter your password"
                  }
                  disabled={loading}
                  aria-describedby={
                    tab === "signup"
                      ? "customer-auth-password-rules"
                      : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <Eye size={18} strokeWidth={1.6} />
                  ) : (
                    <EyeOff size={18} strokeWidth={1.6} />
                  )}
                </button>
              </div>
              {tab === "signup" && (
                <ul
                  className="customer-auth-password-rules"
                  id="customer-auth-password-rules"
                >
                  {passwordRules.map(([label, met]) => (
                    <li key={label} data-met={met}>
                      <span aria-hidden="true">
                        {met ? <Check size={11} strokeWidth={2} /> : <span />}
                      </span>
                      {label}
                      <span className="sr-only">
                        {met ? " — met" : " — required"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="customer-auth-consent">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(event) => setAcceptPrivacy(event.target.checked)}
                required
                disabled={loading}
              />
              <span>
                I have read and accept the{" "}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {error && !ownerMismatch && (
              <p className="customer-auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="customer-auth-submit"
              disabled={loading}
            >
              {loading
                ? tab === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : tab === "signup"
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </form>
          <div className="customer-auth-divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="customer-auth-google"
            disabled={loading}
            onClick={handleGoogleAuth}
          >
            <GoogleMark />
            Continue with Google
          </button>
          <p className="customer-auth-switch">
            {tab === "signup" ? "Already have an account?" : "New to serveQ?"}{" "}
            <button
              type="button"
              disabled={loading}
              onClick={() => changeTab(tab === "signup" ? "signin" : "signup")}
            >
              {tab === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </main>
      <footer className="customer-auth-footer">
        <Link to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to serveQ
        </Link>
        <span>A little less waiting. A little more living.</span>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={form.email}
        className="customer-auth-recovery"
      />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

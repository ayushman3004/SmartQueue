import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useSeo } from "../utils/useSeo";
import "../styles/business-admission.css";
import TurnstileWidget from "../components/TurnstileWidget";
export default function BusinessApplicationPage({ embedded = false }) {
  useSeo({
    title: embedded
      ? "ServeQ for Business — Apply to join"
      : "Apply for a ServeQ business account",
    description:
      "Apply for a personally reviewed ServeQ business account. Tell us about your venue and our team will contact you after review.",
    robots: embedded ? "index, follow" : "noindex, follow",
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.privacyAcknowledged = data.privacyAcknowledged === "on";
    if (turnstileToken) data.turnstileToken = turnstileToken;
    try {
      const response = await api.post("/business-applications", data);
      setMessage(response.data.message);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to submit your application. Please try again.",
      );
    } finally {
      if (turnstileToken) {
        setTurnstileToken(null);
        setVerificationAttempt(value => value + 1);
      }
      setBusy(false);
    }
  }
  return (
    <section
      className={`admission ${embedded ? "admission-embedded" : ""}`}
      id="apply"
      aria-labelledby="application-heading"
    >
      {!embedded && (
        <header className="admission-nav">
          <Link to="/business">← ServeQ for Business</Link>
          <Link to="/hub/login">Owner login</Link>
        </header>
      )}
      <div className="admission-form">
        <p className="admission-eyebrow">A better way to welcome people</p>
        <h1 id="application-heading">Tell us about your business.</h1>
        <p>
          Our team reviews every application. Once approved, you’ll receive an
          invitation to verify your email and set up your venue.
        </p>
        {message ? (
          <div role="status" className="admission-notice">
            <h2>Application received</h2>
            <p>{message}</p>
            <p>For new applications, check your inbox and spam for an acknowledgement email. Submitting again does not send another email while a request already exists. Check spam, or contact <a href="mailto:support@serveq.tech">support@serveq.tech</a> if it hasn’t arrived.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="admission-fields">
              {[
                ["businessName", "Business name"],
                ["ownerName", "Owner’s full name"],
                ["email", "Business email", "email"],
                ["phone", "Contact number", "tel"],
                ["businessAddress", "Business address"],
                ["city", "City"],
              ].map(([name, label, type]) => (
                <label key={name}>
                  {label}
                  <input
                    name={name}
                    type={type || "text"}
                    required
                    maxLength={
                      name === "businessAddress"
                        ? 400
                        : name === "email"
                          ? 254
                          : name === "phone"
                            ? 24
                            : 120
                    }
                    autoComplete={name === "email" ? "email" : undefined}
                  />
                </label>
              ))}
              <label>
                Business category
                <select name="businessCategory" required>
                  <option value="">Choose a category</option>
                  <option value="clinic">Clinic</option>
                  <option value="healthcare">Healthcare</option>
                </select>
              </label>
              <label>
                Number of employees <span>(optional)</span>
                <input name="employees" type="number" min="1" max="100000" />
              </label>
            </div>
            <label>
              About your business
              <textarea
                name="description"
                required
                maxLength="2000"
                rows="3"
                placeholder="What services do you offer, and how do customers visit?"
              />
            </label>
            <label>
              Website or social profile <span>(optional)</span>
              <input
                name="website"
                type="url"
                maxLength="500"
                placeholder="https://"
              />
            </label>
            <label>
              Anything else? <span>(optional)</span>
              <textarea name="comments" maxLength="2000" rows="2" />
            </label>
            <label className="admission-check">
              <input type="checkbox" name="privacyAcknowledged" required />
              <span>
                I have read the <Link to="/privacy">privacy notice</Link> and
                acknowledge that ServeQ will use these details to review and
                contact me about this application.
              </span>
            </label>
            <TurnstileWidget key={verificationAttempt} action="business_application" onToken={setTurnstileToken} />
            {error && (
              <p role="alert" className="admission-error">
                {error}
              </p>
            )}
            <button disabled={busy} className="admission-primary">
              {busy ? "Submitting…" : "Submit application →"}
            </button>
            <p className="admission-fine">
              Applying does not activate an account or start a paid
              subscription.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

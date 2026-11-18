import { Link } from "react-router-dom";
import { CalendarDays, Users, Clock3, ArrowUpRight, Check } from "lucide-react";
import BusinessApplicationPage from "./BusinessApplicationPage";
import { useSeo } from "../utils/useSeo";
import { SUBSCRIPTION_PLANS } from "../shared/subscriptionPlans";
import "../styles/business-admission.css";
export default function BusinessMarketingPage() {
  useSeo({
    title: "ServeQ for Business — Apply to join",
    description:
      "Manage queues, appointments and staff in one place. Apply for a personally reviewed ServeQ business account.",
    canonical: "https://www.serveq.tech/business",
  });
  const plans = Object.values(SUBSCRIPTION_PLANS);
  return (
    <div className="admission business-marketing">
      <header className="admission-nav">
        <Link to="/">
          <img src="/serveq-logo.png" alt="serveQ" width="130" />
        </Link>
        <nav>
          <Link to="/hub/login">Owner login</Link>
          <a href="#apply" className="admission-primary">
            Apply to join →
          </a>
        </nav>
      </header>
      <section className="business-marketing-hero">
        <p className="admission-eyebrow">ServeQ for Business</p>
        <h1>
          Less waiting.
          <br />
          <em>More welcoming.</em>
        </h1>
        <p>
          Give customers their time back. Manage your walk-ins, appointments and
          team from one place, while people follow their turn on their phone.
        </p>
        <a href="#apply" className="admission-primary">
          Apply to join ServeQ <ArrowUpRight size={18} />
        </a>
        <span>Personally reviewed. Set up with care.</span>
      </section>
      <section className="admission-section">
        <p className="admission-eyebrow">Make room for better service</p>
        <h2>A busy day can feel a little calmer.</h2>
        <div className="admission-grid">
          {[
            [
              Users,
              "Crowded waiting areas",
              "Let customers join a digital queue and follow their turn nearby.",
            ],
            [
              CalendarDays,
              "Bookings scattered everywhere",
              "Keep appointments and walk-ins together, with services and staff availability.",
            ],
            [
              Clock3,
              "“How much longer?”",
              "Show a live queue position and an estimated wait as your team serves customers.",
            ],
          ].map(([_Icon, title, copy]) => (
            <article key={title}>
              <_Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="admission-section admission-clay">
        <p className="admission-eyebrow">Your team, connected</p>
        <h2>One place to run the day.</h2>
        <div className="admission-grid">
          {[
            [
              "Live queues",
              "Call the next customer, manage the waiting list and keep everyone updated.",
            ],
            [
              "Appointments",
              "Set service durations, operating hours and available booking slots.",
            ],
            [
              "Staff & services",
              "Organise your team, configure your services and track daily operations.",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <Check />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="admission-section">
        <p className="admission-eyebrow">From application to opening day</p>
        <h2>We’ll help you get started.</h2>
        <ol className="admission-grid">
          {[
            [
              "Apply",
              "Tell us about your business. Our team reviews your details before approving access.",
            ],
            [
              "Activate",
              "Use your email invitation and complete email OTP verification within five hours. Change your temporary password within 24 hours.",
            ],
            [
              "Set up & welcome",
              "Choose your plan, complete the existing setup steps, add services and staff, then launch your venue.",
            ],
          ].map(([title, copy], i) => (
            <li key={title}>
              <span className="admission-eyebrow">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="admission-section admission-sage">
        <h2>Built around your kind of service.</h2>
        <div className="admission-grid">
          {[
            [
              "Salons",
              "Coordinate haircuts, grooming appointments and walk-ins.",
            ],
            [
              "Clinics",
              "Organise consultation bookings and the patient queue.",
            ],
            [
              "Service centres",
              "Give visitors a clear turn and help staff manage arrivals.",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <p>
          After approval, choose{" "}
          {plans.map((p) => `${p.name}: ₹${p.price}/month`).join(" or ")}. Each
          payment covers 30 days; no automatic renewal. Review full terms before
          payment.
        </p>
      </section>
      <section className="admission-section admission-faq">
        <p className="admission-eyebrow">Before you apply</p>
        <h2>A few useful answers.</h2>
        {[
          [
            "Can I create an owner account myself?",
            "Apply first. Only ServeQ administrators can approve a business and send an owner invitation.",
          ],
          [
            "What happens after approval?",
            "We email your login details, a single-use activation code and a link. Complete password login and the email OTP before the five-hour deadline.",
          ],
          [
            "What if my invitation expires?",
            "Contact ServeQ to request a fresh invitation. Your application remains on record.",
          ],
          [
            "When do I pay?",
            "Applying is free. After activation, review and choose a plan before continuing your venue setup.",
          ],
          [
            "Do I need to set everything up again?",
            "Existing approved owners keep their current onboarding and dashboard. Sign in through Owner login.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <BusinessApplicationPage embedded />
    </div>
  );
}

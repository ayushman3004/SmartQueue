import {
  ArrowRight,
  Calendar,
  Check,
  Eye,
  LogOut,
  Ticket,
  User,
} from "lucide-react";
import "../styles/queue-status.css";

export default function QueueStatusPass({
  business,
  isSalon,
  isServing,
  position,
  peopleAhead,
  waitingCount,
  specialist,
  serviceName,
  duration,
  times,
  amount,
  paid,
  leaving,
  fallbackImage,
  onLeave,
  onViewQueue,
  onBook,
}) {
  const milestones = [
    { label: "Joined queue", time: times.joinedTimeStr, state: "complete" },
    {
      label: isServing ? "Now serving" : "In line",
      time: times.servingTimeStr,
      state: "current",
    },
    { label: "Estimated finish", time: times.finishEtaStr, state: "upcoming" },
    { label: "Completed", time: "—", state: "upcoming" },
  ];

  return (
    <section
      className="queue-status"
      data-service={isSalon ? "salon" : "clinic"}
      aria-label="Your queue pass and visit details"
    >
      <div className="queue-pass-layout">
        <article
          className="queue-personal-pass"
          aria-labelledby="queue-pass-heading"
        >
          <header className="queue-pass-top">
            <span className="queue-eyebrow">Your queue pass</span>
            <span className="queue-ticket-emblem" aria-hidden="true">
              <Ticket size={23} strokeWidth={1.5} />
            </span>
          </header>
          <div className="queue-status-badge" role="status">
            <span aria-hidden="true" />
            {isServing ? "Ready for you" : "You’re in line"}
          </div>
          <h2 id="queue-pass-heading">
            {isServing ? "It’s your turn." : `You’re number ${position}.`}
          </h2>
          <p className="queue-pass-description">
            {isServing
              ? "Head to the service desk. Your specialist is ready to welcome you."
              : `${peopleAhead} ${peopleAhead === 1 ? "person is" : "people are"} ahead of you. Keep this pass handy and stay nearby.`}
          </p>
          <div className="queue-specialist">
            <span className="queue-person-icon" aria-hidden="true">
              <User size={22} strokeWidth={1.5} />
            </span>
            <div>
              <span className="queue-eyebrow">
                {isSalon ? "Your stylist" : "Your specialist"}
              </span>
              <h3>{specialist.name}</h3>
              <p>{specialist.role}</p>
            </div>
          </div>
          <div className="queue-pass-footnote">
            <Ticket size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>Keep this pass open for your visit.</span>
          </div>
          <button
            type="button"
            className="queue-leave-button"
            disabled={leaving}
            onClick={onLeave}
          >
            <LogOut size={17} strokeWidth={1.7} aria-hidden="true" />
            {leaving ? "Leaving queue…" : "Leave queue"}
          </button>
        </article>

        <article
          className="queue-visit-details"
          aria-labelledby="queue-venue-heading"
        >
          <header className="queue-venue-header">
            <img
              src={business.images?.[0] || fallbackImage}
              alt={business.name}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = fallbackImage;
              }}
            />
            <div className="queue-venue-name">
              <p className="queue-eyebrow">
                {isSalon ? "Salon" : "Clinic"} · Your visit
              </p>
              <h3 id="queue-venue-heading">{business.name}</h3>
            </div>
            <span
              className="queue-open-badge"
              data-open={Boolean(business.isOpen)}
            >
              <span aria-hidden="true" />
              {business.isOpen ? "Open" : "Closed"}
            </span>
          </header>
          <div className="queue-service-summary">
            <div className="queue-service-copy">
              <span className="queue-eyebrow">
                {isServing ? "Now serving you" : "Your upcoming service"}
              </span>
              <h4>{serviceName}</h4>
              <p>
                {duration} min <span aria-hidden="true">·</span>{" "}
                {specialist.name}
              </p>
            </div>
            <div className="queue-visit-eta">
              <span className="queue-eyebrow">
                {isServing ? "Estimated finish" : "Estimated start"}
              </span>
              <strong>
                {isServing ? times.finishEtaStr : times.servingTimeStr}
              </strong>
              <span>{waitingCount} waiting</span>
            </div>
          </div>
          <ol className="queue-visit-timeline" aria-label="Visit progress">
            {milestones.map((step) => (
              <li
                key={step.label}
                data-state={step.state}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                <span className="queue-timeline-dot" aria-hidden="true">
                  {step.state === "complete" ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : null}
                </span>
                <span className="queue-timeline-label">{step.label}</span>
                <span className="queue-timeline-time">{step.time}</span>
              </li>
            ))}
          </ol>
          <div className="queue-payment-summary" data-paid={paid}>
            <span className="queue-payment-symbol" aria-hidden="true">
              ₹
            </span>
            <div>
              <span className="queue-eyebrow">Pay at the counter</span>
              <strong>₹{amount}</strong>
            </div>
            <span className="queue-payment-state">
              {paid ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <span className="queue-payment-dot" aria-hidden="true" />
              )}
              {paid ? "Paid at counter" : "Payment pending"}
            </span>
          </div>
          <div className="queue-pass-actions">
            <button
              type="button"
              className="queue-primary-action"
              onClick={onViewQueue}
            >
              <Eye size={17} strokeWidth={1.6} aria-hidden="true" />
              View live queue
            </button>
            <button
              type="button"
              className="queue-secondary-action"
              onClick={onBook}
            >
              <Calendar size={17} strokeWidth={1.6} aria-hidden="true" />
              Booking options
            </button>
          </div>
        </article>
      </div>
      <section
        className="queue-booking-callout"
        aria-label="Appointment options"
      >
        <span className="queue-booking-icon" aria-hidden="true">
          <Calendar size={23} strokeWidth={1.5} />
        </span>
        <div>
          <h3>Prefer a different time?</h3>
          <p>You can also book an appointment for your next visit.</p>
        </div>
        <button type="button" onClick={onBook}>
          Book an appointment
          <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </section>
    </section>
  );
}

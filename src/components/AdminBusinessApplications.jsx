import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/business-admission.css";
const date = (value) => (value ? new Date(value).toLocaleString() : "—");
const invitationState = (application, now) =>
  application.invitation?.activatedAt
    ? "ACTIVE"
    : application.invitation?.expiresAt
      ? new Date(application.invitation.expiresAt).getTime() <= now
        ? "EXPIRED"
        : "INVITED"
      : "Not issued";
export default function AdminBusinessApplications() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState({
      applications: [],
      total: 0,
    }),
    [selected, setSelected] = useState(null),
    [notes, setNotes] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.get("/admin/applications", {
        params: {
          status,
          search,
          page,
        },
      });
      setData(response.data.data);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load applications.");
    }
  }, [status, search, page]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);
  async function review(action) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(
        `/admin/applications/${selected._id}/${action}`,
        {
          notes,
        },
      );
      setSelected(response.data.data.application);
      setNotice(
        action === "resend-acknowledgement"
          ? response.data.data.application.acknowledgement?.delivery === "SENT" ? "Acknowledgement accepted by the email provider. Check inbox and spam." : "Acknowledgement delivery failed. Check the backend email configuration and provider logs, then retry."
          : action === "reject"
          ? "Application rejected."
          : response.data.data.application.invitation?.delivery === "FAILED"
            ? "Invitation delivery failed. Use Reissue invitation to send fresh credentials."
            : "Invitation issued.",
      );
      await load();
    } catch (error) {
      setError(
        error.response?.data?.message || "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeRequest() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/applications/${selected._id}`, { data: { confirm: deleteConfirmation } });
      setSelected(null);
      setDeleteConfirmation("");
      setNotice("Access request deleted. The applicant can apply again using the same email.");
      await load();
    } catch (failure) {
      setError(failure.response?.data?.message || "Could not delete the access request.");
    } finally { setBusy(false); }
  }
  return (
    <section className="admission admission-admin">
      <h2>Business applications</h2>
      <p>
        Review businesses before granting owner access. No account is created
        until approval.
      </p>
      <div className="admission-fields">
        <label>
          Search applications
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Business, owner, email or city"
          />
        </label>
        <label>
          Application status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {[
              ["", "All applications"],
              ["PENDING", "Pending"],
              ["APPROVED", "Approved"],
              ["REJECTED", "Rejected"],
              ["EXPIRED", "Expired invitations"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="admission-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admission-notice">
          {notice}
        </p>
      )}
      <div className="admission-admin-layout">
        <div>
          <p>{data.total} application(s)</p>
          {data.applications.map((app) => (
            <button
              className="application-row"
              key={app._id}
              onClick={() => {
                setSelected(app);
                setDeleteConfirmation("");
                setNotes(app.reviewNotes || "");
                setNotice("");
              }}
              aria-pressed={selected?._id === app._id}
            >
              <strong>{app.businessName}</strong>
              <span>
                {app.ownerName} · {app.city}
              </span>
              <span>
                {app.status}
                {app.invitation?.issuedAt
                  ? ` · ${invitationState(app, now)}`
                  : ""}{" "}
                {app.invitation?.delivery &&
                  `· Email ${app.invitation.delivery.toLowerCase()}`}
              </span>
              <small>{date(app.submittedAt)}</small>
            </button>
          ))}
          {!data.applications.length && <p>No applications match this view.</p>}
          <div className="admission-login-links">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              ← Previous
            </button>
            <button
              disabled={page * 30 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
        {selected ? (
          <article className="application-detail">
            <h3>{selected.businessName}</h3>
            <dl>
              {[
                ["Owner", selected.ownerName],
                ["Email", selected.email],
                ["Phone", selected.phone],
                ["Category", selected.businessCategory],
                ["Address", `${selected.businessAddress}, ${selected.city}`],
                ["Description", selected.description],
                ["Employees", selected.employees],
                ["Website / social profile", selected.website],
                ["Comments", selected.comments],
                ["Status", selected.status],
                ["Acknowledgement email", selected.acknowledgement?.delivery || "Not recorded"],
                ["Acknowledgement last attempted", date(selected.acknowledgement?.attemptedAt)],
                ["Submitted", date(selected.submittedAt)],
                ["Reviewed", date(selected.reviewedAt)],
                ["Invitation status", invitationState(selected, now)],
                ["Email delivery", selected.invitation?.delivery],
                ["Invitation expires", date(selected.invitation?.expiresAt)],
                ["Activated", date(selected.invitation?.activatedAt)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <label>
              Review notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength="2000"
                rows="3"
                disabled={busy}
              />
            </label>
            {selected.status === "PENDING" && (
              <div className="admission-login-links">
                <button
                  disabled={busy}
                  onClick={() => review("approve")}
                  className="admission-primary"
                >
                  {busy ? "Processing…" : "Approve & invite"}
                </button>
                <button disabled={busy} onClick={() => review("reject")}>
                  Reject application
                </button>
              </div>
            )}
            {selected.status === "APPROVED" &&
              !selected.invitation?.activatedAt && (
                <>
                  <button
                    disabled={busy}
                    className="admission-primary"
                    onClick={() => review("reissue")}
                  >
                    {busy ? "Sending…" : "Reissue invitation"}
                  </button>
                  <p className="admission-fine">
                    Replaces previous credentials and starts a fresh five-hour
                    window. The owner account and business stay the same.
                  </p>
                </>
              )}
            <div className="admission-login-links">
              <button disabled={busy} onClick={() => review("resend-acknowledgement")}>Resend acknowledgement email</button>
            </div>
            <p className="admission-fine">Sent means accepted by the email provider. It does not confirm arrival in the inbox.</p>
            <details>
              <summary>Delete access request / allow reapplication</summary>
              <p>Deletes this request from the review list and lets the applicant apply again with the same email. If approved, this revokes the old owner login and closes their venues. Historical records are retained. A new application starts fresh.</p>
              <label>Type DELETE ACCESS to confirm
                <input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={busy} autoComplete="off" />
              </label>
              <button type="button" disabled={busy || deleteConfirmation !== "DELETE ACCESS"} onClick={removeRequest}>Delete access request</button>
            </details>
            <h4>Audit history</h4>
            <ul>
              {selected.audit?.map((entry, i) => (
                <li key={i}>
                  {entry.action.replaceAll("_", " ")} · {date(entry.at)}
                </li>
              ))}
            </ul>
          </article>
        ) : (
          <p>Select an application to review its details.</p>
        )}
      </div>
    </section>
  );
}

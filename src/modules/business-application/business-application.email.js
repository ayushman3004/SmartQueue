import { sendEmailMessage } from "../auth/verification.service.js";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
export const sendBusinessNotice = async ({ to, subject, lines, action }) => {
  const text = lines.join("\n\n");
  return sendEmailMessage({
    to,
    subject,
    text,
    html: `<div style="background:#edf5ef;padding:32px;font-family:Arial,sans-serif;color:#173e30"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #c4d8c8;border-radius:24px;padding:32px"><h1>serveQ</h1><h2>${escape(subject)}</h2>${lines.map((line) => `<p style="line-height:1.7;overflow-wrap:anywhere">${escape(line)}</p>`).join("")}${action ? `<p><a href="${escape(action.url)}" style="display:inline-block;background:#315b45;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px">${escape(action.label)}</a></p>` : ""}</div></div>`,
  });
};
export const sendBusinessInvitation = ({
  application,
  password,
  credential,
  expiresAt,
}) => {
  const base = (process.env.CLIENT_URL || "https://www.serveq.tech").replace(
    /\/$/,
    "",
  );
  return sendBusinessNotice({
    to: application.email,
    subject: "Your business is approved — activate your ServeQ account",
    action: {
      url: `${base}/hub/activate`,
      label: "Activate your business account",
    },
    lines: [
      `Welcome, ${application.ownerName}. ServeQ has approved ${application.businessName}.`,
      `Registered login email: ${application.email}`,
      `Temporary password: ${password}`,
      `Single-use activation code: ${credential}`,
      `Open ${base}/hub/activate and enter these credentials. Then complete the email OTP verification. No credentials are included in the link.`,
      `Complete both login and OTP verification before ${expiresAt.toISOString()} (UTC), exactly five hours after issuance. After this deadline, request a new invitation from ServeQ.`,
      "Change your temporary password within 24 hours of completing activation. You can change it immediately. Keep this email private; the temporary password stops working when replaced.",
      `Approved owner login: ${base}/hub/login`,
    ],
  });
};

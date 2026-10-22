import nodemailer from "nodemailer";

/**
 * Creates the Nodemailer transporter based on environment variables.
 * Supported env vars:
 *   - SMTP_HOST / EMAIL_HOST (defaults to "smtp.gmail.com")
 *   - SMTP_PORT / EMAIL_PORT (defaults to 465 for SSL or 587)
 *   - SMTP_USER / EMAIL_USER / GMAIL_USER
 *   - SMTP_PASS / EMAIL_PASS / GMAIL_PASS / EMAIL_ACCESS_KEY
 *   - EMAIL_FROM (e.g. "serveQ Security <no-reply@serveq.tech>")
 */
export const getMailTransporter = () => {
  // Generic SMTP or Gmail configuration with strict timeouts to prevent hanging on cloud hosts
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS || process.env.EMAIL_ACCESS_KEY || "").trim();
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT);

  if (!user || !rawPass) {
    return null;
  }

  // For Gmail app passwords (16 letters), strip internal spaces. For custom SMTP, preserve password.
  const pass = host ? rawPass.trim() : rawPass.replace(/\s+/g, "");

  const timeoutOptions = {
    connectionTimeout: 10000, // 10s max socket connection timeout
    greetingTimeout: 5000,
    socketTimeout: 10000,
  };

  if (host) {
    const isPort465 = port === 465;
    return nodemailer.createTransport({
      host,
      port: port || 587,
      secure: isPort465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
      ...timeoutOptions,
    });
  }

  // Default to smtp.gmail.com with port 465 (direct SSL/TLS)
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    ...timeoutOptions,
  });
};

/**
 * Sends a branded 6-digit OTP email for password reset via Nodemailer.
 */
export const sendPasswordResetOtpEmail = async ({ to, name, otp }) => {
  const from = process.env.EMAIL_SECURITY_FROM || '"ServeQ Security" <security@serveq.tech>';
  const replyTo = process.env.EMAIL_SUPPORT || "support@serveq.tech";
  const transporter = getMailTransporter();

  const recipientName = name ? name.split(" ")[0] : "there";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your ServeQ password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar with brand accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF5537 0%, #FA5032 100%); height: 6px;"></td>
          </tr>

          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
                      Serve<span style="border-bottom: 3.5px solid #89AB33; padding-bottom: 2px;">Q</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 10px;">
                    <span style="display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: 0.25em; text-transform: uppercase; color: #114227; background-color: #EAF7EE; padding: 4px 8px; border-radius: 6px;">Security</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 36px 36px 36px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                Password Reset Verification Code
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Hi ${recipientName}, we received a request to reset the password for your <strong>ServeQ</strong> account. Use the one-time verification code below to complete your reset:
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #fff6f4; border: 2px dashed #fecbc2; border-radius: 16px; padding: 24px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #c2410c; margin-bottom: 8px;">
                      Your One-Time Passcode (OTP)
                    </div>
                    <div style="font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #FF5537; line-height: 1.2;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 8px;">
                      ⏱ Expires in <strong>10 minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                Never share this code with anyone. ServeQ staff will never contact you asking for your verification code.
              </p>

              <div style="padding: 14px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                  <strong>Didn't request this?</strong> If you did not initiate a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #64748b;">
                ServeQ — Smart Queue & Virtual Waiting
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                © ${new Date().getFullYear()} ServeQ Technologies. All rights reserved. • <a href="mailto:support@serveq.tech" style="color: #64748b;">support@serveq.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${recipientName},\n\nYour ServeQ password reset verification code is: ${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this password reset, please ignore this email.\n\n— ServeQ Security Team\nSupport: support@serveq.tech`;

  // 1. Direct Resend HTTPS REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: replyTo,
          subject: `${otp} is your ServeQ password reset verification code`,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`❌ [Resend API] Delivery failed for ${to}:`, data);
        return {
          sent: false,
          simulated: false,
          error: data?.message || "Failed to deliver email via Resend API",
        };
      }

      console.log(`✅ [Resend API] Password reset email sent to ${to} (Message ID: ${data.id})`);
      return {
        sent: true,
        simulated: false,
        messageId: data.id,
      };
    } catch (apiErr) {
      console.error(`❌ [Resend API Network Error]:`, apiErr.message);
      return {
        sent: false,
        simulated: false,
        error: `Resend API network error: ${apiErr.message}`,
      };
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (!transporter) {
    console.warn(`\n⚠️ [Nodemailer] Cannot send email to ${to}: SMTP credentials not configured.`);
    console.log(`🔑 [ServeQ Password Reset OTP for ${to}]: ${otp}\n`);
    return {
      sent: false,
      simulated: true,
      error: "Email service is not configured. Please add RESEND_API_KEY in environment variables.",
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      replyTo,
      subject: `${otp} is your ServeQ password reset verification code`,
      text,
      html,
    });
    console.log(`✅ [Nodemailer] Password reset email sent to ${to} (Message ID: ${info.messageId})`);
    return {
      sent: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ [Nodemailer] Failed to send email to ${to}:`, error.message);
    return {
      sent: false,
      simulated: false,
      error: `Email delivery failed: ${error.message}.`,
    };
  }
};

/**
 * Sends a launch confirmation email to early prelaunch customers.
 * Redesigned to match the ServeQ obsidian header and mint-accented waiting list layout.
 */
export const sendLaunchConfirmationEmail = async ({ to }) => {
  const from = process.env.EMAIL_SUPPORT_FROM || '"ServeQ" <support@serveq.tech>';
  const replyTo = process.env.EMAIL_SUPPORT || "support@serveq.tech";
  const transporter = getMailTransporter();

  const subject = "Thank you for joining the ServeQ pre-launch";
  const previewText = "You're on the list. Discover a smarter way to manage queues and appointments.";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Hidden Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: transparent; mso-hide: all;">
    ${previewText}
    ${"&zwnj;&nbsp;".repeat(30)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px -8px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.05);" cellspacing="0" cellpadding="0">
          
          <!-- Obsidian Hero Header -->
          <tr>
            <td style="background-color: #0a1118; padding: 36px 36px 36px 36px; text-align: left;">
              <!-- Brand Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #ffffff; color: #0a1118; width: 34px; height: 34px; border-radius: 8px; font-weight: 800; font-size: 22px; text-align: center; line-height: 34px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      S
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      ServeQ
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Eyebrow Category -->
              <div style="color: #5eead4; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                YOU'RE ON THE LIST
              </div>

              <!-- Main Headline -->
              <h1 style="color: #ffffff; font-size: 32px; font-weight: 700; line-height: 1.25; margin: 0 0 12px 0; letter-spacing: -0.6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                The future of waiting starts here.
              </h1>

              <!-- Subhead -->
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you for being part of the ServeQ pre-launch.
              </p>
            </td>
          </tr>

          <!-- Clean Body Content -->
          <tr>
            <td style="padding: 36px 36px 36px 36px; background-color: #ffffff; text-align: left;">
              <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Hi there,
              </p>

              <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you for registering your interest in ServeQ. We're excited to have you with us as we prepare to make waiting simpler, smarter, and more convenient.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ServeQ helps salons, clinics, and service businesses manage appointments and live queues, keep customers informed, and deliver a smoother service experience.
              </p>

              <!-- What happens next? Callout Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f2f8f5; border: 1px solid #e3ede7; border-radius: 16px; padding: 22px 24px;">
                    <div style="font-size: 18px; font-weight: 700; color: #0d3b2e; margin-bottom: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      What happens next?
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: top; width: 22px; font-size: 14.5px; font-weight: 600; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          1.
                        </td>
                        <td style="vertical-align: top; font-size: 14.5px; color: #334155; line-height: 1.65; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          We'll keep you updated on our launch.
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top; width: 22px; font-size: 14.5px; font-weight: 600; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          2.
                        </td>
                        <td style="vertical-align: top; font-size: 14.5px; color: #334155; line-height: 1.65; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          You'll hear about important product updates and early access opportunities.
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top; width: 22px; font-size: 14.5px; font-weight: 600; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          3.
                        </td>
                        <td style="vertical-align: top; font-size: 14.5px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          You'll be among the first to discover a smarter way to manage queues and appointments.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                We're building ServeQ to solve real problems for businesses and their customers, and your early interest means a lot to us.
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you for being part of the journey. We look forward to sharing what's coming next.
              </p>

              <!-- Sign-off -->
              <div style="margin: 0 0 28px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #475569;">
                  Best regards,
                </p>
                <p style="margin: 0 0 2px 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">
                  Team ServeQ
                </p>
                <p style="margin: 0; font-size: 13.5px; color: #64748b;">
                  Smarter queues. Better experiences.
                </p>
              </div>

              <!-- Subtle Divider Line -->
              <div style="height: 1px; background-color: #edf2f7; margin: 28px 0 24px 0; line-height: 1px; font-size: 1px;">&nbsp;</div>

              <!-- Footer -->
              <div style="text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                  ServeQ &nbsp;|&nbsp; <a href="mailto:support@serveq.tech" style="color: #64748b; text-decoration: none;">support@serveq.tech</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  You're receiving this email because you registered your interest in ServeQ.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi there,\n\nThank you for registering your interest in ServeQ. We're excited to have you with us as we prepare to make waiting simpler, smarter, and more convenient.\n\nServeQ helps salons, clinics, and service businesses manage appointments and live queues, keep customers informed, and deliver a smoother service experience.\n\nWhat happens next?\n1. We'll keep you updated on our launch.\n2. You'll hear about important product updates and early access opportunities.\n3. You'll be among the first to discover a smarter way to manage queues and appointments.\n\nWe're building ServeQ to solve real problems for businesses and their customers, and your early interest means a lot to us.\n\nThank you for being part of the journey. We look forward to sharing what's coming next.\n\nBest regards,\nTeam ServeQ\nSmarter queues. Better experiences.\n\nServeQ | support@serveq.tech\nYou're receiving this email because you registered your interest in ServeQ.`;

  // 1. Direct Resend HTTPS REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: replyTo,
          subject,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`❌ [Resend API] Delivery failed for ${to}:`, data);
        return {
          sent: false,
          simulated: false,
          error: data?.message || "Failed to deliver launch email via Resend API",
        };
      }

      console.log(`✅ [Resend API] Launch confirmation email sent to ${to} (Message ID: ${data.id})`);
      return {
        sent: true,
        simulated: false,
        messageId: data.id,
      };
    } catch (apiErr) {
      console.error(`❌ [Resend API Network Error]:`, apiErr.message);
      return {
        sent: false,
        simulated: false,
        error: `Resend API network error: ${apiErr.message}`,
      };
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (!transporter) {
    console.warn(`\n⚠️ [Nodemailer] Cannot send launch email to ${to}: SMTP credentials not configured.`);
    return {
      sent: false,
      simulated: true,
      error: "Email service not configured.",
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      replyTo,
      subject,
      text,
      html,
    });
    console.log(`✅ [Nodemailer] Launch confirmation email sent to ${to} (Message ID: ${info.messageId})`);
    return {
      sent: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ [Nodemailer] Failed to send launch email to ${to}:`, error.message);
    return {
      sent: false,
      simulated: false,
      error: error.message,
    };
  }
};

/**
 * Sends a notification email to support@serveq.tech when a user submits a help & support ticket.
 * Sets reply_to to the user's email so the support team can reply directly.
 */
export const sendSupportTicketEmail = async ({
  ticketId,
  name,
  email,
  subject,
  message,
  userRole,
  businessName,
}) => {
  const from = process.env.EMAIL_SUPPORT_FROM || '"ServeQ HelpDesk" <support@serveq.tech>';
  const supportEmail = process.env.EMAIL_SUPPORT || "support@serveq.tech";
  const replyTo = `${name} <${email}>`;
  const transporter = getMailTransporter();

  const formattedRole =
    userRole === "owner" ? "Business Owner" : userRole === "customer" ? "Customer" : userRole || "User";
  const ticketRef = ticketId ? `#${ticketId.slice(-6).toUpperCase()}` : "#QUERY";
  const emailSubject = `[Support Query ${ticketRef}] ${subject} — ${name} (${formattedRole})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px -8px rgba(15, 23, 42, 0.12);" cellspacing="0" cellpadding="0">
          
          <!-- Obsidian Header -->
          <tr>
            <td style="background-color: #0a1118; padding: 32px 36px; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #ffffff; color: #0a1118; width: 32px; height: 32px; border-radius: 8px; font-weight: 800; font-size: 20px; text-align: center; line-height: 32px;">
                      S
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ServeQ HelpDesk
                    </span>
                  </td>
                </tr>
              </table>

              <div style="color: #5eead4; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px 0;">
                NEW INQUIRY RECEIVED
              </div>

              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.3; margin: 0; letter-spacing: -0.4px;">
                ${subject}
              </h1>
            </td>
          </tr>

          <!-- Metadata Section -->
          <tr>
            <td style="padding: 24px 36px 12px 36px; background-color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;">
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding: 4px 0; width: 35%;"><strong>From:</strong></td>
                  <td style="font-size: 13.5px; color: #0f172a; padding: 4px 0;">${name} &lt;<a href="mailto:${email}" style="color: #0f172a; text-decoration: underline;">${email}</a>&gt;</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding: 4px 0;"><strong>Role:</strong></td>
                  <td style="font-size: 13.5px; color: #0f172a; padding: 4px 0;"><span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; background-color: #eaf7ee; color: #114227;">${formattedRole}</span></td>
                </tr>
                ${businessName ? `<tr><td style="font-size: 13px; color: #64748b; padding: 4px 0;"><strong>Business:</strong></td><td style="font-size: 13.5px; color: #0f172a; padding: 4px 0;"><strong>${businessName}</strong></td></tr>` : ""}
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding: 4px 0;"><strong>Ticket Ref:</strong></td>
                  <td style="font-size: 13.5px; font-family: monospace; font-weight: bold; color: #0f172a; padding: 4px 0;">${ticketRef}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 12px 36px 32px 36px; background-color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin-bottom: 8px;">
                User Message
              </div>
              <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; font-size: 14.5px; line-height: 1.65; color: #1e293b; white-space: pre-wrap;">${message}</div>

              <div style="margin-top: 24px; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; font-size: 12.5px; color: #166534;">
                💡 <strong>Quick Reply:</strong> Hitting <em>Reply</em> in your email client will reply directly to <strong>${name}</strong> at <code>${email}</code>.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                ServeQ Automated HelpDesk • Inquiries delivered to support@serveq.tech
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `New Support Inquiry [${ticketRef}]\n\nFrom: ${name} (${email})\nRole: ${formattedRole}\n${businessName ? `Business: ${businessName}\n` : ""}Subject: ${subject}\n\nMessage:\n${message}\n\nReply directly to this email to reach the user.`;

  // 1. Direct Resend HTTPS REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [supportEmail],
          reply_to: replyTo,
          subject: emailSubject,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ [Resend API] Support query forwarded to ${supportEmail} (ID: ${data.id})`);
        return { sent: true, simulated: false, messageId: data.id };
      }
      console.error(`❌ [Resend API] Support query forwarding failed:`, data);
    } catch (apiErr) {
      console.error(`❌ [Resend API Error]:`, apiErr.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: supportEmail,
        replyTo,
        subject: emailSubject,
        text,
        html,
      });
      console.log(`✅ [Nodemailer] Support query forwarded to ${supportEmail} (ID: ${info.messageId})`);
      return { sent: true, simulated: false, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [Nodemailer] Failed to forward support query:`, err.message);
    }
  }

  return { sent: false, simulated: true, error: "Email transporter unavailable" };
};

/**
 * Sends an automated confirmation acknowledgement to the user who opened the ticket.
 */
export const sendSupportUserAcknowledgementEmail = async ({
  ticketId,
  name,
  email,
  subject,
  message,
}) => {
  const from = process.env.EMAIL_SUPPORT_FROM || '"ServeQ Support" <support@serveq.tech>';
  const replyTo = process.env.EMAIL_SUPPORT || "support@serveq.tech";
  const transporter = getMailTransporter();

  const recipientFirst = name ? name.split(" ")[0] : "there";
  const ticketRef = ticketId ? `#${ticketId.slice(-6).toUpperCase()}` : "#QUERY";
  const emailSubject = `We've received your request: "${subject}" [${ticketRef}]`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <!-- Hidden Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: transparent; mso-hide: all;">
    We've received your message and our team will get back to you shortly.
    ${"&zwnj;&nbsp;".repeat(30)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px -8px rgba(15, 23, 42, 0.12);" cellspacing="0" cellpadding="0">
          
          <!-- Obsidian Hero Header -->
          <tr>
            <td style="background-color: #0a1118; padding: 36px 36px 32px 36px; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #ffffff; color: #0a1118; width: 34px; height: 34px; border-radius: 8px; font-weight: 800; font-size: 22px; text-align: center; line-height: 34px;">
                      S
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                      ServeQ
                    </span>
                  </td>
                </tr>
              </table>

              <div style="color: #5eead4; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 10px 0;">
                HELP & SUPPORT
              </div>

              <h1 style="color: #ffffff; font-size: 30px; font-weight: 700; line-height: 1.25; margin: 0 0 10px 0; letter-spacing: -0.5px;">
                We’re on it.
              </h1>

              <p style="color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0;">
                Your inquiry has reached our support operations team.
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 36px 36px 36px; background-color: #ffffff; text-align: left;">
              <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.65; color: #334155;">
                Hi ${recipientFirst},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #334155;">
                Thank you for reaching out to ServeQ Support. We have received your query regarding <strong>"${subject}"</strong> and our team is already reviewing the details.
              </p>

              <!-- Ticket Info Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f2f8f5; border: 1px solid #e3ede7; border-radius: 16px; padding: 22px 24px;">
                    <div style="font-size: 16px; font-weight: 700; color: #0d3b2e; margin-bottom: 12px;">
                      Request Summary
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size: 13.5px; color: #475569; padding: 3px 0; width: 38%;"><strong>Ticket Reference:</strong></td>
                        <td style="font-size: 13.5px; font-family: monospace; font-weight: bold; color: #0f172a; padding: 3px 0;">${ticketRef}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13.5px; color: #475569; padding: 3px 0;"><strong>Support Hours:</strong></td>
                        <td style="font-size: 13.5px; color: #0f172a; padding: 3px 0;">Mon – Sat, 9:00 AM – 7:00 PM (IST)</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13.5px; color: #475569; padding: 3px 0;"><strong>Expected Reply:</strong></td>
                        <td style="font-size: 13.5px; color: #0f172a; padding: 3px 0;">Within 24 hours</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #334155;">
                Our team is looking into your inquiry and will reply directly to this email thread. If you have any additional details or screenshots to share in the meantime, please feel free to reply directly to this message.
              </p>

              <!-- Sign-off -->
              <div style="margin: 28px 0 24px 0;">
                <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #475569;">
                  Best regards,
                </p>
                <p style="margin: 0 0 2px 0; font-size: 18px; font-weight: 800; color: #0f172a;">
                  Team ServeQ Support
                </p>
                <p style="margin: 0; font-size: 13.5px; color: #64748b;">
                  Smarter queues. Better experiences.
                </p>
              </div>

              <!-- Divider -->
              <div style="height: 1px; background-color: #edf2f7; margin: 24px 0 20px 0;">&nbsp;</div>

              <!-- Footer -->
              <div style="text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                  ServeQ &nbsp;|&nbsp; <a href="mailto:support@serveq.tech" style="color: #64748b; text-decoration: none;">support@serveq.tech</a>
                </p>
                <p style="margin: 0; font-size: 11.5px; color: #94a3b8;">
                  You're receiving this because you submitted a support request on ServeQ.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${recipientFirst},\n\nThank you for reaching out to ServeQ Support.\n\nWe have received your message regarding "${subject}" [${ticketRef}].\n\nSupport Hours: Monday – Saturday, 9:00 AM – 7:00 PM (IST)\nExpected Reply: Within 24 hours\n\nOur team is reviewing your inquiry and will reply directly to this email.\n\nBest regards,\nTeam ServeQ Support\nsupport@serveq.tech`;

  // 1. Direct Resend HTTPS REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          reply_to: replyTo,
          subject: emailSubject,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ [Resend API] User acknowledgement sent to ${email} (ID: ${data.id})`);
        return { sent: true, simulated: false, messageId: data.id };
      }
      console.error(`❌ [Resend API] Failed to send user acknowledgement:`, data);
    } catch (apiErr) {
      console.error(`❌ [Resend API Error]:`, apiErr.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: email,
        replyTo,
        subject: emailSubject,
        text,
        html,
      });
      console.log(`✅ [Nodemailer] User acknowledgement sent to ${email} (ID: ${info.messageId})`);
      return { sent: true, simulated: false, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [Nodemailer] Failed to send user acknowledgement:`, err.message);
    }
  }

  return { sent: false, simulated: true, error: "Email transporter unavailable" };
};




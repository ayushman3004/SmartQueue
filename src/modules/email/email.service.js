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
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const defaultFrom = process.env.RESEND_API_KEY
    ? "serveQ Security <onboarding@resend.dev>"
    : `"serveQ Security" <${user || "no-reply@serveq.tech"}>`;
  const from = process.env.EMAIL_FROM || defaultFrom;
  const transporter = getMailTransporter();

  const recipientName = name ? name.split(" ")[0] : "there";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your serveQ password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar with brand coral accent -->
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
                      serve<span style="border-bottom: 3.5px solid #89AB33; padding-bottom: 2px;">q</span>
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
                Hi ${recipientName}, we received a request to reset the password for your <strong>serveQ</strong> account. Use the one-time verification code below to complete your reset:
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
                serveQ — Smart Queue & Virtual Waiting
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                © ${new Date().getFullYear()} serveQ Technologies. All rights reserved.
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

  const text = `Hi ${recipientName},\n\nYour serveQ password reset verification code is: ${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this password reset, please ignore this email.\n\n— serveQ Security Team`;

  // 1. Direct Resend HTTPS REST API (Bypasses Render SMTP port blocking)
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
          subject: `${otp} is your serveQ password reset verification code`,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Fallback to onboarding@resend.dev if custom domain is not verified
        if (typeof data?.message === "string" && data.message.toLowerCase().includes("domain") && from !== "serveQ Security <onboarding@resend.dev>") {
          console.warn("⚠️ Custom domain not verified on Resend, falling back to onboarding@resend.dev");
          const retryRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "serveQ Security <onboarding@resend.dev>",
              to: [to],
              subject: `${otp} is your serveQ password reset verification code`,
              text,
              html,
            }),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok) {
            console.log(`✅ [Resend API] Delivered via onboarding@resend.dev (ID: ${retryData.id})`);
            return { sent: true, simulated: false, messageId: retryData.id };
          }
        }

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
    console.warn(`\n⚠️ [Nodemailer] Cannot send email to ${to}: SMTP_USER or SMTP_PASS is not configured in .env!`);
    console.log(`🔑 [ServeQ Password Reset OTP for ${to}]: ${otp}`);
    console.log(`ℹ️ Add SMTP_USER and SMTP_PASS or RESEND_API_KEY into .env to send real emails.\n`);
    return {
      sent: false,
      simulated: true,
      error: "Email service is not configured. Please add RESEND_API_KEY or SMTP_USER/SMTP_PASS in environment variables.",
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `${otp} is your serveQ password reset verification code`,
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
      error: `Email delivery failed: ${error.message}. Please configure RESEND_API_KEY for cloud hosting.`,
    };
  }
};

/**
 * Sends a launch confirmation email to early prelaunch customers.
 */
export const sendLaunchConfirmationEmail = async ({ to }) => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const defaultFrom = process.env.RESEND_API_KEY
    ? "serveQ <onboarding@resend.dev>"
    : `"serveQ" <${user || "no-reply@serveq.tech"}>`;
  const from = process.env.EMAIL_FROM || defaultFrom;
  const transporter = getMailTransporter();

  const recipientUsername = to.split("@")[0] || "there";
  const subject = "You're on the list! Welcome to serveQ Launch 🚀";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to serveQ Launch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #17131D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FFF8F5; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 24px; border: 1px solid rgba(142, 107, 219, 0.2); box-shadow: 0 20px 45px -15px rgba(86, 58, 128, 0.15); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Gradient Top Highlight -->
          <tr>
            <td style="background: linear-gradient(135deg, #F2C6E8 0%, #BFA0EB 50%, #8E6BDB 100%); height: 8px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #17131D;">
                      serve<span style="border-bottom: 3.5px solid #89AB33; padding-bottom: 2px;">q</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8E6BDB; background-color: #FAF5FF; border: 1px solid rgba(142, 107, 219, 0.25); padding: 5px 12px; border-radius: 999px;">
                      ● Prelaunch VIP
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 10px 36px 36px 36px;">
              <h1 style="margin: 0 0 14px 0; font-size: 24px; font-weight: 700; color: #17131D; line-height: 1.25; letter-spacing: -0.02em;">
                Something better is coming.
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #4B4256;">
                Hi <strong>${recipientUsername}</strong>, thank you for joining the <strong>serveQ</strong> early access list! You are officially registered in our database as a <strong>founding prelaunch customer</strong>.
              </p>

              <!-- VIP Benefit Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background: linear-gradient(180deg, #FAF7FF 0%, #F5EFFF 100%); border: 1px solid rgba(191, 160, 235, 0.5); border-radius: 16px; padding: 20px 24px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6D4BB8; margin-bottom: 12px;">
                      Your Founding Customer Perks
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13.5px; color: #2B1B4A; line-height: 1.5;">
                          ✨ <strong>First-in-line platform access</strong> before public rollout
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13.5px; color: #2B1B4A; line-height: 1.5;">
                          ⏱️ <strong>Real-time virtual queueing</strong> for salons, clinics & service venues
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13.5px; color: #2B1B4A; line-height: 1.5;">
                          🎁 <strong>Zero booking fees</strong> on your first 3 virtual queue passes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #4B4256;">
                We are putting the final touches on serveQ to eliminate crowded waiting rooms forever. We'll send you your private invitation link the moment our doors unlock.
              </p>

              <div style="margin-top: 24px; padding: 14px 18px; background-color: #FFF8F5; border-radius: 12px; border: 1px solid #F2C6E8;">
                <p style="margin: 0; font-size: 12px; color: #6F6679; line-height: 1.5;">
                  <strong>Customer Account:</strong> ${to} • <strong>Status:</strong> Prelaunch Customer Confirmed
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #08070A; color: #ffffff; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">
                serveQ — A Better Way to Get Things Done.
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.6);">
                © ${new Date().getFullYear()} serveQ. All rights reserved.
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

  const text = `Hi ${recipientUsername},\n\nThank you for joining the serveQ early access list!\n\nYou are officially confirmed in our database as a founding prelaunch customer.\n\nYour perks:\n• First-in-line platform access before public rollout\n• Real-time virtual queueing for salons, clinics & venues\n• Zero booking fees on your first 3 virtual queue passes\n\nWe will email you with your private access link the moment serveQ launches.\n\n— The serveQ Team\nhttps://serveq.tech`;

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
          subject,
          text,
          html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Fallback to onboarding@resend.dev if custom domain is not yet verified
        if (typeof data?.message === "string" && data.message.toLowerCase().includes("domain") && from !== "serveQ <onboarding@resend.dev>") {
          console.warn("⚠️ Custom domain not verified on Resend, falling back to onboarding@resend.dev for launch email");
          const retryRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "serveQ <onboarding@resend.dev>",
              to: [to],
              subject,
              text,
              html,
            }),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok) {
            console.log(`✅ [Resend API] Launch confirmation sent to ${to} via onboarding@resend.dev (ID: ${retryData.id})`);
            return { sent: true, simulated: false, messageId: retryData.id };
          }
        }

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


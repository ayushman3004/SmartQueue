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
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS || process.env.EMAIL_ACCESS_KEY || "").trim();
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT);

  if (!user || !rawPass) {
    return null;
  }

  // For Gmail app passwords (16 letters), strip internal spaces. For custom SMTP, preserve password.
  const pass = host ? rawPass.trim() : rawPass.replace(/\s+/g, "");

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
    });
  }

  // Default to smtp.gmail.com with port 465 (direct SSL/TLS)
  // This is significantly faster and more reliable than port 587 STARTTLS
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
};

/**
 * Sends a branded 6-digit OTP email for password reset via Nodemailer.
 */
export const sendPasswordResetOtpEmail = async ({ to, name, otp }) => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const from = process.env.EMAIL_FROM || `"serveQ Security" <${user || "no-reply@serveq.tech"}>`;
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
                      serve<span style="color: #FF5537;">Q</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 10px;">
                    <span style="display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: 0.25em; text-transform: uppercase; color: #FF5537; background-color: #fff1ef; padding: 4px 8px; border-radius: 6px;">Security</span>
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

  if (!transporter) {
    console.warn(`\n⚠️ [Nodemailer] Cannot send email to ${to}: SMTP_USER or SMTP_PASS is not configured in .env!`);
    console.log(`🔑 [ServeQ Password Reset OTP for ${to}]: ${otp}`);
    console.log(`ℹ️ Add SMTP_USER and SMTP_PASS into .env to send real emails via Gmail/SMTP.\n`);
    return {
      sent: false,
      simulated: true,
      error: "Email service is not configured. Please add SMTP_USER and SMTP_PASS to your .env file.",
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
      error: `Email delivery failed: ${error.message}. Please check your SMTP_USER and SMTP_PASS.`,
    };
  }
};

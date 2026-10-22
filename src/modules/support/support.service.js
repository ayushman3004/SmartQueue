import SupportTicket from "./support.model.js";
import Business from "../business/business.model.js";
import {
  sendSupportTicketEmail,
  sendSupportUserAcknowledgementEmail,
} from "../email/email.service.js";

export const createSupportMessage = async ({
  name,
  email,
  subject,
  message,
  user,
  ip,
}) => {
  const cleanName = (name || user?.name || "ServeQ Member").trim();
  const cleanEmail = (email || user?.email || "").trim().toLowerCase();
  const cleanSubject = (subject || "General Inquiry").trim();
  const cleanMessage = (message || "").trim();
  const userRole = user?.role || "customer";
  const userId = user?._id || null;

  let businessId = null;
  let businessName = "";

  if (userRole === "owner" && userId) {
    try {
      const biz = await Business.findOne({ ownerId: userId }).select("businessName");
      if (biz) {
        businessId = biz._id;
        businessName = biz.businessName;
      }
    } catch (bizErr) {
      console.warn("⚠️ Error fetching business details for support ticket:", bizErr.message);
    }
  }

  // 1. Create DB Ticket record
  const ticket = await SupportTicket.create({
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
    userRole,
    userId,
    businessId,
    businessName,
    ip: ip || "",
  });

  const ticketId = ticket._id.toString();

  // 2. Dispatch email to support@serveq.tech
  try {
    const notifyRes = await sendSupportTicketEmail({
      ticketId,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      userRole,
      businessName,
    });
    if (notifyRes?.sent) {
      ticket.emailSentToSupport = true;
      ticket.supportMessageId = notifyRes.messageId || "";
    }
  } catch (err) {
    console.error("⚠️ Failed to dispatch support inquiry to support@serveq.tech:", err.message);
  }

  // 3. Dispatch confirmation acknowledgement to user
  try {
    const ackRes = await sendSupportUserAcknowledgementEmail({
      ticketId,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
    });
    if (ackRes?.sent) {
      ticket.ackEmailSentToUser = true;
      ticket.ackMessageId = ackRes.messageId || "";
    }
  } catch (err) {
    console.error("⚠️ Failed to dispatch user acknowledgement email:", err.message);
  }

  await ticket.save().catch(() => {});

  return {
    success: true,
    ticketId,
    ticketNumber: ticketId.slice(-6).toUpperCase(),
    message: "Your message has been sent successfully! Our team will get back to you shortly.",
  };
};

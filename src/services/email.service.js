const nodemailer = require("nodemailer");
const httpStatus = require("http-status");
const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");

const transport = nodemailer.createTransport(config.email.smtp);

// The logo travels inside the message as an inline attachment referenced by
// Content-ID, rather than as a link to this server.
//
// A linked image cannot work here: Gmail and most webmail clients fetch images
// through their own proxy, so the request comes from the provider's servers and
// never from the recipient. That makes any localhost URL unreachable by
// definition, and even a public one leaves the logo dependent on this server
// still being reachable whenever the mail happens to be opened. Embedding it
// renders offline, needs no public URL, and dodges the proxy entirely.
const LOGO_CID = "ghorbari-logo";
const LOGO_URL = `cid:${LOGO_CID}`;
const LOGO_PATH = path.join(__dirname, "../../public/images/logo.png");

// Read once at startup instead of on every send. A missing file degrades to a
// logo-less email rather than breaking delivery.
let logoAttachment;
try {
  logoAttachment = {
    filename: "logo.png",
    content: fs.readFileSync(LOGO_PATH),
    contentType: "image/png",
    cid: LOGO_CID,
    // Without this the logo also shows up as a downloadable attachment.
    contentDisposition: "inline",
  };
} catch (err) {
  logger.warn("Email logo missing at %s, sending without it: %s", LOGO_PATH, err.message);
  logoAttachment = null;
}

/* istanbul ignore next */
if (config.env !== "test") {
  transport
    .verify()
    .then(() => logger.info("Connected to email server"))
    .catch((err) =>
      logger.warn(
        "Unable to connect to email server. Make sure you have configured the SMTP options in .env"
      )
    );
}


const sendEmail = async (to, subject, html) => {
  const msg = { from: config.email.from, to, subject, html };
  if (logoAttachment) {
    msg.attachments = [logoAttachment];
  }
  try {
    await transport.sendMail(msg);
  } catch (err) {
    // Log the technical detail for operators, then surface a generic failure to
    // the caller so an API request never reports success for mail that was
    // never accepted by the SMTP server.
    logger.error("Failed to send email to %s: %s", to, err.message || err);
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      "Could not send the email right now. Please try again in a moment."
    );
  }
};

/**
 * Send an email without making the caller wait for, or depend on, delivery.
 *
 * Use this only where the email is a side effect that must not fail the
 * surrounding operation (e.g. notifying a property owner about an enquiry).
 * The rejection is always handled here, so a dropped email can never surface
 * as an unhandled promise rejection and take the process down.
 */
const sendEmailInBackground = (sendPromiseFactory) => {
  Promise.resolve()
    .then(sendPromiseFactory)
    .catch((err) => logger.error("Background email failed: %s", err.message || err));
};

const sendEmailVerification = async (to, otp) => {
  const subject = "User verification code";
  const html = `
   <body style="background-color: #f3f4f6; padding: 2rem; font-family: Arial, sans-serif; color: #333;">
    <div
        style="max-width: 32rem; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15); text-align: center;">
        <img src="${LOGO_URL}"
            alt="Ghorbari" style="max-width: 10rem; margin-bottom: 1.5rem;">
        <h1 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937;">Welcome to Ghorbari
        </h1>
        <p style="color: #4b5563; margin-bottom: 1.5rem;">Thank you for joining Ghorbari! Your account is almost
            ready.</p>
        <div
            style="background: linear-gradient(135deg, #FF6625, #d3541dbf); color: #ffffff; padding: 1rem; border-radius: 0.5rem; font-size: 2rem; font-weight: 800; letter-spacing: 0.1rem; margin-bottom: 1.5rem;">
            ${otp}
        </div>
        <p style="color: #4b5563; margin-bottom: 1.5rem;">Collect this code to verify your account.</p>
        <p style="color: #e6441c; font-size: 0.85rem; margin-top: 1.5rem;">This code expires in <span
                id="timer">3:00</span>
            minutes.</p>
        <a href="https://shadat-hossain.netlify.app" style="color: #888; font-size: 12px; text-decoration: none;"
            target="_blank">ᯤ
            Develop by ᯤ</a>
    </div>
`;
  await sendEmail(to, subject, html);
};

const sendResetPasswordEmail = async (to, otp) => {
  const subject = "Password Reset Email";
  const html = `
       <body style="background-color: #f3f4f6; padding: 2rem; font-family: Arial, sans-serif; color: #333;">
          <div
              style="max-width: 32rem; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15); text-align: center;">
              <img src="${LOGO_URL}"
                  alt="Ghorbari" style="max-width: 8rem; margin-bottom: 1.5rem;">
              <h1 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937;">Password Reset Request
              </h1>
              <p style="color: #4b5563; margin-bottom: 1.5rem;">You requested a password reset for your account. Use the code
                  below to reset your password:</p>
              <div
                  style="background: linear-gradient(135deg, #fe773dcb, #FF6625); color: #ffffff; padding: 1rem; border-radius: 0.5rem; font-size: 2rem; font-weight: 800; letter-spacing: 0.1rem; margin-bottom: 1.5rem;">
                  ${otp}
              </div>
              <p style="color: #d6471c; margin-bottom: 1.5rem;">Collect this code to reset your password. This code is valid
                  for
                  3
                  minutes.</p>
              <p style="color: #6b7280; font-size: 0.875rem; margin-top: 1.5rem;">If you did not request a password reset,
                  please ignore this email.</p>
              <a href="https://shadat-hossain.netlify.app" style="color: #888; font-size: 12px; text-decoration: none;"
                  target="_blank">ᯤ
                  Develop by ᯤ</a>
          </div>
      </body>
`;
  await sendEmail(to, subject, html);
};

// Labels for the enquiry intent captured on the contact record. Kept here so
// the email reads as a human sentence rather than echoing the raw enum.
const INTENT_LABELS = {
  buy: "wants to buy",
  rent: "wants to rent",
  lease: "wants to lease",
  auction: "is interested in the auction",
  visit: "wants to schedule a visit",
  general: "sent an enquiry about",
};

/**
 * Escape values interpolated into email HTML.
 *
 * The message body is free text supplied by whoever submitted the form, so
 * without this a submission containing markup would be rendered as HTML in the
 * recipient's inbox.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Flatten a value for use inside a header line such as Subject.
 *
 * Newlines are stripped because a header break is how header injection works;
 * nodemailer encodes headers, but not relying on that is cheap. Length is capped
 * so a long title cannot push the subject into mail-client truncation.
 */
const headerSafe = (value, max = 90) => {
  const clean = String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const detailRow = (icon, label, value) => {
  if (!value) return "";
  return `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 0.9rem; white-space: nowrap; vertical-align: top;">
          <span style="margin-right: 6px;">${icon}</span>${escapeHtml(label)}
        </td>
        <td style="padding: 8px 0 8px 16px; color: #111827; font-size: 0.95rem; font-weight: 500;">
          ${escapeHtml(value)}
        </td>
      </tr>`;
};

/**
 * Notify the recipient of a contact submission.
 *
 * Two shapes arrive here: a property enquiry, which goes to the agent who
 * listed it, and a site-wide contact form submission, which goes to the address
 * in CONTACT_US_EMAIL. The copy differs because an agent needs to know which
 * property and what the sender wants, while a general submission has neither.
 */
const sendContactsUsEmail = async (allData) => {
  const isPropertyEnquiry = allData.type === "property";
  const to = allData.propertyOwnerEmail || config.email.contactUsRecipient;

  if (!to) {
    logger.warn("No recipient for contact submission; set CONTACT_US_EMAIL");
    return;
  }

  const senderName = allData.fullName || "Someone";
  const intentLabel = INTENT_LABELS[allData.intent] || INTENT_LABELS.general;

  const subject = isPropertyEnquiry
    ? `New enquiry: ${headerSafe(allData.propertyTitle || "your property", 60)} — ${headerSafe(senderName, 40)}`
    : `New contact form submission from ${headerSafe(senderName, 60)}`;

  const heading = isPropertyEnquiry
    ? `${escapeHtml(senderName)} ${intentLabel} ${escapeHtml(allData.propertyTitle || "your property")}`
    : `New message from ${escapeHtml(senderName)}`;

  const greeting = isPropertyEnquiry && allData.propertyOwnerName
    ? `<p style="color:#4b5563; margin: 0 0 20px;">Hello ${escapeHtml(allData.propertyOwnerName)}, you have a new enquiry on one of your listings.</p>`
    : "";

  // Deep link so the agent can open the listing straight from the email. Falls
  // back to omitting the row when the slug is unknown.
  const propertyLink = isPropertyEnquiry && allData.propertySlug
    ? `${config.websiteUrl}/properties/${allData.propertySlug}`
    : null;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: linear-gradient(135deg, #FF6625, #d3541d); padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">${heading}</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      ${greeting}
      <table style="width: 100%; border-collapse: collapse;">
        ${detailRow("👤", "Name", senderName)}
        ${detailRow("📧", "Email", allData.email)}
        ${detailRow("📞", "Phone", allData.phoneNumber)}
        ${isPropertyEnquiry ? detailRow("🏠", "Property", allData.propertyTitle) : ""}
      </table>
    </div>

    <div style="margin-top: 16px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #FF6625; border-radius: 8px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
      <p style="margin: 0; color: #111827; font-size: 1rem; line-height: 1.6; white-space: pre-line;">${escapeHtml(allData.message)}</p>
    </div>

    ${
      propertyLink
        ? `<div style="text-align: center; margin-top: 28px;">
      <a href="${propertyLink}" style="display: inline-block; background: linear-gradient(135deg, #FF6625, #d3541d); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600;">View listing</a>
    </div>`
        : ""
    }

    ${
      allData.email
        ? `<p style="text-align: center; color: #6b7280; font-size: 0.85rem; margin-top: 24px;">
      Reply directly to <a href="mailto:${escapeHtml(allData.email)}" style="color: #FF6625;">${escapeHtml(allData.email)}</a> to respond.
    </p>`
        : ""
    }

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">
        ${isPropertyEnquiry ? "Sent because someone enquired about your listing on Ghorbari." : "Sent from the contact form on Ghorbari."}
      </p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};



/**
 * Notify one side of a lead conversation that the other side wrote back.
 *
 * Fired from `addReply`: the agent replying to an enquiry is the common case,
 * and a sender following up puts it back on the agent's plate. The recipient
 * (the side who did not just write) is resolved by the caller.
 */
const sendLeadReplyEmail = async (
  to,
  { senderName, propertyTitle, message, propertyUrl }
) => {
  const subject = `New reply about "${headerSafe(propertyTitle || "your enquiry", 55)}" — Ghorbari`;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: linear-gradient(135deg, #FF6625, #d3541d); padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">${escapeHtml(senderName || "Someone")} replied about ${escapeHtml(propertyTitle || "your enquiry")}</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      <p style="color:#4b5563; margin: 0 0 16px;">There is a new message in your conversation. You can reply directly from your dashboard.</p>
    </div>

    <div style="margin-top: 8px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #FF6625; border-radius: 8px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
      <p style="margin: 0; color: #111827; font-size: 1rem; line-height: 1.6; white-space: pre-line;">${escapeHtml(message)}</p>
    </div>

    ${
      propertyUrl
        ? `<div style="text-align: center; margin-top: 28px;">
      <a href="${propertyUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6625, #d3541d); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600;">View listing</a>
    </div>`
        : ""
    }

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">Sent because you are part of a conversation on Ghorbari.</p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};

/**
 * Notify an agent whether their subscription payment was approved or rejected.
 *
 * `status` is "approved" or "rejected"; the rest of the copy and the accent
 * color are derived from it.
 */
const sendSubscriptionDecisionEmail = async (to, { status, planTitle }) => {
  const isApproved = status === "approved";
  const subject = isApproved
    ? "Subscription approved — Ghorbari"
    : "Subscription rejected — Ghorbari";
  const heading = isApproved ? "Your subscription is active" : "Subscription payment rejected";
  const accent = isApproved ? "#059669" : "#DC2626";
  const body = isApproved
    ? `Your payment for the ${planTitle || "subscription"} plan has been approved. You can now enjoy all its benefits.`
    : `Your payment for the ${planTitle || "subscription"} plan could not be approved. Please contact support or try again.`;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: ${accent}; padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">${heading}</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      <p style="color:#4b5563; margin: 0; line-height: 1.6;">${escapeHtml(body)}</p>
    </div>

    ${
      planTitle
        ? `<div style="margin-top: 16px; padding: 20px; background-color: #f9fafb; border-left: 4px solid ${accent}; border-radius: 8px;">
      <p style="margin: 0; color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Plan</p>
      <p style="margin: 4px 0 0; color: #111827; font-size: 1rem; font-weight: 600;">${escapeHtml(planTitle)}</p>
    </div>`
        : ""
    }

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">Sent from the Ghorbari admin panel.</p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};

/**
 * Alert the admin when an agent purchases a subscription plan.
 *
 * Delivered to CONTACT_US_EMAIL, the same address that receives contact form
 * submissions — the operator-facing inbox.
 */
const sendNewSubscriptionPurchaseEmail = async (
  to,
  { agentName, agentEmail, planTitle, amount, type }
) => {
  const subject = `New subscription purchase${agentName ? ` by ${headerSafe(agentName, 40)}` : ""} — Ghorbari`;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: linear-gradient(135deg, #FF6625, #d3541d); padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">New subscription purchase</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      <p style="color:#4b5563; margin: 0 0 16px;">An agent has submitted a subscription payment that is waiting for review.</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${detailRow("👤", "Agent", agentName)}
        ${detailRow("📧", "Email", agentEmail)}
        ${detailRow("📋", "Plan", planTitle)}
        ${detailRow("💰", "Amount", amount ? `৳${Number(amount).toLocaleString("en-IN")}` : "")}
        ${detailRow("💳", "Method", type)}
      </table>
    </div>

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">Sent from the Ghorbari admin panel. Approve or reject this purchase from the transactions page.</p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};

/**
 * Alert the admin when an agent publishes a new property listing.
 */
const sendNewPropertyEmail = async (
  to,
  { title, district, agentName, agentEmail, propertyUrl }
) => {
  const subject = `New property listed${title ? `: ${headerSafe(title, 55)}` : ""} — Ghorbari`;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: linear-gradient(135deg, #FF6625, #d3541d); padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">A new property was listed</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        ${detailRow("🏠", "Property", title)}
        ${detailRow("📍", "District", district)}
        ${detailRow("👤", "Agent", agentName)}
        ${detailRow("📧", "Email", agentEmail)}
      </table>
    </div>

    ${
      propertyUrl
        ? `<div style="text-align: center; margin-top: 28px;">
      <a href="${propertyUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6625, #d3541d); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600;">View listing</a>
    </div>`
        : ""
    }

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">Sent from the Ghorbari admin panel.</p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};

/**
 * Alert the admin when a new user account is created.
 */
const sendNewUserRegistrationEmail = async (to, { fullName, email, role, phoneNumber }) => {
  const subject = `New user registered${fullName ? `: ${headerSafe(fullName, 55)}` : ""} — Ghorbari`;

  const html = `
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${LOGO_URL}" alt="Ghorbari" style="max-width: 140px;">
    </div>

    <div style="background: linear-gradient(135deg, #FF6625, #d3541d); padding: 20px 24px; border-radius: 12px; color: #ffffff;">
      <h2 style="font-size: 1.25rem; margin: 0; line-height: 1.5;">A new user has registered</h2>
    </div>

    <div style="padding: 24px 0 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        ${detailRow("👤", "Name", fullName)}
        ${detailRow("📧", "Email", email)}
        ${detailRow("🔑", "Role", role)}
        ${detailRow("📞", "Phone", phoneNumber)}
      </table>
    </div>

    <div style="text-align: center; padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-top: 24px;">
      <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">Sent from the Ghorbari admin panel.</p>
    </div>
  </div>
</body>`;

  await sendEmail(to, subject, html);
};

const sendSubAdminInvitationEmail = async (to, password, permissions, fullName) => {
  const subject = "You have been invited as Sub-Admin - Ghorbari";
  const permissionLabels = {
    userManagement: "User Management",
    properties: "Properties",
    subscription: "Subscription",
    payment: "Payment",
    paymentGateways: "Payment Gateways",
    transactionManagement: "Transaction Management",
  };
  const permissionList = permissions
    .map((p) => `<li style="padding:4px 0; color:#374151;">${permissionLabels[p] || p}</li>`)
    .join("");

  const html = `
  <body style="background-color: #f3f4f6; padding: 2rem; font-family: Arial, sans-serif; color: #333;">
    <div style="max-width: 32rem; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 10px 20px rgba(0,0,0,0.15); text-align: center;">
      <img src="${LOGO_URL}"
        alt="Ghorbari" style="max-width: 10rem; margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937;">Sub-Admin Invitation</h1>
      <p style="color: #4b5563; margin-bottom: 1.5rem;">
        Hello ${fullName || to}, you have been invited to manage the <strong>Ghorbari</strong> admin panel as a Sub-Admin.
      </p>
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.5rem; padding:1.25rem; text-align:left; margin-bottom:1.5rem;">
        <p style="margin:0 0 8px 0; font-weight:600; color:#1f2937;">Your Login Credentials:</p>
        <p style="margin:4px 0; color:#374151;"><strong>Email:</strong> ${to}</p>
        <p style="margin:4px 0; color:#374151;"><strong>Password:</strong> ${password}</p>
      </div>
      ${
        permissionList
          ? `<div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:0.5rem; padding:1.25rem; text-align:left; margin-bottom:1.5rem;">
        <p style="margin:0 0 8px 0; font-weight:600; color:#1f2937;">Your Access Permissions:</p>
        <ul style="margin:0; padding-left:1.25rem;">${permissionList}</ul>
      </div>`
          : ""
      }
      <p style="color:#e6441c; font-size:0.875rem;">Please change your password after your first login.</p>
    </div>
  </body>`;

  await sendEmail(to, subject, html);
};

module.exports = {
  transport,
  sendEmail,
  sendEmailInBackground,
  sendResetPasswordEmail,
  sendEmailVerification,
  sendContactsUsEmail,
  sendSubAdminInvitationEmail,
  sendLeadReplyEmail,
  sendSubscriptionDecisionEmail,
  sendNewSubscriptionPurchaseEmail,
  sendNewPropertyEmail,
  sendNewUserRegistrationEmail,
};

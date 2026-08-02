const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const subscriptionService = require("../services/subscription.service");

/**
 * Reasons a lead's details may be withheld. Sent to the client so the UI can
 * explain the specific problem and offer the right action, rather than showing
 * one generic upsell for three different situations.
 */
const LEAD_ACCESS = {
  GRANTED: "granted",
  NO_SUBSCRIPTION: "no_subscription",
  EXPIRED: "subscription_expired",
  PLAN_EXCLUDES: "plan_excludes_contacts",
};

const LEAD_ACCESS_MESSAGES = {
  [LEAD_ACCESS.NO_SUBSCRIPTION]:
    "Subscribe to see who enquired about your properties.",
  [LEAD_ACCESS.EXPIRED]:
    "Your subscription has expired. Renew to see your enquiries.",
  [LEAD_ACCESS.PLAN_EXCLUDES]:
    "Your current plan does not include contact details. Upgrade to see your enquiries.",
};

/**
 * Decide whether a user may see the full detail of their leads.
 *
 * Admins always may. For anyone else the answer depends on their subscription,
 * and the reason matters — an expired subscription needs renewing while a
 * cheaper plan needs upgrading, and the client cannot tell those apart from a
 * bare boolean.
 *
 * A missing subscription plan is treated as no access rather than an error: the
 * plan may have been deleted after the user subscribed, and that should degrade
 * to a locked list instead of failing the request.
 */
const resolveLeadAccess = async (user) => {
  if (user?.role === "admin") return LEAD_ACCESS.GRANTED;

  if (!user?.subscription?.isSubscriptionTaken) {
    return LEAD_ACCESS.NO_SUBSCRIPTION;
  }

  const expiresAt = user.subscription.subscriptionExpirationDate;
  if (!expiresAt || new Date(expiresAt) < new Date()) {
    return LEAD_ACCESS.EXPIRED;
  }

  try {
    const plan = await subscriptionService.getSubscriptionById(
      user.subscription.subscriptionId
    );
    if (!plan || plan.isViewsContact === false) {
      return LEAD_ACCESS.PLAN_EXCLUDES;
    }
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === httpStatus.NOT_FOUND) {
      return LEAD_ACCESS.PLAN_EXCLUDES;
    }
    throw error;
  }

  return LEAD_ACCESS.GRANTED;
};

/**
 * Strip identifying detail from a lead, keeping only what proves it exists.
 *
 * Redaction happens here rather than in the client because hiding these fields
 * with CSS would still ship them in the response — anyone could read the
 * sender's email out of the network tab, which defeats the point of gating them.
 *
 * What survives: the property it concerns, when it arrived, and what kind of
 * enquiry it was. That is enough for an agent to judge whether subscribing is
 * worth it, which is the only reason to show a locked lead at all.
 */
const redactLead = (lead) => {
  const plain = typeof lead?.toJSON === "function" ? lead.toJSON() : { ...lead };

  return {
    id: plain.id || plain._id,
    type: plain.type,
    intent: plain.intent,
    createdAt: plain.createdAt,
    property: plain.property
      ? {
          id: plain.property.id || plain.property._id,
          title: plain.property.title,
          slug: plain.property.slug,
          type: plain.property.type,
          catagory: plain.property.catagory,
        }
      : null,
    // Explicit rather than simply absent, so the client can render a lock state
    // deliberately instead of inferring one from missing keys.
    isLocked: true,
  };
};

module.exports = {
  LEAD_ACCESS,
  LEAD_ACCESS_MESSAGES,
  resolveLeadAccess,
  redactLead,
};

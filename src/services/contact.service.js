const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Contact, Property, User } = require("../models");
const { sendContactsUsEmail, sendLeadReplyEmail, sendEmailInBackground } = require("./email.service");
const userService = require("./user.service");
const notificationService = require("./notification.service");
const config = require("../config/config");
const logger = require("../config/logger");

const escapeRegex = require("../utils/escapeRegex");

/**
 * Attaches sender info onto each contact's `replies`, given plain contact
 * document(s) with `replies.sender` left as raw ids.
 *
 * `.populate("replies.sender", ...)` looks like the obvious way to do this,
 * but a ref populated inside an array of subdocuments crashes this schema's
 * `toJSON()` deep inside Mongoose's own clone logic ("Cannot read properties
 * of undefined (reading 'toString')") - reproduced directly against a real
 * document, unrelated to any data problem. Fetching replies unpopulated and
 * attaching sender info afterward, by hand, on the plain object sidesteps it.
 */
const attachReplySenders = async (contactDocOrArray) => {
  const list = Array.isArray(contactDocOrArray) ? contactDocOrArray : [contactDocOrArray];

  const senderIds = [
    ...new Set(list.flatMap((c) => (c.replies || []).map((r) => String(r.sender)))),
  ];

  const senders = senderIds.length
    ? await User.find({ _id: { $in: senderIds } }).select("fullName profileImage role")
    : [];
  const senderMap = new Map(
    senders.map((u) => [
      String(u._id),
      { id: u.id, fullName: u.fullName, profileImage: u.profileImage, role: u.role },
    ])
  );

  const results = list.map((c) => {
    const json = typeof c.toJSON === "function" ? c.toJSON() : c;
    json.replies = (json.replies || []).map((r) => ({
      ...r,
      sender: senderMap.get(String(r.sender)) || null,
    }));
    return json;
  });

  return Array.isArray(contactDocOrArray) ? results : results[0];
};

// Create a new contact
const createContacts = async (data) => {
  const newContact = await Contact.create(data);

  // The enquiry is already persisted, so a mail failure must not fail the
  // request. Notify in the background and let the service log any problem.
  if (data.type === "property") {
    // The property detail page shows an inquiry count that was previously only
    // ever set by the seeder, so it never moved in response to real enquiries.
    // $inc rather than save() to avoid clobbering concurrent view/favorite
    // counter updates on the same document.
    await Property.updateOne({ _id: data.property }, { $inc: { inquiries: 1 } });

    const propertyOwner = await userService.getUserById(data.propertyWoner);
    const property = await Property.findById(data.property).select("title slug");

    sendEmailInBackground(() =>
      sendContactsUsEmail({
        ...data,
        propertyOwnerEmail: propertyOwner?.email,
        propertyOwnerName: propertyOwner?.fullName,
        propertyTitle: property?.title,
        propertySlug: property?.slug,
      })
    );

    // The enquiry is already saved, so a notification failure must not fail
    // the request - it would only mean the bell icon misses this one entry.
    try {
      await notificationService.createNotification({
        userId: data.propertyWoner,
        sendBy: data.user,
        title: "New enquiry received",
        content: `Someone enquired about "${property?.title || "your property"}"`,
        type: "lead",
        priority: "medium",
      });
    } catch (err) {
      logger.error("Failed to create lead notification: %s", err.message || err);
    }
  } else {
    sendEmailInBackground(() => sendContactsUsEmail(data));
  }

  return newContact;
};

// Get a contact by ID
const getContactById = async (contactId) => {
  const contact = await Contact.findById(contactId).populate("user property propertyWoner");
  if (!contact) {
    throw new ApiError(httpStatus.NOT_FOUND, "Contact not found");
  }
  return attachReplySenders(contact);
};

// Shared by getAllcontact and getSentContacts: applies the same free-text and
// exact-match filters on top of whatever base scope (owner or sender) the
// caller already put in `query`.
const applyContactFilters = (query, filter) => {
  // Partial, case-insensitive matching for free-text fields.
  const searchableFields = ["fullName", "email", "phoneNumber", "address"];
  // Enums must match exactly. Regex-matching `type` meant a filter of "general"
  // could not be distinguished from any value containing it, and left the door
  // open to a caller passing a pattern instead of a value.
  const exactFields = ["type", "intent", "status"];

  for (const key in filter) {
    if (!filter[key]) continue;

    if (key === "search") continue;

    if (searchableFields.includes(key)) {
      query[key] = { $regex: escapeRegex(filter[key]), $options: "i" };
    } else if (exactFields.includes(key)) {
      query[key] = filter[key];
    }
  }

  // A single term that should match either the sender's name or their email.
  // Passing fullName and email separately ANDs them, so a search for a name
  // would also require that name to appear in the email address and return
  // nothing.
  if (filter.search) {
    const pattern = { $regex: escapeRegex(filter.search), $options: "i" };
    query.$or = [{ fullName: pattern }, { email: pattern }];
  }

  return query;
};

const getAllcontact = async (filter, options, user) => {
  const query = {};

  // User-level restriction
  if (user?.id) {
    query.propertyWoner = user.id;
  }

  applyContactFilters(query, filter);

  options.populate = [
    {
      path: "propertyWoner",
      select: "fullName profileImage email phoneNumber",
    },
    {
      path: "user",
      select: "fullName profileImage email phoneNumber",
    },
    {
      // "category" was a typo for the schema's misspelled "catagory", so this
      // select silently returned neither. slug is added so a lead can link
      // straight to the property.
      path: "property",
      select: "title slug catagory type images",
    },
  ];

  const contacts = await Contact.paginate(query, options);
  contacts.results = await attachReplySenders(contacts.results);
  return contacts;
};

// A plain user's own sent property enquiries — the inverse of getAllcontact,
// which scopes to the property owner. Not paywalled: the lead-access paywall
// only withholds a sender's details from the property owner, and here the
// user is reading their own message.
const getSentContacts = async (filter, options, userId) => {
  const query = { user: userId, type: "property" };

  applyContactFilters(query, filter);

  options.populate = [
    {
      path: "propertyWoner",
      select: "fullName profileImage email phoneNumber",
    },
    {
      path: "property",
      select: "title slug catagory type images price",
    },
  ];

  const contacts = await Contact.paginate(query, options);
  contacts.results = await attachReplySenders(contacts.results);
  return contacts;
};


// Update the follow-up status of a single enquiry. Only `status` is touched —
// the sender details, message and property are immutable from this flow.
const updateContactStatus = async (contactId, status) => {
  const contact = await Contact.findByIdAndUpdate(
    contactId,
    { $set: { status } },
    { new: true, runValidators: true }
  ).populate("propertyWoner").populate("property", "title slug");
  if (!contact) {
    throw new ApiError(httpStatus.NOT_FOUND, "Contact not found");
  }

  // "seen" carries no useful information for the sender - it's still not
  // actionable to them - so only a reply is worth surfacing as a notification.
  if (status === "replied" && contact.type === "property" && contact.user) {
    try {
      await notificationService.createNotification({
        userId: contact.user,
        sendBy: contact.propertyWoner?._id || contact.propertyWoner?.id,
        title: "Your enquiry was replied to",
        content: `The lister replied to your enquiry about "${contact.property?.title || "a property"}"`,
        type: "lead-reply",
        priority: "medium",
      });
    } catch (err) {
      logger.error("Failed to create reply notification: %s", err.message || err);
    }
  }

  return contact;
};

// Appends a message to the thread, from either side of the conversation:
// the property owner replying, or the original sender following up. Which
// one it is is inferred from who's calling, not passed in, so a caller can
// never claim to be the other party.
const addReply = async (contactId, senderId, message) => {
  const contact = await Contact.findById(contactId)
    .populate("user", "fullName email")
    .populate("propertyWoner", "fullName email")
    .populate("property", "title slug");

  if (!contact) {
    throw new ApiError(httpStatus.NOT_FOUND, "Contact not found");
  }

  const ownerId = String(contact.propertyWoner?._id || contact.propertyWoner?.id || "");
  const enquirerId = String(contact.user?._id || contact.user?.id || "");
  const isOwnerReplying = ownerId === String(senderId);
  const isSenderFollowingUp = enquirerId === String(senderId);

  if (!isOwnerReplying && !isSenderFollowingUp) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not part of this conversation");
  }

  contact.replies.push({ sender: senderId, message });
  // Doubles as "whose turn it is": the owner replying resolves it for the
  // sender, the sender following up puts it back on the owner's plate.
  contact.status = isOwnerReplying ? "replied" : "new";
  await contact.save();

  // The enquiry is already updated, so a notification failure must not fail
  // the request - it would only mean the bell icon misses this one entry.
  const recipientId = isOwnerReplying ? contact.user?._id : contact.propertyWoner?._id;
  const recipientEmail = isOwnerReplying ? contact.user?.email : contact.propertyWoner?.email;
  if (recipientId) {
    const propertyTitle = contact.property?.title || "a property";
    const senderName = isOwnerReplying ? contact.propertyWoner?.fullName : contact.user?.fullName;

    try {
      await notificationService.createNotification({
        userId: recipientId,
        sendBy: senderId,
        title: isOwnerReplying ? "You have a new reply" : "New follow-up message",
        content: `${senderName || "Someone"} replied about "${propertyTitle}": ${message}`,
        type: "lead-reply",
        priority: "medium",
      });
    } catch (err) {
      logger.error("Failed to create reply notification: %s", err.message || err);
    }

    // The reply is already persisted, so a mail failure must not fail the
    // request - notify in the background and let the service log any problem.
    if (recipientEmail) {
      const propertyUrl = contact.property?.slug
        ? `${config.websiteUrl}/properties/${contact.property.slug}`
        : null;
      sendEmailInBackground(() =>
        sendLeadReplyEmail(recipientEmail, {
          senderName,
          propertyTitle,
          message,
          propertyUrl,
        })
      );
    }
  }

  return attachReplySenders(contact);
};

const getLeadStats = async (user) => {
  const base = { propertyWoner: user.id, type: "property" };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [total, newToday, unread] = await Promise.all([
    Contact.countDocuments(base),
    Contact.countDocuments({ ...base, createdAt: { $gte: startOfToday } }),
    Contact.countDocuments({ ...base, status: "new" }),
  ]);

  return { total, newToday, unread };
};

module.exports = {
  createContacts,
  getContactById,
  getAllcontact,
  getSentContacts,
  updateContactStatus,
  addReply,
  getLeadStats,
};

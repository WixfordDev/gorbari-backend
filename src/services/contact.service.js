const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Contact, Property } = require("../models");
const { sendContactsUsEmail, sendEmailInBackground } = require("./email.service");
const userService = require("./user.service");

const escapeRegex = require("../utils/escapeRegex");

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
  return contact;
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
      select: "fullName profileImage email",
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
  return contacts;
};


// Update the follow-up status of a single enquiry. Only `status` is touched —
// the sender details, message and property are immutable from this flow.
const updateContactStatus = async (contactId, status) => {
  const contact = await Contact.findByIdAndUpdate(
    contactId,
    { $set: { status } },
    { new: true, runValidators: true }
  ).populate("propertyWoner");
  if (!contact) {
    throw new ApiError(httpStatus.NOT_FOUND, "Contact not found");
  }
  return contact;
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
  getLeadStats,
};

const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Contact, Property } = require("../models");
const { sendContactsUsEmail, sendEmailInBackground } = require("./email.service");
const userService = require("./user.service");

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

const getAllcontact = async (filter, options, user) => {
  const query = {};

  // User-level restriction
  if (user?.id) {
    query.propertyWoner = user.id;
  }

  const searchableFields = [
    "fullName",
    "email",
    "type",
    "phoneNumber",
    "address",
  ];

  for (const key in filter) {
    if (!filter[key]) continue;

    if (searchableFields.includes(key)) {
      query[key] = { $regex: filter[key], $options: "i" };
    } else {
      query[key] = filter[key];
    }
  }

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


module.exports = {
  createContacts,
  getContactById,
  getAllcontact,
};

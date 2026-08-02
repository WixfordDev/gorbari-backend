const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Contact } = require("../models");
const { sendContactsUsEmail, sendEmailInBackground } = require("./email.service");
const userService = require("./user.service");

// Create a new contact
const createContacts = async (data) => {
  const newContact = await Contact.create(data);

  // The enquiry is already persisted, so a mail failure must not fail the
  // request. Notify in the background and let the service log any problem.
  if (data.type === "property") {
    const propertyWoner = await userService.getUserById(data.propertyWoner);
    sendEmailInBackground(() =>
      sendContactsUsEmail({
        ...data,
        propertyOwnerEmail: propertyWoner.email,
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
      select: "fullName profileImage email",
    },
    {
      path: "property",
      select: "title category type images",
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

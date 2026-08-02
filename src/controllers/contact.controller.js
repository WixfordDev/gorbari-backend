const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { contactService } = require("../services");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const {
  LEAD_ACCESS,
  LEAD_ACCESS_MESSAGES,
  resolveLeadAccess,
  redactLead,
} = require("../utils/leadAccess");

const createContact = catchAsync(async (req, res) => {
  if (!req.body.type) {
    throw new ApiError(httpStatus.BAD_REQUEST, "type is required");
  }

  if (!req.body.fullName && req.body.firstName) {
    req.body.fullName = `${req.body.firstName} ${req.body.lastName || ""}`.trim();
  }

  if (req.user) {
    req.body.user = req.user.id;
    req.body.fullName = req.user.fullName || req.body.fullName;
    // Carried over from the account so the notification email can identify and
    // reply to the sender. Previously only the name was copied, which is why
    // those emails rendered "Email Address: undefined".
    req.body.email = req.user.email;
    req.body.phoneNumber = req.body.phoneNumber || req.user.phoneNumber;
  }

  const contact = await contactService.createContacts(req.body);
  res.status(httpStatus.CREATED).json(
    response({
      message: "Your message has been sent successfully",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: {},
    })
  );
});

const getContact = catchAsync(async (req, res) => {
  const contact = await contactService.getContactById(req.params.contactId);
  if (!contact) {
    return res.status(httpStatus.NOT_FOUND).json(
      response({
        message: "Contact not found",
        status: "NOT_FOUND",
        statusCode: httpStatus.NOT_FOUND,
      })
    );
  }

  // This route is open to agents as well as admins, so without an ownership
  // check any agent could read any other agent's leads by guessing an id.
  const isOwner = String(contact.propertyWoner?.id || contact.propertyWoner) === String(req.user.id);
  if (req.user.role !== "admin" && !isOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, "This enquiry is not yours");
  }

  // Redacting the list but not the single-lead route would leave the paywall
  // trivially bypassable: fetch the ids from the locked list, then request each
  // one individually for the full sender details.
  const access = await resolveLeadAccess(req.user);
  const isLocked = access !== LEAD_ACCESS.GRANTED;

  res.status(httpStatus.OK).json(
    response({
      message: "Contact retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: isLocked
        ? { ...redactLead(contact), leadAccess: access, lockReason: LEAD_ACCESS_MESSAGES[access] }
        : contact,
    })
  );
});

const getContacts = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    "fullName",
    "email",
    "phoneNumber",
    "address",
    "type",
    // Lets the admin lead list separate purchase requests from general
    // questions, and a single term search across name and email.
    "intent",
    "search",
  ]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  // Newest first: a lead list is only useful if the most recent enquiry is at
  // the top, and paginate defaults to insertion order without this.
  options.sortBy = options.sortBy || "createdAt:desc";
  const contacts = await contactService.getAllcontact(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "Contacts retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: contacts,
    })
  );
});

const getSelfContacts = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    "fullName",
    "email",
    "phoneNumber",
    "address",
    "type",
    "intent",
    "search",
  ]);

  const options = pick(req.query, ["sortBy", "limit", "page"]);
  options.sortBy = options.sortBy || "createdAt:desc";
  const user = req.user;

  const access = await resolveLeadAccess(user);
  const isLocked = access !== LEAD_ACCESS.GRANTED;

  // Previously this threw 403 when the subscription check failed, so an agent
  // without a plan could not tell whether they had any enquiries at all — the
  // page was simply an error. The request now succeeds and the leads come back
  // redacted, which lets the agent see that interest exists while keeping the
  // details behind the paywall.
  if (isLocked) {
    // A locked agent cannot search or filter on fields they are not allowed to
    // read; honouring those filters would leak the same information one query at
    // a time (searching an email and counting results reveals the email).
    ["fullName", "email", "phoneNumber", "address", "search"].forEach(
      (key) => delete filter[key]
    );
  }

  const contacts = await contactService.getAllcontact(filter, options, user);

  const payload = isLocked
    ? { ...contacts, results: contacts.results.map(redactLead) }
    : contacts;

  res.status(httpStatus.OK).json(
    response({
      message: "Contacts retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        ...payload,
        // The client needs to know why detail is missing so it can offer the
        // right remedy: subscribe, renew, or upgrade.
        leadAccess: access,
        isLocked,
        lockReason: isLocked ? LEAD_ACCESS_MESSAGES[access] : null,
      },
    })
  );
});

module.exports = {
  createContact,
  getContact,
  getContacts,
  getSelfContacts,
};

const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { contactService, subscriptionService } = require("../services");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");

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
  res.status(httpStatus.OK).json(
    response({
      message: "Contact retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: contact,
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

  if (user.role !== "admin") {
    if (!user.subscription || !user.subscription.isSubscriptionTaken) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You don't have an active subscription. Please upgrade your plan."
      );
    }

    if (new Date(user.subscription.subscriptionExpirationDate) < new Date()) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Your subscription has expired. Please renew your plan."
      );
    }

    const subscription = await subscriptionService.getSubscriptionById(
      user.subscription.subscriptionId
    );

    if (!subscription || subscription.isViewsContact === false) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Your current subscription does not allow viewing contacts."
      );
    }
  }

  const contacts = await contactService.getAllcontact(filter, options, user);

  res.status(httpStatus.OK).json(
    response({
      message: "Contacts retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: contacts,
    })
  );
});

module.exports = {
  createContact,
  getContact,
  getContacts,
  getSelfContacts,
};

// An application depends on what roles it will have.

const allRoles = {
  user: ["common", "user"],
  agent: ["common", "adminAndAgent", "agent"],
  admin: ["common", "adminAndAgent", "admin"],
  subAdmin: ["common", "subAdmin"],
};

const SUB_ADMIN_PERMISSIONS = [
  "userManagement",
  "properties",
  "subscription",
  "payment",
  "paymentGateways",
  "transactionManagement",
];

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
  SUB_ADMIN_PERMISSIONS,
};

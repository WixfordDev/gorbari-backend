const express = require("express");
const config = require("../../config/config");
const authRoute = require("./auth.routes");
const userRoute = require("./user.routes");
const docsRoute = require("./docs.routes");
const propertyRoute = require("./property.routes");
const infoRoute = require("./info.routes");
const contactRoute = require("./contact.routes");
const subscriptionRoute = require("./subscription.route");
const paymentGatewayRoute = require("./paymentGateway.routes");
const subAdminRoute = require("./subAdmin.routes");

const router = express.Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  {
    path: "/users",
    route: userRoute,
  },
  {
    path: "/property",
    route: propertyRoute,
  },
  {
    path: "/subscriptions",
    route: subscriptionRoute,
  },
  {
    path: "/gateways",
    route: paymentGatewayRoute,
  },

  {
    path: "/sub-admins",
    route: subAdminRoute,
  },
  {
    path: "/contact",
    route: contactRoute,
  },
  {
    path: "/info",
    route: infoRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: "/docs",
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === "development") {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;

const { PaymentGateway } = require("../../models");
const { upsertByUnique } = require("./helpers");
const { IDS } = require("./users");

const paymentGatewaysData = [
  {
    createdBy: IDS.admin,
    name: "bKash",
    logo: "https://res.cloudinary.com/demo/image/upload/v1/logo-bkash.png",
    status: "active",
    address: "Bikram Tower, Level 13, 3/A Bir Uttam, Dhaka 1212",
  },
  {
    createdBy: IDS.admin,
    name: "Nagad",
    logo: "https://res.cloudinary.com/demo/image/upload/v1/logo-nagad.png",
    status: "active",
    address: "NBL Bhaban (Level 12), 40 Kawran Bazar, Dhaka 1215",
  },
  {
    createdBy: IDS.admin,
    name: "Rocket",
    logo: "https://res.cloudinary.com/demo/image/upload/v1/logo-rocket.png",
    status: "inactive",
    address: "Dutch-Bangla Bank Limited, Head Office, Dhaka 1000",
  },
];

const seedPaymentGateways = async () => {
  const result = await upsertByUnique(PaymentGateway, "name", paymentGatewaysData);
  console.log(`Payment gateways seeded (${result.created} created, ${result.updated} updated)`);
};

module.exports = { seedPaymentGateways };

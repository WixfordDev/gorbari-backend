const { PaymentGateway } = require("../../models");
const { upsertByUnique } = require("./helpers");
const { IDS } = require("./users");

const paymentGatewaysData = [
  {
    createdBy: IDS.admin,
    name: "bKash",
    logo: "/uploads/other/bkash.png",
    status: "active",
    address: "123 456 789",
  },
  {
    createdBy: IDS.admin,
    name: "Nagad",
    logo: "/uploads/other/nagad.png",
    status: "active",
    address: "123 456 789",
  },
  {
    createdBy: IDS.admin,
    name: "Rocket",
    logo: "/uploads/other/rocket.png",
    status: "inactive",
    address: "123 456 789",
  },
];

const seedPaymentGateways = async () => {
  const result = await upsertByUnique(PaymentGateway, "name", paymentGatewaysData);
  console.log(`Payment gateways seeded (${result.created} created, ${result.updated} updated)`);
};

module.exports = { seedPaymentGateways };

/**
 * The administrative geography of Bangladesh: eight divisions and the 64
 * districts beneath them.
 *
 * Held as a static constant rather than a database collection because it is
 * reference data that changes on the order of decades — the last change was
 * Mymensingh splitting from Dhaka in 2015. A collection would need seeding,
 * migrations and a query on every form load to serve values that ship with the
 * code for free, and would let an environment drift into having a different
 * idea of what a district is.
 *
 * Districts are the authoritative direction of the relationship: a district
 * belongs to exactly one division, so the division can always be derived from
 * the district but not the reverse. `findDivisionByDistrict` relies on that,
 * which is what lets the form fill the division in once a district is picked.
 */
const DIVISIONS = [
  {
    name: "Dhaka",
    districts: [
      "Dhaka",
      "Faridpur",
      "Gazipur",
      "Gopalganj",
      "Kishoreganj",
      "Madaripur",
      "Manikganj",
      "Munshiganj",
      "Narayanganj",
      "Narsingdi",
      "Rajbari",
      "Shariatpur",
      "Tangail",
    ],
  },
  {
    name: "Chittagong",
    districts: [
      "Bandarban",
      "Brahmanbaria",
      "Chandpur",
      "Chittagong",
      "Comilla",
      "Cox's Bazar",
      "Feni",
      "Khagrachhari",
      "Lakshmipur",
      "Noakhali",
      "Rangamati",
    ],
  },
  {
    name: "Rajshahi",
    districts: [
      "Bogura",
      "Chapai Nawabganj",
      "Joypurhat",
      "Naogaon",
      "Natore",
      "Pabna",
      "Rajshahi",
      "Sirajganj",
    ],
  },
  {
    name: "Khulna",
    districts: [
      "Bagerhat",
      "Chuadanga",
      "Jashore",
      "Jhenaidah",
      "Khulna",
      "Kushtia",
      "Magura",
      "Meherpur",
      "Narail",
      "Satkhira",
    ],
  },
  {
    name: "Barishal",
    districts: [
      "Barguna",
      "Barishal",
      "Bhola",
      "Jhalokati",
      "Patuakhali",
      "Pirojpur",
    ],
  },
  {
    name: "Sylhet",
    districts: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  },
  {
    name: "Rangpur",
    districts: [
      "Dinajpur",
      "Gaibandha",
      "Kurigram",
      "Lalmonirhat",
      "Nilphamari",
      "Panchagarh",
      "Rangpur",
      "Thakurgaon",
    ],
  },
  {
    name: "Mymensingh",
    districts: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  },
];

const DIVISION_NAMES = DIVISIONS.map((division) => division.name);

// Built once at require time: the lookup runs on every property write, and
// rebuilding it per call would mean rescanning all 64 districts each time.
const DISTRICT_TO_DIVISION = DIVISIONS.reduce((acc, division) => {
  division.districts.forEach((district) => {
    acc[district.toLowerCase()] = division.name;
  });
  return acc;
}, {});

const getDistrictsByDivision = (divisionName) => {
  if (!divisionName) return [];
  const division = DIVISIONS.find(
    (item) => item.name.toLowerCase() === String(divisionName).toLowerCase()
  );
  return division ? division.districts : [];
};

/**
 * Case-insensitive so a value arriving from Google Places ("dhaka") resolves
 * the same as one picked from our own dropdown ("Dhaka").
 */
const findDivisionByDistrict = (districtName) => {
  if (!districtName) return null;
  return DISTRICT_TO_DIVISION[String(districtName).trim().toLowerCase()] || null;
};

const isValidDivision = (divisionName) =>
  Boolean(divisionName) &&
  DIVISION_NAMES.some(
    (name) => name.toLowerCase() === String(divisionName).toLowerCase()
  );

/**
 * A district is only valid *within* its division, so this checks the pairing
 * rather than mere existence. Validating them independently would accept
 * "Sylhet district in Khulna division".
 */
const isValidDistrictForDivision = (districtName, divisionName) => {
  if (!districtName) return false;
  const districts = getDistrictsByDivision(divisionName);
  return districts.some(
    (name) => name.toLowerCase() === String(districtName).toLowerCase()
  );
};

const ALL_DISTRICTS = Object.keys(DISTRICT_TO_DIVISION).map((key) => key);

module.exports = {
  DIVISIONS,
  DIVISION_NAMES,
  ALL_DISTRICTS,
  getDistrictsByDivision,
  findDivisionByDistrict,
  isValidDivision,
  isValidDistrictForDivision,
};
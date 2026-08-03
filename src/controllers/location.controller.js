const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const ApiError = require("../utils/ApiError");
const {
  DIVISIONS,
  DIVISION_NAMES,
  getDistrictsByDivision,
  findDivisionByDistrict,
  isValidDivision,
} = require("../config/bangladeshGeo");

/**
 * Reference data for the address fields on the property form.
 *
 * Public and unauthenticated: the administrative geography of Bangladesh is not
 * privileged information, and the property form needs it before a visitor has
 * necessarily signed in.
 */
const getDivisions = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).json(
    response({
      message: "Divisions retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        results: DIVISIONS.map(({ name, districts }) => ({
          name,
          districtCount: districts.length,
        })),
        totalResults: DIVISION_NAMES.length,
      },
    })
  );
});

/**
 * Districts, optionally narrowed to one division.
 *
 * Each district carries its division even when the list is already filtered, so
 * the client can resolve a division from a district without a second request —
 * that is what lets picking a district first fill the division in.
 */
const getDistricts = catchAsync(async (req, res) => {
  const { division } = req.query;

  if (division && !isValidDivision(division)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unknown division "${division}". Expected one of: ${DIVISION_NAMES.join(", ")}`
    );
  }

  const names = division
    ? getDistrictsByDivision(division)
    : DIVISIONS.flatMap((item) => item.districts);

  const results = names.map((name) => ({
    name,
    division: findDivisionByDistrict(name),
  }));

  res.status(httpStatus.OK).json(
    response({
      message: "Districts retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { results, totalResults: results.length },
    })
  );
});

module.exports = {
  getDivisions,
  getDistricts,
};
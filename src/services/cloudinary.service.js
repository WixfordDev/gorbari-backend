const cloudinary = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const uploadBuffer = (buffer, { folder, format, resourceType = "image", publicId } = {}) => {
  return new Promise((resolve, reject) => {
    const options = { folder, resource_type: resourceType };
    if (format) options.format = format;
    if (publicId) options.public_id = publicId;

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        return reject(
          new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            `Cloudinary upload failed: ${error.message}`
          )
        );
      }
      resolve(result);
    });

    stream.end(buffer);
  });
};

// Upload a single file (req.file). Returns { url, publicId }.
const uploadFile = async (file, folder) => {
  if (!file || !file.buffer) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No file uploaded");
  }

  const isHeic = file.mimetype === "image/heic" || file.mimetype === "image/heif";

  const result = await uploadBuffer(file.buffer, {
    folder,
    format: isHeic ? "png" : undefined,
  });

  return { url: result.secure_url, publicId: result.public_id };
};

// Upload multiple files under the same field (req.files[field]).
const uploadFiles = async (files, folder) => {
  const uploaded = [];
  for (const file of files) {
    uploaded.push(await uploadFile(file, folder));
  }
  return uploaded;
};

const destroyByUrl = async (url) => {
  if (!url || typeof url !== "string") return;

  const publicId = extractPublicId(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // Deleting a missing asset should not fail the request.
    console.error(`Cloudinary destroy failed for ${publicId}:`, error.message);
  }
};

const extractPublicId = (url) => {
  // secure_url looks like:
  //   https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<id>.<ext>
  // public_id is everything after the last "upload/" segment, without the extension.
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return match ? match[1] : null;
};

module.exports = {
  uploadBuffer,
  uploadFile,
  uploadFiles,
  destroyByUrl,
  extractPublicId,
};

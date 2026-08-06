const { cloudinaryService } = require("../services");

// Uploads req.file (single) or req.files[field] (array) to Cloudinary.
// Attaches `file.url` (secure URL) and `file.publicId` to each file object
// so downstream controllers can store them.
const cloudinaryUpload = (folder) => {
  return async (req, res, next) => {
    try {
      const files = [];
      if (req.file) {
        files.push(req.file);
      }
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          files.push(...req.files[key]);
        });
      }

      if (files.length === 0) {
        return next();
      }

      for (const file of files) {
        const { url, publicId } = await cloudinaryService.uploadFile(file, folder);
        file.url = url;
        file.publicId = publicId;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = cloudinaryUpload;

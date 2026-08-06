const multer = require("multer");

// Files are kept in memory (buffers) and uploaded to Cloudinary afterward.
module.exports = function () {
  const storage = multer.memoryStorage();

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype == "image/jpg" ||
        file.mimetype == "image/png" ||
        file.mimetype == "image/jpeg" ||
        file.mimetype == "image/heic" ||
        file.mimetype == "image/heif"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only jpg, png, jpeg format allowed!"));
      }
    },
  });

  return upload;
};

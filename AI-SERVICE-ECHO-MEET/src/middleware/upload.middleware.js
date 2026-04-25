import multer from "multer";

/**
 * Multer configured for in-memory buffer handling.
 * Audio chunks are kept in memory (not written to disk) for processing.
 * Max file size: 10 MB per chunk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/wav",
      "audio/mp4",
      "audio/mpeg",
      "audio/x-wav",
      "application/octet-stream",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`), false);
    }
  },
});

export { upload };

import path from "node:path";
import multer from "multer";

const uploadsDir = path.join(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});

const upload = multer({ storage });

export const uploadImageMiddleware = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
]) as any;

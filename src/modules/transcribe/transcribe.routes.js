import { Router } from "express";
import multer from "multer";
import { transcribeAudio } from "./transcribe.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";

const router = Router();

// file hanya di memory, tidak disimpan ke disk
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  authenticateToken,             // cek JWT
  authorizeRoles("perawat"), // misalnya hanya role tertentu
  upload.single("file"),          // handle audio upload
  transcribeAudio                 // controller
);

export default router;
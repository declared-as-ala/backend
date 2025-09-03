import express from "express";
import {
  login,
  refreshToken,
  logout,
  me,
  updateProfile, // <-- import the new controller
} from "../../controllers/admin/authController.js";
import { requireAdmin } from "../../middleware/authAdmin.js";

const router = express.Router();

// POST /api/admin/auth/login
router.post("/login", login);

// POST /api/admin/auth/refresh
router.post("/refresh", refreshToken);

// POST /api/admin/auth/logout
router.post("/logout", logout);

// GET /api/admin/auth/me
router.get("/me", requireAdmin, me);

// PUT /api/admin/auth/update-profile
router.put("/update-profile", requireAdmin, updateProfile);

export default router;

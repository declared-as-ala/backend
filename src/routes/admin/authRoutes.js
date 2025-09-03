import express from "express";
import {
  login,
  refreshToken,
  logout,
  me,
  updateProfile,
} from "../../controllers/admin/authController.js";
import { requireAdmin } from "../../middleware/authAdmin.js";

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/me", requireAdmin, me);
router.put("/update-profile", requireAdmin, updateProfile);

export default router;

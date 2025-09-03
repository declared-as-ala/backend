import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import AdminUser from "../../models/AdminUser.js";

// Generate access token (short-lived)
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "15m",
  });

// Generate refresh token (long-lived)
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || "30d",
  });

// Helper: pick public admin data
const pickAdminPublic = (a) => ({
  id: a._id,
  email: a.email,
  name: a.name,
  role: a.role,
  active: a.active,
  createdAt: a.createdAt,
});

/**
 * @desc Login Admin
 * @route POST /api/admin/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const admin = await AdminUser.findOne({
      email: email.toLowerCase().trim(),
      active: true,
    });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({ id: admin._id, role: admin.role });
    const refreshToken = signRefreshToken({ id: admin._id });

    // Save refresh token in DB
    admin.refreshToken = refreshToken;
    await admin.save();

    res.json({
      success: true,
      accessToken,
      refreshToken,
      admin: pickAdminPublic(admin),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * @desc Refresh Access Token
 * @route POST /api/admin/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken)
      return res.status(401).json({ message: "Missing refresh token" });

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const admin = await AdminUser.findById(decoded.id);
    if (!admin || admin.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new access token
    const newAccessToken = signAccessToken({ id: admin._id, role: admin.role });
    res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

/**
 * @desc Logout Admin
 * @route POST /api/admin/auth/logout
 */
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken)
      return res.status(400).json({ message: "Refresh token required" });

    const admin = await AdminUser.findOne({ refreshToken });
    if (!admin) {
      return res.status(200).json({ success: true, message: "Logged out" });
    }

    // Invalidate refresh token
    admin.refreshToken = null;
    await admin.save();

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * @desc Get Current Admin Profile
 * @route GET /api/admin/auth/me
 */
export const me = async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json({ success: true, data: pickAdminPublic(admin) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Change Own Password
 * @route PUT /api/admin/auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "currentPassword & newPassword required",
      });
    }
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok)
      return res.status(401).json({ message: "Current password incorrect" });

    admin.password = newPassword; // hashed by pre('save')
    await admin.save();
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Create a New Admin (Admins Only)
 * @route POST /api/admin/auth/create
 */
export const createAdmin = async (req, res) => {
  try {
    if (!["admin"].includes(req.admin.role))
      return res.status(403).json({ message: "Forbidden" });

    const {
      email,
      password,
      name,
      role = "manager",
      active = true,
    } = req.body || {};

    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const exists = await AdminUser.findOne({
      email: email.toLowerCase().trim(),
    });
    if (exists)
      return res.status(409).json({ message: "Email already in use" });

    const created = await AdminUser.create({
      email,
      password,
      name,
      role,
      active,
    });
    res.status(201).json({ success: true, data: pickAdminPublic(created) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc List Admins (Admins Only)
 * @route GET /api/admin/auth/list
 */
export const listAdmins = async (req, res) => {
  try {
    if (!["admin"].includes(req.admin.role))
      return res.status(403).json({ message: "Forbidden" });

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q?.trim();
    const active = req.query.active;

    const filter = {};
    if (q)
      filter.$or = [
        { email: new RegExp(q, "i") },
        { name: new RegExp(q, "i") },
      ];
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const [items, total] = await Promise.all([
      AdminUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AdminUser.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items.map(pickAdminPublic),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Update Admin (Admins Only)
 * @route PUT /api/admin/auth/:id
 */
export const updateAdmin = async (req, res) => {
  try {
    if (!["admin"].includes(req.admin.role))
      return res.status(403).json({ message: "Forbidden" });

    const { name, role, active } = req.body || {};
    const admin = await AdminUser.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (typeof name === "string") admin.name = name;
    if (role) admin.role = role;
    if (typeof active === "boolean") admin.active = active;

    await admin.save();
    res.json({ success: true, data: pickAdminPublic(admin) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
/**
 * @desc Update Own Profile
 * @route PUT /api/admin/auth/update-profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Update name if provided
    if (typeof name === "string" && name.trim()) admin.name = name.trim();

    // Update email if provided and unique
    if (typeof email === "string" && email.trim()) {
      const exists = await AdminUser.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: admin._id }, // exclude self
      });
      if (exists)
        return res.status(409).json({ message: "Email already in use" });
      admin.email = email.toLowerCase().trim();
    }

    // Update password if provided (pre-save hook will hash it)
    if (typeof password === "string" && password.trim()) {
      admin.password = password.trim();
    }

    await admin.save();
    res.json({
      success: true,
      message: "Profile updated",
      admin: pickAdminPublic(admin),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

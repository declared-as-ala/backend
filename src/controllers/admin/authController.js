import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import AdminUser from "../../models/AdminUser.js";

// Constants for better maintainability
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES || "30d";
const SALT_ROUNDS = 12;

// Input validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 6 characters for basic security
  return password && password.length >= 6;
};

// Generate access token (short-lived)
const signAccessToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "admin-api",
    audience: "admin-dashboard",
  });
};

// Generate refresh token (long-lived)
const signRefreshToken = (payload) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: "admin-api",
    audience: "admin-dashboard",
  });
};

// Helper: pick public admin data
const pickAdminPublic = (admin) => ({
  id: admin._id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  active: admin.active,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
});

// Error response helper
const sendErrorResponse = (res, status, message, details = null) => {
  const response = {
    success: false,
    message,
    ...(details && { details }),
  };

  return res.status(status).json(response);
};

// Success response helper
const sendSuccessResponse = (res, data, message = null, status = 200) => {
  const response = {
    success: true,
    ...(message && { message }),
    ...data,
  };

  return res.status(status).json(response);
};

/**
 * @desc Login Admin
 * @route POST /api/admin/auth/login
 * @access Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Input validation
    if (!email || !password) {
      return sendErrorResponse(res, 400, "Email and password are required");
    }

    if (!validateEmail(email)) {
      return sendErrorResponse(
        res,
        400,
        "Please provide a valid email address"
      );
    }

    if (!validatePassword(password)) {
      return sendErrorResponse(
        res,
        400,
        "Password must be at least 6 characters long"
      );
    }

    // Find admin user
    const normalizedEmail = email.toLowerCase().trim();
    const admin = await AdminUser.findOne({
      email: normalizedEmail,
      active: true,
    }).select("+password"); // Explicitly select password field if it's set to false in schema

    if (!admin) {
      return sendErrorResponse(res, 401, "Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return sendErrorResponse(res, 401, "Invalid email or password");
    }

    // Generate tokens
    const tokenPayload = { id: admin._id, role: admin.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: admin._id });

    // Save refresh token in DB (hash it for security)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    admin.refreshToken = hashedRefreshToken;
    admin.lastLogin = new Date();
    await admin.save();

    // Remove password from response
    const adminData = pickAdminPublic(admin);

    return sendSuccessResponse(
      res,
      {
        accessToken,
        refreshToken,
        admin: adminData,
      },
      "Login successful"
    );
  } catch (error) {
    console.error("Login error:", error);
    return sendErrorResponse(
      res,
      500,
      "An error occurred during login. Please try again."
    );
  }
};

/**
 * @desc Refresh Access Token
 * @route POST /api/admin/auth/refresh
 * @access Public
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return sendErrorResponse(res, 400, "Refresh token is required");
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return sendErrorResponse(
          res,
          401,
          "Refresh token has expired. Please login again."
        );
      } else if (jwtError.name === "JsonWebTokenError") {
        return sendErrorResponse(res, 401, "Invalid refresh token format");
      } else {
        return sendErrorResponse(res, 401, "Invalid refresh token");
      }
    }

    // Find admin and validate refresh token
    const admin = await AdminUser.findById(decoded.id);
    if (!admin || !admin.active) {
      return sendErrorResponse(res, 401, "Admin account not found or inactive");
    }

    if (!admin.refreshToken) {
      return sendErrorResponse(
        res,
        401,
        "Refresh token not found. Please login again."
      );
    }

    // Compare refresh token (it's hashed in DB)
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      admin.refreshToken
    );
    if (!isRefreshTokenValid) {
      return sendErrorResponse(res, 401, "Invalid refresh token");
    }

    // Generate new access token
    const newAccessToken = signAccessToken({ id: admin._id, role: admin.role });

    return sendSuccessResponse(
      res,
      {
        accessToken: newAccessToken,
      },
      "Token refreshed successfully"
    );
  } catch (error) {
    console.error("Token refresh error:", error);
    return sendErrorResponse(
      res,
      500,
      "An error occurred during token refresh"
    );
  }
};

/**
 * @desc Logout Admin
 * @route POST /api/admin/auth/logout
 * @access Private
 */
export const logout = async (req, res) => {
  try {
    // Get refresh token from request body or from authenticated user's stored token
    const { refreshToken } = req.body || {};

    // If no refresh token provided, still allow logout (clear server-side session)
    if (!refreshToken) {
      // If we have authenticated user from middleware, clear their refresh token
      if (req.admin && req.admin.id) {
        try {
          await AdminUser.findByIdAndUpdate(req.admin.id, {
            $unset: { refreshToken: 1 },
            lastLogout: new Date(),
          });
        } catch (updateError) {
          console.warn(
            "Failed to clear refresh token for user:",
            req.admin.id,
            updateError
          );
        }
      }

      return sendSuccessResponse(res, {}, "Logged out successfully");
    }

    // Find admin with matching refresh token and clear it
    const admin = await AdminUser.findOne({ refreshToken: { $exists: true } });

    if (admin && admin.refreshToken) {
      // Check if the provided refresh token matches the stored one
      const isValidToken = await bcrypt.compare(
        refreshToken,
        admin.refreshToken
      );

      if (isValidToken) {
        // Clear refresh token and update logout time
        admin.refreshToken = undefined;
        admin.lastLogout = new Date();
        await admin.save();
      }
    }

    return sendSuccessResponse(res, {}, "Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, we should still indicate successful logout
    // to prevent the client from being stuck in an authenticated state
    return sendSuccessResponse(res, {}, "Logged out successfully");
  }
};

/**
 * @desc Get Current Admin Profile
 * @route GET /api/admin/auth/me
 * @access Private
 */
export const me = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return sendErrorResponse(res, 401, "Authentication required");
    }

    const admin = await AdminUser.findById(req.admin.id);

    if (!admin) {
      return sendErrorResponse(res, 404, "Admin profile not found");
    }

    if (!admin.active) {
      return sendErrorResponse(res, 403, "Admin account is deactivated");
    }

    return sendSuccessResponse(res, {
      admin: pickAdminPublic(admin),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return sendErrorResponse(
      res,
      500,
      "An error occurred while fetching profile"
    );
  }
};

/**
 * @desc Update Own Profile
 * @route PUT /api/admin/auth/update-profile
 * @access Private
 */
export const updateProfile = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return sendErrorResponse(res, 401, "Authentication required");
    }

    const { name, email, password, currentPassword } = req.body || {};

    // Find current admin
    const admin = await AdminUser.findById(req.admin.id).select("+password");
    if (!admin) {
      return sendErrorResponse(res, 404, "Admin profile not found");
    }

    const updates = {};
    const validationErrors = [];

    // Validate and prepare name update
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        validationErrors.push("Name must be a non-empty string");
      } else if (name.trim().length > 100) {
        validationErrors.push("Name must be less than 100 characters");
      } else {
        updates.name = name.trim();
      }
    }

    // Validate and prepare email update
    if (email !== undefined) {
      if (!validateEmail(email)) {
        validationErrors.push("Please provide a valid email address");
      } else {
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email is already in use by another admin
        if (normalizedEmail !== admin.email) {
          const existingAdmin = await AdminUser.findOne({
            email: normalizedEmail,
            _id: { $ne: admin._id },
          });

          if (existingAdmin) {
            validationErrors.push("Email is already in use by another admin");
          } else {
            updates.email = normalizedEmail;
          }
        }
      }
    }

    // Validate and prepare password update
    if (password !== undefined) {
      if (!validatePassword(password)) {
        validationErrors.push("Password must be at least 6 characters long");
      } else {
        // Require current password for security
        if (!currentPassword) {
          validationErrors.push(
            "Current password is required to change password"
          );
        } else {
          const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            admin.password
          );
          if (!isCurrentPasswordValid) {
            validationErrors.push("Current password is incorrect");
          } else {
            // Hash new password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            updates.password = hashedPassword;
          }
        }
      }
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return sendErrorResponse(res, 422, "Validation failed", validationErrors);
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return sendErrorResponse(res, 400, "No valid updates provided");
    }

    // Apply updates
    Object.assign(admin, updates);
    admin.updatedAt = new Date();

    // Save changes
    await admin.save();

    // If password was updated, invalidate all existing refresh tokens for security
    if (updates.password) {
      admin.refreshToken = undefined;
      await admin.save();
    }

    return sendSuccessResponse(
      res,
      {
        admin: pickAdminPublic(admin),
      },
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return sendErrorResponse(res, 409, "Email is already in use");
    }

    return sendErrorResponse(
      res,
      500,
      "An error occurred while updating profile"
    );
  }
};

/**
 * @desc Change Password (Alternative endpoint with better security)
 * @route PUT /api/admin/auth/change-password
 * @access Private
 */
export const changePassword = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return sendErrorResponse(res, 401, "Authentication required");
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendErrorResponse(
        res,
        400,
        "Current password, new password, and confirmation are required"
      );
    }

    if (newPassword !== confirmPassword) {
      return sendErrorResponse(
        res,
        400,
        "New password and confirmation do not match"
      );
    }

    if (!validatePassword(newPassword)) {
      return sendErrorResponse(
        res,
        400,
        "New password must be at least 6 characters long"
      );
    }

    if (currentPassword === newPassword) {
      return sendErrorResponse(
        res,
        400,
        "New password must be different from current password"
      );
    }

    // Find admin and verify current password
    const admin = await AdminUser.findById(req.admin.id).select("+password");
    if (!admin) {
      return sendErrorResponse(res, 404, "Admin profile not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password
    );
    if (!isCurrentPasswordValid) {
      return sendErrorResponse(res, 401, "Current password is incorrect");
    }

    // Hash and save new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    admin.password = hashedNewPassword;
    admin.updatedAt = new Date();

    // Invalidate all refresh tokens for security
    admin.refreshToken = undefined;

    await admin.save();

    return sendSuccessResponse(
      res,
      {},
      "Password changed successfully. Please login again with your new password."
    );
  } catch (error) {
    console.error("Change password error:", error);
    return sendErrorResponse(
      res,
      500,
      "An error occurred while changing password"
    );
  }
};

/**
 * @desc Invalidate all sessions (logout from all devices)
 * @route POST /api/admin/auth/logout-all
 * @access Private
 */
export const logoutAll = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return sendErrorResponse(res, 401, "Authentication required");
    }

    // Clear refresh token to invalidate all sessions
    await AdminUser.findByIdAndUpdate(req.admin.id, {
      $unset: { refreshToken: 1 },
      lastLogout: new Date(),
    });

    return sendSuccessResponse(
      res,
      {},
      "Logged out from all devices successfully"
    );
  } catch (error) {
    console.error("Logout all error:", error);
    return sendErrorResponse(res, 500, "An error occurred while logging out");
  }
};

/**
 * @desc Verify token (for middleware or client-side checks)
 * @route GET /api/admin/auth/verify
 * @access Private
 */
export const verifyToken = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return sendErrorResponse(res, 401, "Invalid or expired token");
    }

    // Optionally fetch fresh admin data
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin || !admin.active) {
      return sendErrorResponse(res, 401, "Admin account not found or inactive");
    }

    return sendSuccessResponse(
      res,
      {
        valid: true,
        admin: pickAdminPublic(admin),
      },
      "Token is valid"
    );
  } catch (error) {
    console.error("Verify token error:", error);
    return sendErrorResponse(
      res,
      500,
      "An error occurred while verifying token"
    );
  }
};

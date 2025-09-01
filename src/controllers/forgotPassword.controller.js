// controllers/authController.ts
import Customer from '../models/Customer.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

/**
 * Step 1: Send reset code to email
 */
export const sendResetCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res
        .status(404)
        .json({ message: 'No account found with this email' });
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 min expiry

    customer.resetCode = resetCode;
    customer.resetCodeExpiry = resetCodeExpiry;
    await customer.save();

    // Setup Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER, // must match .env
        pass: process.env.SMTP_PASS, // Gmail App Password if 2FA enabled
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"Les Délices" <${process.env.SMTP_USER}>`,
      to: customer.email,
      subject: 'Password Reset Code',
      text: `Hello ${
        customer.fullName || ''
      },\n\nYour password reset code is: ${resetCode}. It will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nRegards,\nLes Délices Team`,
    });

    return res.status(200).json({ message: 'Reset code sent successfully' });
  } catch (error) {
    console.error('sendResetCode Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Step 2: Verify code & reset password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res
        .status(404)
        .json({ message: 'No account found with this email' });
    }

    // Check code and expiry
    if (
      customer.resetCode !== resetCode ||
      !customer.resetCodeExpiry ||
      customer.resetCodeExpiry < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    customer.password = await bcrypt.hash(newPassword, salt);

    // Clear reset code
    customer.resetCode = undefined;
    customer.resetCodeExpiry = undefined;

    await customer.save();

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('resetPassword Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

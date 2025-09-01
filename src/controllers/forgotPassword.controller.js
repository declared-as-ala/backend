import Customer from '../models/Customer.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

/**
 * Step 1: Send reset code to email
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const customer = await Customer.findOne({ email });
    if (!customer)
      return res.status(404).json({ message: 'Compte introuvable' });

    // Generate 6-digit OTP
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    customer.resetCode = resetCode;
    customer.resetCodeExpiry = resetCodeExpiry;
    await customer.save();

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: customer.email,
      subject: 'Réinitialisation de mot de passe',
      text: `Votre code de réinitialisation est : ${resetCode}. Il expire dans 10 minutes.`,
    });

    res.status(200).json({ message: 'Code envoyé avec succès' });
  } catch (error) {
    console.error('forgotPassword Error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * Step 2: Reset password using OTP
 */
export async function resetPassword(req, res, next) {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword)
      return res.status(400).json({ message: 'Tous les champs sont requis' });

    const customer = await Customer.findOne({ email });
    if (!customer)
      return res.status(404).json({ message: 'Compte introuvable' });

    // Check OTP validity
    if (
      customer.resetCode !== resetCode ||
      !customer.resetCodeExpiry ||
      customer.resetCodeExpiry < Date.now()
    ) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    customer.password = await bcrypt.hash(newPassword, salt);

    // Clear OTP after success
    customer.resetCode = undefined;
    customer.resetCodeExpiry = undefined;

    await customer.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('resetPassword Error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

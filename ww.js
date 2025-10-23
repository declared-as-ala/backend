// Install nodemailer first: npm install nodemailer
import nodemailer from "nodemailer";

// SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com", // use SMTP, not IMAP
  port: 465, // SSL port
  secure: true, // true for port 465
  auth: {
    user: "admin@lesdelicesadmin.com", // replace with your email
    pass: "Aspire123456@", // replace with your password
  },
});

// Email options
const mailOptions = {
  from: '"Les Delices" <admin@lesdelicesadmin.com>',
  to: "alamissaoui.dev@gmail.com",
  subject: "Test Email",
  text: "Hello! This is a test email from Node.js",
};

// Send email
try {
  const info = await transporter.sendMail(mailOptions);
  console.log("Message sent:", info.messageId);
} catch (error) {
  console.log("Error:", error);
}

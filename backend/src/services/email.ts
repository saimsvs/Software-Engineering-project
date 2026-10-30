import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter: nodemailer.Transporter | null = null;

if (env.gmailUser && env.gmailAppPassword) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.gmailUser,
      pass: env.gmailAppPassword,
    },
  });
}

export async function sendVerificationCode({
  to,
  name,
  code,
}: {
  to: string;
  name: string;
  code: string;
}): Promise<void> {
  if (transporter && env.gmailUser) {
    try {
      await transporter.sendMail({
        from: `"${env.appName}" <${env.gmailUser}>`,
        to,
        subject: `${env.appName} - Verify your email`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${env.appName}!</h2>
            <p>Hi ${name},</p>
            <p>Thank you for signing up. Please use the verification code below to verify your email address:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0;">
              ${code}
            </div>
            <p>This code will expire in ${env.verificationCodeExpMin} minutes.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>Best regards,<br/>The ${env.appName} Team</p>
          </div>
        `,
      });
      return;
    } catch (error) {
      console.error("Failed to send email via Gmail SMTP:", error);
      throw error;
    }
  }

  // Fallback for development when Gmail SMTP is not configured
  console.log("\n========================================");
  console.log("VERIFICATION EMAIL (DEV MODE - Gmail SMTP not configured)");
  console.log("========================================");
  console.log(`To: ${to}`);
  console.log(`Name: ${name}`);
  console.log(`Verification Code: ${code}`);
  console.log(`Expires in: ${env.verificationCodeExpMin} minutes`);
  console.log("========================================\n");
}

import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  databaseUrl: process.env.DATABASE_URL || "",
  appName: process.env.APP_NAME || "Carbon Footprint",
  emailFrom: process.env.EMAIL_FROM || "",
  gmailUser: process.env.GMAIL_USER || "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || "",
  verificationCodeExpMin: parseInt(
    process.env.VERIFICATION_CODE_EXP_MIN || "10",
    10
  ),
};

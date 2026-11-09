import { setDefaultResultOrder } from "node:dns";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Prefer IPv4 for outbound connections. Some hosting networks have broken
// IPv6 egress; smtp.gmail.com is dual-stack (A + AAAA), so an unreachable
// IPv6 route makes the TCP connect stall until connectionTimeout fires.
setDefaultResultOrder("ipv4first");

const SMTP_HOST = "smtp.gmail.com";

// Port 587 (STARTTLS) is the standard mail submission port. Port 465
// (implicit TLS) is kept as a fallback because some networks block one of
// the two. Every attempt fails fast thanks to the timeouts below.
const SMTP_PORTS: Array<{ port: number; secure: boolean }> = [
  { port: 587, secure: false },
  { port: 465, secure: true },
];

function createTransport(port: number, secure: boolean): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: env.gmailUser,
      pass: env.gmailAppPassword,
    },
    // Fail fast instead of hanging requests for minutes when the SMTP
    // connection stalls (connect/greeting 15s, then 60s of inactivity).
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
  });
}

async function sendViaSmtp(options: nodemailer.SendMailOptions): Promise<void> {
  let lastError: unknown;

  for (const { port, secure } of SMTP_PORTS) {
    const transport = createTransport(port, secure);
    try {
      await transport.sendMail(options);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed to send email via Gmail SMTP on port ${port}:`, error);
    } finally {
      transport.close();
    }
  }

  throw lastError;
}

// EMAIL_FROM may be "Name <user@example.com>" — APIs want the bare address.
function senderEmail(): string {
  const raw = env.emailFrom || env.gmailUser;
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

// Brevo's HTTP API works over port 443, which hosting platforms never block.
// Free tier: 300 emails/day; the sender address only needs email verification
// (no domain purchase required).
async function sendViaBrevo(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.appName, email: senderEmail() },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Brevo API returned ${response.status}: ${await response.text()}`
    );
  }
}

async function sendViaResend(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom || `${env.appName} <onboarding@resend.dev>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend API returned ${response.status}: ${await response.text()}`
    );
  }
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
  const subject = `${env.appName} - Verify your email`;
  const html = `
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
  `;

  // HTTPS providers come first: some hosts (including Render) block outbound
  // SMTP ports, so trying SMTP first would just add 30s of dead timeouts.
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo({ to, subject, html });
      return;
    } catch (error) {
      console.error("Failed to send email via Brevo:", error);
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to, subject, html });
      return;
    } catch (error) {
      console.error("Failed to send email via Resend:", error);
    }
  }

  const smtpConfigured = Boolean(env.gmailUser && env.gmailAppPassword);

  if (smtpConfigured) {
    try {
      await sendViaSmtp({
        from: `"${env.appName}" <${env.gmailUser}>`,
        to,
        subject,
        html,
      });
      return;
    } catch (error) {
      console.error("Failed to send email via Gmail SMTP (all ports):", error);
    }
  }

  if (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || smtpConfigured) {
    throw new Error("All configured email providers failed — see logs above");
  }

  // Fallback for development when no email provider is configured
  console.log("\n========================================");
  console.log("VERIFICATION EMAIL (DEV MODE - no email provider configured)");
  console.log("========================================");
  console.log(`To: ${to}`);
  console.log(`Name: ${name}`);
  console.log(`Verification Code: ${code}`);
  console.log(`Expires in: ${env.verificationCodeExpMin} minutes`);
  console.log("========================================\n");
}

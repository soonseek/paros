import { env } from "~/env";

/**
 * Email Service
 * In development: prints verification link to console
 * In production: sends actual email (TODO: implement with Nodemailer/Resend)
 */

interface SendVerificationEmailParams {
  to: string;
  token: string;
}

/**
 * Send email verification link
 * @param params - Email parameters
 */
export async function sendVerificationEmail({
  to,
  token,
}: SendVerificationEmailParams): Promise<void> {
  const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

  // Development: Log to console
  if (process.env.NODE_ENV === "development") {
    console.log("\n" + "=".repeat(60));
    console.log("📧 EMAIL VERIFICATION");
    console.log("=".repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: 이메일 인증 요청`);
    console.log("\n메시지:");
    console.log(
      `아래 링크를 클릭하여 이메일 인증을 완료해주세요:\n${verificationUrl}`
    );
    console.log("\n이 링크은 24시간 동안 유효합니다.");
    console.log("=".repeat(60) + "\n");

    return;
  }

  // Production: Send actual email (TODO: implement)
  // Example with Nodemailer (needs to be installed):
  // import nodemailer from "nodemailer";
  //
  // const transporter = nodemailer.createTransporter({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT),
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASS,
  //   },
  // });
  //
  // await transporter.sendMail({
  //   from: process.env.EMAIL_FROM,
  //   to,
  //   subject: "이메일 인증 요청",
  //   html: `
  //     <p>아래 링크를 클릭하여 이메일 인증을 완료해주세요:</p>
  //     <a href="${verificationUrl}">${verificationUrl}</a>
  //     <p>이 링크은 24시간 동안 유효합니다.</p>
  //   `,
  // });

  console.warn(
    "Production email sending not implemented. Please configure Nodemailer or Resend."
  );
}

interface SendPasswordResetEmailParams {
  to: string;
  token: string;
}

/**
 * Send password reset link
 * @param params - Email parameters
 */
export async function sendPasswordResetEmail({
  to,
  token,
}: SendPasswordResetEmailParams): Promise<void> {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  // Development: Log to console
  if (process.env.NODE_ENV === "development") {
    console.log("\n" + "=".repeat(60));
    console.log("📧 PASSWORD RESET EMAIL");
    console.log("=".repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: [paros BMAD] 비밀번호 재설정`);
    console.log("\n메시지:");
    console.log("안녕하세요,");
    console.log("\n비밀번호 재설정 요청을 받았습니다. 아래 링크를 클릭하여 비밀번호를 재설정하세요:");
    console.log(`\n${resetUrl}`);
    console.log("\n이 링크는 1시간 동안 유효합니다.");
    console.log("\n요청하지 않으셨다면 이 이메일을 무시하세요.");
    console.log("\n감사합니다,");
    console.log("paros BMAD 팀");
    console.log("=".repeat(60) + "\n");

    return;
  }

  // Production: Send actual email (TODO: implement)
  console.warn(
    "Production email sending not implemented. Please configure Nodemailer or Resend."
  );
}

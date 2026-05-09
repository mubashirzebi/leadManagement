import nodemailer from 'nodemailer';

interface PasswordResetEmailInput {
  to: string;
  token: string;
  name: string;
}

export const sendSuperAdminPasswordResetEmail = async ({ to, token, name }: PasswordResetEmailInput) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_RESET_PASSWORD_URL } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('[Email] SMTP config missing. SuperAdmin reset token:', token);
    return;
  }

  const resetUrl = APP_RESET_PASSWORD_URL
    ? `${APP_RESET_PASSWORD_URL}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`
    : undefined;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'Reset your SuperAdmin password',
    text: [
      `Hi ${name},`,
      '',
      'Use this verification code to reset your SuperAdmin password:',
      token,
      '',
      resetUrl ? `Or open this link: ${resetUrl}` : '',
      '',
      'This code expires in 15 minutes. If you did not request this, you can ignore this email.',
    ].filter(Boolean).join('\n'),
  });
};

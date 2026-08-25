export interface UserWelcomeData {
  name: string;
  email: string;
}

export function userWelcomeEmail(data: UserWelcomeData): { subject: string; html: string; text: string } {
  const subject = "Welcome to SOAR Console";
  const text = `Hi ${data.name},\n\nAn account has been created for you on SOAR Console using this email address (${data.email}). An administrator will share your sign-in details separately.\n\nIf you weren't expecting this, you can ignore this email.`;
  const html = `
    <p>Hi ${data.name},</p>
    <p>An account has been created for you on <strong>SOAR Console</strong> using this email address (${data.email}). An administrator will share your sign-in details separately.</p>
    <p>If you weren't expecting this, you can ignore this email.</p>
  `.trim();

  return { subject, html, text };
}

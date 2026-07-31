import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'mail.aidatom.com';
const port = Number(process.env.SMTP_PORT) || 465;
const user = process.env.SMTP_USER || 'info@aidatom.com';
const pass = process.env.SMTP_PASS || '';
const secure = process.env.SMTP_SECURE !== 'false'; // true for 465, false for 587

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: pass ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: false, // Prevents self-signed SSL errors if any
  },
});

export async function sendPasswordResetEmail(toEmail: string, fullName: string, resetLink: string) {
  const mailOptions = {
    from: `"Aidatom Destek" <${user}>`,
    to: toEmail,
    subject: 'Aidatom — Şifre Sıfırlama Talebi',
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background-color: #FFFFFF; border: 1px solid #E4E9EF; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 31, 61, 0.05);">
        <div style="text-align: center; margin-bottom: 28px;">
          <img src="https://aidatom.com/logo.svg" alt="Aidatom" style="height: 40px; width: auto;" />
        </div>

        <h2 style="color: #0F1F3D; font-size: 20px; font-weight: 700; margin-bottom: 12px; text-align: center;">
          Şifre Sıfırlama Talebi
        </h2>

        <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Merhaba <strong>${fullName || 'Kullanıcımız'}</strong>,<br/><br/>
          Aidatom hesabınız için şifre sıfırlama talebinde bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #0FA3A3; color: #FFFFFF; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 163, 163, 0.25);">
            Yeni Şifre Belirle
          </a>
        </div>

        <p style="color: #6B7280; font-size: 13px; line-height: 1.5; margin-bottom: 24px; text-align: center;">
          Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:<br/>
          <a href="${resetLink}" style="color: #0FA3A3; word-break: break-all; text-decoration: underline;">${resetLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #E4E9EF; margin: 28px 0;" />

        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
          Bu talebi siz yapmadıysanız bu e-postayı güvenle göz ardı edebilirsiniz. Hesabınız güvendedir.<br/>
          © Aidatom Akıllı Aidat ve Alacak Yönetim Sistemleri
        </p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

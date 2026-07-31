const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: 'info@aidatom.com',
    pass: 'Erbakan55.',
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log('Testing Hostinger SMTP connection...');
    await transporter.verify();
    console.log('✅ Hostinger SMTP Connection Verified Successfully!');
  } catch (err) {
    console.error('❌ SMTP Error:', err);
  }
}

main();

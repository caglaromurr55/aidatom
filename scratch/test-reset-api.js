const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const supabaseUrl = 'https://supaa.aidatom.com';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MzI2NTg4MCwiZXhwIjo0OTM4OTM5NDgwLCJyb2xlIjoiYW5vbiJ9.Q28sXkb-GSMbneQkMXeAlkHK1zkOEijNlEGvJolFadc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testResetApi(input) {
  console.log('Testing reset API logic for input:', input);

  const cleanInput = input.trim();
  const isEmail = cleanInput.includes('@');

  let profile = null;

  if (isEmail) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .ilike('email', cleanInput)
      .limit(1);
    console.log('Email query res:', { data, error });
    if (data && data.length > 0) profile = data[0];
  } else {
    const rawDigits = cleanInput.replace(/\D/g, '');
    const base10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    const phoneVariants = [base10, `0${base10}`, `90${base10}`, `+90${base10}`];
    console.log('Phone variants:', phoneVariants);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('phone', phoneVariants)
      .limit(1);
    console.log('Phone query res:', { data, error });
    if (data && data.length > 0) profile = data[0];
  }

  if (!profile) {
    console.log('❌ Profile NOT found');
    return;
  }

  console.log('✅ Found Profile:', profile);

  let recipientEmail = profile.email;
  if (!recipientEmail || recipientEmail.trim() === '') {
    recipientEmail = `${profile.phone}@aidatom.com`;
  }

  console.log('Recipient Email:', recipientEmail);

  // Test sending Nodemailer
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

  try {
    const mailRes = await transporter.sendMail({
      from: '"Aidatom Destek" <info@aidatom.com>',
      to: recipientEmail,
      subject: 'Aidatom — Test Şifre Sıfırlama',
      html: '<p>Test şifre sıfırlama e-postası</p>',
    });
    console.log('✅ Mail Sent Successfully:', mailRes.messageId);
  } catch (mailErr) {
    console.error('❌ Mail Error:', mailErr);
  }
}

testResetApi('905000000001');

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supaa.aidatom.com';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MzI2NTg4MCwiZXhwIjo0OTM4OTM5NDgwLCJyb2xlIjoiYW5vbiJ9.Q28sXkb-GSMbneQkMXeAlkHK1zkOEijNlEGvJolFadc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const randomPhone = '90532' + Math.floor(1000000 + Math.random() * 9000000);
  const email = `${randomPhone}@aidatom.com`;
  console.log('Trying to sign up with email:', email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      data: {
        full_name: 'Test User',
        phone: randomPhone,
        email: 'test@example.com',
        manager_type: 'individual',
        role: 'site_manager'
      }
    }
  });

  if (error) {
    console.error('Sign up error details:');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Raw Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Sign up successful:', data);
  }
}

test();

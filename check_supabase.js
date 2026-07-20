require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try to find Matheus Marques
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  
  const user = data.users.find(u => u.email === 'matheus.martines2012@gmail.com' || u.user_metadata?.name?.includes('Matheus'));
  if (user) {
    console.log('Found user:', user.email);
    console.log('Metadata avatar:', user.user_metadata?.avatar_url);
    console.log('Metadata picture:', user.user_metadata?.picture);
  } else {
    console.log('User not found');
  }
}

check();

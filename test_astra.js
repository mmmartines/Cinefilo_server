const fs = require('fs');
const { DataAPIClient } = require('@datastax/astra-db-ts');

const envContent = fs.readFileSync('.env', 'utf-8');
const endpointMatch = envContent.match(/ASTRA_DB_API_ENDPOINT=(.*)/);
const tokenMatch = envContent.match(/ASTRA_DB_APPLICATION_TOKEN=(.*)/);

const endpoint = endpointMatch ? endpointMatch[1].trim() : '';
const token = tokenMatch ? tokenMatch[1].trim() : '';

const client = new DataAPIClient(token);
const db = client.db(endpoint);

async function run() {
  const users = await db.collection('users').find({}, { limit: 5 }).toArray();
  console.log('--- USERS --- ' + new Date().toISOString());
  users.forEach(u => console.log(`Name: ${u.name}, avatar_url: ${u.avatar_url ? u.avatar_url.substring(0,30) + '...' : 'NULL'}`));
  
  const feed = await db.collection('feed').find({}, { limit: 5 }).toArray();
  console.log('--- FEED ---');
  feed.forEach(f => console.log(`Action: ${f.action}, avatar: ${f.user_avatar ? f.user_avatar.substring(0,30) + '...' : 'NULL'}, user_id: ${f.user_id}`));
}

run().catch(console.error);

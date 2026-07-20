const fs = require('fs');
const { DataAPIClient } = require('@datastax/astra-db-ts');

const envContent = fs.readFileSync('.env', 'utf-8');
const endpointMatch = envContent.match(/ASTRA_DB_API_ENDPOINT=(.*)/);
const tokenMatch = envContent.match(/ASTRA_DB_APPLICATION_TOKEN=(.*)/);

const endpoint = endpointMatch ? endpointMatch[1].trim() : '';
const token = tokenMatch ? tokenMatch[1].trim() : '';

const client = new DataAPIClient(token);
const db = client.db(endpoint);

async function check() {
  const users = await db.collection('users').find({}).toArray();
  console.log('--- ALL USERS ---');
  users.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, avatar: ${u.avatar_url ? u.avatar_url.substring(0,25) + '...' : 'NULL'}`));
}

check();

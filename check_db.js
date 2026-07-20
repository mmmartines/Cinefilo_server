require('dotenv').config();
const { DataAPIClient } = require('@datastax/astra-db-ts');

const endpoint = process.env.ASTRA_DB_API_ENDPOINT;
const token = process.env.ASTRA_DB_APPLICATION_TOKEN;

async function checkDb() {
  const client = new DataAPIClient(token);
  const db = client.db(endpoint);
  
  const usersCollection = db.collection('users');
  const users = await usersCollection.find({}, { limit: 5 }).toArray();
  
  console.log('USERS IN DB:');
  users.forEach(u => {
    console.log(`Name: ${u.name}, avatar_url: ${u.avatar_url ? 'EXISTS (' + u.avatar_url.substring(0,20) + '...)' : 'MISSING'}`);
  });
}

checkDb().catch(console.error);

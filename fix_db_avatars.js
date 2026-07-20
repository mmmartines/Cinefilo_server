const fs = require('fs');
const { DataAPIClient } = require('@datastax/astra-db-ts');

const envContent = fs.readFileSync('.env', 'utf-8');
const endpointMatch = envContent.match(/ASTRA_DB_API_ENDPOINT=(.*)/);
const tokenMatch = envContent.match(/ASTRA_DB_APPLICATION_TOKEN=(.*)/);

const endpoint = endpointMatch ? endpointMatch[1].trim() : '';
const token = tokenMatch ? tokenMatch[1].trim() : '';

const client = new DataAPIClient(token);
const db = client.db(endpoint);

async function fix() {
  const usersCollection = db.collection('users');
  const feedCollection = db.collection('feed');

  // Fix users
  const users = await usersCollection.find({}).toArray();
  for (const u of users) {
    if (u.avatar_url && u.avatar_url.startsWith('file:///')) {
      console.log(`Fixing user ${u.name}`);
      await usersCollection.updateOne({ _id: u._id }, { $set: { avatar_url: null } });
    }
  }

  // Fix feed
  const feed = await feedCollection.find({}).toArray();
  for (const f of feed) {
    if (f.user_avatar && f.user_avatar.startsWith('file:///')) {
      console.log(`Fixing feed item ${f._id}`);
      await feedCollection.updateOne({ _id: f._id }, { $set: { user_avatar: null } });
    }
  }
  
  console.log('Fixed local file URIs in DB!');
}

fix().catch(console.error);

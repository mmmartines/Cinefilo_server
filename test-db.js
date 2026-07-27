const { DataAPIClient } = require('@datastax/astra-db-ts');
require('dotenv').config();
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT);
async function run() {
  const users = db.collection('users');
  const docs = await users.find({ nickname: 'mmartines' }).toArray();
  console.log('Docs with nickname mmartines:', docs.length);
  const nullDocs = await users.find({ nickname: null }).toArray();
  console.log('Docs with null nickname:', nullDocs.length);
  const emptyDocs = await users.find({ nickname: '' }).toArray();
  console.log('Docs with empty nickname:', emptyDocs.length);
}
run();

import { DataAPIClient } from '@datastax/astra-db-ts';

const endpoint = process.env.ASTRA_DB_API_ENDPOINT;
const token = process.env.ASTRA_DB_APPLICATION_TOKEN;

if (!endpoint || !token) {
  throw new Error('As variáveis de ambiente ASTRA_DB_API_ENDPOINT e ASTRA_DB_APPLICATION_TOKEN devem estar definidas.');
}

// Inicializa o cliente do Astra DB
const client = new DataAPIClient(token);
const db = client.db(endpoint);

export { db };

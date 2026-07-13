import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const user = await authenticateUser(req);
    const listsCollection = db.collection('shared_lists');
    const usersCollection = db.collection('users');

    if (req.method === 'GET') {
      // Retorna listas onde o usuário é dono OU está na lista de convidados (shared_with)
      // Como o DataAPIClient aceita queries $or:
      const cursor = await listsCollection.find({
        $or: [
          { owner_id: user.id },
          { shared_with: { $in: [user.id] } }
        ]
      });
      const lists = await cursor.toArray();
      
      // Opcional: Popular o nome do dono
      for (const list of lists) {
        if (list.owner_id !== user.id) {
          const ownerProfile = await usersCollection.findOne({ supabase_id: list.owner_id });
          if (ownerProfile) {
            list.owner_name = ownerProfile.name;
          }
        }
      }
      
      return res.status(200).json({ success: true, data: lists });
    }
    
    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome da lista não informado.' });

      const newList = {
        _id: crypto.randomUUID(), // Gera um ID único
        name,
        owner_id: user.id,
        shared_with: [],
        movies: [],
        created_at: new Date().toISOString()
      };

      await listsCollection.insertOne(newList);

      return res.status(201).json({ success: true, data: newList });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /lists:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import { z } from 'zod';

const createClubSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().optional()
});

const joinClubSchema = z.object({
  joinCode: z.string().length(6)
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const user = await authenticateUser(req);
    
    const collections = await db.listCollections();
    if (!collections.some((col: any) => col.name === 'clubs')) {
      await db.createCollection('clubs');
    }

    const clubsCollection = db.collection('clubs');
    const usersCollection = db.collection('users');
    const userProfile = await usersCollection.findOne({ supabase_id: user.id });

    // GET: Lista os clubes que o usuário participa
    if (req.method === 'GET') {
      const cursor = await clubsCollection.find({ members: user.id });
      const myClubs = await cursor.toArray();
      return res.status(200).json({ success: true, data: myClubs });
    }

    // POST: Criar um clube novo ou entrar em um via código
    if (req.method === 'POST') {
      const { action } = req.query;

      if (action === 'join') {
        try {
          const { joinCode } = joinClubSchema.parse(req.body);
          const club = await clubsCollection.findOne({ joinCode: joinCode.toUpperCase() });
          
          if (!club) return res.status(404).json({ error: 'Clube não encontrado ou código inválido.' });
          
          if (club.members.includes(user.id)) {
            return res.status(400).json({ error: 'Você já está neste clube.' });
          }

          club.members.push(user.id);
          await clubsCollection.updateOne({ _id: club._id }, { $set: { members: club.members } });
          
          return res.status(200).json({ success: true, message: 'Bem-vindo ao clube!', data: club });
        } catch (validationError: any) {
          return res.status(400).json({ error: 'Código inválido', details: validationError.errors });
        }
      } 
      else {
        // Criar clube
        try {
          const { name, description } = createClubSchema.parse(req.body);
          
          const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let joinCode = '';
          for (let i = 0; i < 6; i++) {
            joinCode += characters.charAt(Math.floor(Math.random() * characters.length));
          }

          const newClub = {
            name,
            description: description || '',
            owner_id: user.id,
            members: [user.id],
            movie_of_the_week: null, // Pode ser preenchido futuramente com { movieId, title, poster_path }
            joinCode,
            created_at: new Date().toISOString()
          };

          const result = await clubsCollection.insertOne(newClub);
          return res.status(200).json({ success: true, message: 'Clube criado com sucesso!', data: { _id: result.insertedId, ...newClub } });
        } catch (validationError: any) {
          return res.status(400).json({ error: 'Dados inválidos', details: validationError.errors });
        }
      }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /clubs:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

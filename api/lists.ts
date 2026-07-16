import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const user = await authenticateUser(req);
    const listsCollection = db.collection('shared_lists');
    const usersCollection = db.collection('users');

    // ─── PUT /api/lists?action=movies → adiciona filme a uma lista
    // ─── DELETE /api/lists?action=movies → remove filme de uma lista
    if (req.query.action === 'movies') {
      const { list_id, movie } = req.body;

      if (!list_id || !movie || !movie.movieId) {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }

      const list = await listsCollection.findOne({ _id: list_id });
      if (!list) return res.status(404).json({ error: 'Lista não encontrada' });

      const canEdit = list.owner_id === user.id || (list.shared_with && list.shared_with.includes(user.id));
      if (!canEdit) {
        return res.status(403).json({ error: 'Você não tem permissão para editar esta lista' });
      }

      if (req.method === 'PUT') {
        const exists = list.movies.some((m: any) => m.movieId === movie.movieId);
        if (!exists) {
          await listsCollection.updateOne(
            { _id: list_id },
            { $push: { movies: { ...movie, addedAt: new Date().toISOString() } } }
          );
        }
        return res.status(200).json({ success: true, message: 'Filme adicionado.' });
      }

      if (req.method === 'DELETE') {
        const list = await listsCollection.findOne({ _id: list_id });
        if (list && list.movies) {
          const updatedMovies = list.movies.filter((m: any) => m.movieId !== movie.movieId);
          await listsCollection.updateOne(
            { _id: list_id },
            { $set: { movies: updatedMovies } }
          );
        }
        return res.status(200).json({ success: true, message: 'Filme removido.' });
      }
    }

    // ─── GET /api/lists → retorna listas do usuário
    if (req.method === 'GET') {
      const cursor = await listsCollection.find({
        $or: [
          { owner_id: user.id },
          { shared_with: { $in: [user.id] } }
        ]
      });
      const lists = await cursor.toArray();

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

    // ─── POST /api/lists → cria nova lista
    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome da lista não informado.' });

      const newList = {
        _id: crypto.randomUUID(),
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

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

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
    if (!collections.some((col: any) => col.name === 'movie_swipes')) {
      await db.createCollection('movie_swipes');
    }

    const swipesCollection = db.collection('movie_swipes');

    if (req.method === 'POST') {
      const { friendId, movieId, action } = req.body;
      
      if (!friendId || !movieId || !action) {
        return res.status(400).json({ error: 'friendId, movieId e action são obrigatórios.' });
      }

      const existingSwipe = await swipesCollection.findOne({
        user_id: user.id,
        friend_id: friendId,
        movie_id: movieId
      });

      if (existingSwipe) {
        // Se já existia, só atualiza a ação
        await swipesCollection.updateOne(
          { _id: existingSwipe._id },
          { $set: { action, updated_at: new Date().toISOString() } }
        );
      } else {
        await swipesCollection.insertOne({
          user_id: user.id,
          friend_id: friendId,
          movie_id: movieId,
          action: action,
          created_at: new Date().toISOString()
        });
      }

      let isMatch = false;

      // Se for um 'liked', checar se o amigo também deu like
      if (action === 'liked') {
        const friendMatch = await swipesCollection.findOne({
          user_id: friendId,
          friend_id: user.id,
          movie_id: movieId,
          action: 'liked'
        });

        if (friendMatch) {
          isMatch = true;
          // Dispara notificação de match aqui se necessário (futuro)
        }
      }

      return res.status(200).json({ success: true, isMatch });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /swipes:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

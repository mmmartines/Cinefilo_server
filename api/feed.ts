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
    const feedCollection = db.collection('feed');
    const usersCollection = db.collection('users');

    if (req.method === 'GET') {
      // Pega o feed global dos amigos
      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      if (!userProfile) return res.status(404).json({ error: 'Perfil não encontrado' });

      const friendsIds = userProfile.friends || [];
      const userIdsToFetch = [user.id, ...friendsIds];

      const cursor = await feedCollection.find(
        { user_id: { $in: userIdsToFetch } },
        { sort: { created_at: -1 }, limit: 50 }
      );
      
      const activities = await cursor.toArray();

      return res.status(200).json({ success: true, data: activities });
    }

    if (req.method === 'POST') {
      const { movie, action, rating, review, has_spoiler } = req.body;
      if (!movie || !action) return res.status(400).json({ error: 'movie e action são obrigatórios' });

      const userProfile = await usersCollection.findOne({ supabase_id: user.id });

      const newActivity = {
        user_id: user.id,
        user_name: userProfile?.name || 'Usuário',
        user_avatar: userProfile?.avatar_url || null,
        movie_id: movie.movieId,
        movie_title: movie.title,
        movie_poster: movie.poster_path,
        action, // 'watched', 'rated', 'added_to_list'
        rating,
        review,
        has_spoiler: has_spoiler || false,
        likes: [],
        created_at: new Date().toISOString()
      };

      const result = await feedCollection.insertOne(newActivity);

      return res.status(200).json({ success: true, data: { _id: result.insertedId, ...newActivity } });
    }

    if (req.method === 'PUT') {
      // Like / Unlike activity
      const { activity_id } = req.body;
      if (!activity_id) return res.status(400).json({ error: 'activity_id é obrigatório' });

      const activity = await feedCollection.findOne({ _id: activity_id });
      if (!activity) return res.status(404).json({ error: 'Atividade não encontrada' });

      let likes = activity.likes || [];
      if (likes.includes(user.id)) {
        likes = likes.filter((id: string) => id !== user.id);
      } else {
        likes.push(user.id);
      }

      await feedCollection.updateOne({ _id: activity_id }, { $set: { likes } });

      return res.status(200).json({ success: true, likes });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /feed:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}

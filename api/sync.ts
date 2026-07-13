import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const usersCollection = db.collection('users');

    const { total_movies, total_minutes, watched_movies, avatar_url, expo_push_token, notifications_enabled } = req.body;

    if (typeof total_movies !== 'number' || typeof total_minutes !== 'number') {
      return res.status(400).json({ error: 'Dados estatísticos inválidos.' });
    }

    const updateFields: any = {
      'stats.total_movies': total_movies,
      'stats.total_minutes': total_minutes,
      'watched_movies': watched_movies || []
    };
    
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;
    if (expo_push_token !== undefined) updateFields.expo_push_token = expo_push_token;
    if (notifications_enabled !== undefined) updateFields.notifications_enabled = notifications_enabled;

    // Atualiza os stats e as listas de filmes no Astra DB
    await usersCollection.updateOne(
      { supabase_id: user.id },
      { $set: updateFields }
    );

    return res.status(200).json({ success: true, message: 'Dados sincronizados com sucesso' });

  } catch (error: any) {
    console.error('Erro na API /sync:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

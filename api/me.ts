import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const usersCollection = db.collection('users');

    const myProfile = await usersCollection.findOne({ supabase_id: user.id });
    if (!myProfile) return res.status(404).json({ error: 'Perfil não encontrado' });

    return res.status(200).json({ 
      success: true, 
      data: {
        id: myProfile.supabase_id,
        name: myProfile.name,
        tag: myProfile.tag,
        avatar_url: myProfile.avatar_url || null,
        expo_push_token: myProfile.expo_push_token || null,
        notifications_enabled: myProfile.notifications_enabled ?? true,
        stats: myProfile.stats,
        watched_movies: myProfile.watched_movies || []
      } 
    });

  } catch (error: any) {
    console.error('Erro na API /me:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

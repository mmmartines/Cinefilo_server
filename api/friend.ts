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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID do amigo não fornecido' });
    }

    // Busca o perfil do usuário atual para confirmar se são amigos
    const myProfile = await usersCollection.findOne({ supabase_id: user.id });
    if (!myProfile) return res.status(404).json({ error: 'Seu perfil não encontrado' });

    const myFriends = myProfile.friends || [];
    if (!myFriends.includes(id) && id !== user.id) {
      return res.status(403).json({ error: 'Você só pode ver os detalhes de quem é seu amigo.' });
    }

    // Busca o perfil completo do amigo
    const friendProfile = await usersCollection.findOne({ supabase_id: id });
    if (!friendProfile) {
      return res.status(404).json({ error: 'Perfil do amigo não encontrado' });
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        id: friendProfile.supabase_id,
        name: friendProfile.name,
        tag: friendProfile.tag,
        stats: friendProfile.stats,
        watched_movies: friendProfile.watched_movies || [],
      } 
    });

  } catch (error: any) {
    console.error('Erro na API /friend:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

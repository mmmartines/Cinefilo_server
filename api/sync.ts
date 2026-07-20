import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import { syncPayloadSchema } from '../utils/schemas';

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

    try {
      const validatedPayload = syncPayloadSchema.parse(req.body);
      
      const { total_movies, total_minutes, watched_movies, avatar_url, expo_push_token, notifications_enabled, completed_challenges, bonus_xp, level, xp, last_updated } = validatedPayload;

      // ObtÃ©m o perfil atual para comparar a data de Ãºltima atualizaÃ§Ã£o (resoluÃ§Ã£o de conflitos)
      const currentUserProfile = await usersCollection.findOne({ supabase_id: user.id });
      
      if (currentUserProfile && currentUserProfile.last_updated && last_updated) {
        const cloudTime = new Date(currentUserProfile.last_updated).getTime();
        const localTime = new Date(last_updated).getTime();
        
        // Se a nuvem tem dados mais recentes e o app mandou um dado antigo, rejeita a sincronizaÃ§Ã£o
        if (cloudTime > localTime) {
          return res.status(200).json({ success: true, message: 'Nuvem jÃ¡ possui dados mais recentes. SincronizaÃ§Ã£o ignorada.', ignored: true });
        }
      }

      const updateFields: any = {
        'stats.total_movies': total_movies,
        'stats.total_minutes': total_minutes,
        'watched_movies': watched_movies || [],
        'last_updated': last_updated || new Date().toISOString()
      };
    
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;
    if (expo_push_token !== undefined) updateFields.expo_push_token = expo_push_token;
    if (notifications_enabled !== undefined) updateFields.notifications_enabled = notifications_enabled;
    if (completed_challenges !== undefined) updateFields.completed_challenges = completed_challenges;
    if (bonus_xp !== undefined) updateFields.bonus_xp = bonus_xp;
    if (level !== undefined) updateFields['stats.level'] = level;
    if (xp !== undefined) updateFields['stats.xp'] = xp;

    // Atualiza os stats e as listas de filmes no Astra DB
    await usersCollection.updateOne(
      { supabase_id: user.id },
      { $set: updateFields }
    );

    return res.status(200).json({ success: true, message: 'Dados sincronizados com sucesso' });
    } catch (validationError: any) {
      return res.status(400).json({ error: 'Dados inválidos', details: validationError.errors });
    }

  } catch (error: any) {
    console.error('Erro na API /sync:', error);
    return res.status(401).json({ error: error.message || 'NÃ£o autorizado' });
  }
}


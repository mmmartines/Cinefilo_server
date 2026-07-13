import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { chat_id, content, sender_name } = req.body;

    if (!chat_id || !content) {
      return res.status(400).json({ error: 'chat_id e content são obrigatórios' });
    }

    // Busca os membros do chat no Supabase
    const { data: members, error } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chat_id);

    if (error || !members) {
      console.error('Erro ao buscar membros', error);
      return res.status(500).json({ error: 'Erro ao buscar membros' });
    }

    const memberIds = members
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== user.id); // não notificar a si mesmo

    if (memberIds.length === 0) {
      return res.status(200).json({ success: true, message: 'Nenhum membro para notificar' });
    }

    // Busca os tokens no AstraDB
    const usersCollection = db.collection('users');
    const cursor = await usersCollection.find({ supabase_id: { $in: memberIds } });
    const profiles = await cursor.toArray();

    const pushMessages: any[] = [];

    for (const profile of profiles) {
      if (profile.expo_push_token && profile.notifications_enabled !== false) {
        pushMessages.push({
          to: profile.expo_push_token,
          sound: 'default',
          title: `Nova mensagem de ${sender_name}`,
          body: content,
          data: { chatId: chat_id },
        });
      }
    }

    if (pushMessages.length > 0) {
      // Dispara para o Expo
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      });
    }

    return res.status(200).json({ success: true, count: pushMessages.length });
  } catch (error: any) {
    console.error('Erro na API /notify:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

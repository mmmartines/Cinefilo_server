import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
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

  try {
    const user = await authenticateUser(req);
    const notificationsCollection = db.collection('notifications');

    // Ensure chat_reads collection exists if needed
    const collections = await db.listCollections();
    if (!collections.some((col: any) => col.name === 'chat_reads')) {
      await db.createCollection('chat_reads');
    }
    const chatReadsCollection = db.collection('chat_reads');

    const type = req.query.type;

    if (type === 'chat_reads') {
      if (req.method === 'GET') {
        const cursor = await chatReadsCollection.find({ user_id: user.id });
        const reads = await cursor.toArray();
        return res.status(200).json({ success: true, data: reads });
      }

      if (req.method === 'PUT') {
        const { chat_id, last_read_at } = req.body;
        if (!chat_id) return res.status(400).json({ error: 'chat_id is required' });

        let now = last_read_at;
        if (!now) {
          const date = new Date();
          date.setSeconds(date.getSeconds() + 5);
          now = date.toISOString();
        }

        const existing = await chatReadsCollection.findOne({ user_id: user.id, chat_id });

        if (existing) {
          await chatReadsCollection.updateOne(
            { _id: existing._id },
            { $set: { last_read_at: now } }
          );
        } else {
          await chatReadsCollection.insertOne({
            user_id: user.id,
            chat_id,
            last_read_at: now
          });
        }
        return res.status(200).json({ success: true, last_read_at: now });
      }
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (req.method === 'GET') {
      const cursor = await notificationsCollection.find(
        { target_user_id: user.id },
        { sort: { created_at: -1 }, limit: 50 }
      );
      
      const notifications = await cursor.toArray();
      return res.status(200).json({ success: true, data: notifications });
    }

    if (req.method === 'PUT') {
      // Marcar como lida
      const { notification_id } = req.body;
      if (notification_id) {
         await notificationsCollection.updateOne({ _id: notification_id, target_user_id: user.id }, { $set: { read: true } });
      } else {
         // Marcar todas como lidas
         await notificationsCollection.updateMany({ target_user_id: user.id }, { $set: { read: true } });
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
      const { chat_id, content, sender_name } = req.body;

      if (!chat_id || !content) {
        return res.status(400).json({ error: 'chat_id e content são obrigatórios' });
      }

      const { data: members, error } = await supabaseAdmin
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chat_id);

      if (error || !members) {
        return res.status(500).json({ error: 'Erro ao buscar membros' });
      }

      const memberIds = members
        .map((m: any) => m.user_id)
        .filter((id: string) => id !== user.id); 

      if (memberIds.length === 0) {
        return res.status(200).json({ success: true, message: 'Nenhum membro para notificar' });
      }

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
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /notifications:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}

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
    const notificationsCollection = db.collection('notifications');

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

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /notifications:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}

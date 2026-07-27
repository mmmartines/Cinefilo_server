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
    const requestsCollection = db.collection('friend_requests');
    const usersCollection = db.collection('users');

    // GET: List requests received and sent
    if (req.method === 'GET') {
      const receivedCursor = await requestsCollection.find({ to_user_id: user.id });
      const received = await receivedCursor.toArray();

      const sentCursor = await requestsCollection.find({ from_user_id: user.id });
      const sent = await sentCursor.toArray();

      // Populate user info for received requests (who sent them)
      const receivedPopulated = await Promise.all(received.map(async (r: any) => {
        const sender = await usersCollection.findOne({ supabase_id: r.from_user_id });
        return { ...r, sender_name: sender?.name, sender_nickname: sender?.nickname, sender_avatar: sender?.avatar_url };
      }));

      // Populate user info for sent requests (to whom they were sent)
      const sentPopulated = await Promise.all(sent.map(async (r: any) => {
        const receiver = await usersCollection.findOne({ supabase_id: r.to_user_id });
        return { ...r, receiver_name: receiver?.name, receiver_nickname: receiver?.nickname, receiver_avatar: receiver?.avatar_url };
      }));

      return res.status(200).json({ success: true, data: { received: receivedPopulated, sent: sentPopulated } });
    }

    // POST: Send a request (by nickname)
    if (req.method === 'POST') {
      const { nickname } = req.body;
      if (!nickname) return res.status(400).json({ error: 'Apelido é obrigatório' });
      
      const cleanNickname = nickname.replace('@', '').toLowerCase();

      const friendProfile = await usersCollection.findOne({ nickname: cleanNickname });
      if (!friendProfile) {
        return res.status(404).json({ error: 'Nenhum usuário encontrado com esse apelido' });
      }

      if (friendProfile.supabase_id === user.id) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo' });
      }

      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      const currentFriends = userProfile?.friends || [];

      if (currentFriends.includes(friendProfile.supabase_id)) {
        return res.status(400).json({ error: 'Vocês já são amigos!' });
      }

      // Check if there is already a pending request
      const existingRequest = await requestsCollection.findOne({ 
        from_user_id: user.id, 
        to_user_id: friendProfile.supabase_id 
      });

      if (existingRequest) {
        return res.status(400).json({ error: 'Você já enviou uma solicitação para este usuário.' });
      }

      // Check if the other user already sent a request to me
      const reverseRequest = await requestsCollection.findOne({ 
        from_user_id: friendProfile.supabase_id, 
        to_user_id: user.id 
      });

      if (reverseRequest) {
         // Instead of error, we could auto accept, but let's just warn
        return res.status(400).json({ error: 'Este usuário já te enviou uma solicitação. Verifique sua caixa de entrada.' });
      }

      const newRequest = {
        from_user_id: user.id,
        to_user_id: friendProfile.supabase_id,
        created_at: new Date().toISOString()
      };

      await requestsCollection.insertOne(newRequest);
      
      // Enviar Push Notification
      if (friendProfile.expo_push_token && friendProfile.notifications_enabled !== false) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            to: friendProfile.expo_push_token,
            sound: 'default',
            title: `Novo pedido de amizade!`,
            body: `${userProfile?.name || 'Alguém'} enviou um pedido de amizade.`,
            data: { type: 'friend_request', tag: userProfile?.tag },
          }]),
        });
      }

      return res.status(200).json({ success: true, message: `Solicitação enviada para ${friendProfile.name}!` });
    }

    // PUT: Accept a request
    if (req.method === 'PUT') {
      const { request_id } = req.body;
      if (!request_id) return res.status(400).json({ error: 'request_id é obrigatório' });

      const request = await requestsCollection.findOne({ _id: request_id });
      if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });
      
      if (request.to_user_id !== user.id) {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      // Add friends bidirectionally
      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      const friendProfile = await usersCollection.findOne({ supabase_id: request.from_user_id });

      if (userProfile && friendProfile) {
        const userFriends = userProfile.friends || [];
        if (!userFriends.includes(friendProfile.supabase_id)) {
          userFriends.push(friendProfile.supabase_id);
          await usersCollection.updateOne({ supabase_id: user.id }, { $set: { friends: userFriends } });
        }

        const friendFriends = friendProfile.friends || [];
        if (!friendFriends.includes(user.id)) {
          friendFriends.push(user.id);
          await usersCollection.updateOne({ supabase_id: friendProfile.supabase_id }, { $set: { friends: friendFriends } });
        }
      }

      // Delete request
      await requestsCollection.deleteOne({ _id: request_id });
      return res.status(200).json({ success: true, message: 'Solicitação aceita!' });
    }

    // DELETE: Decline or Cancel a request
    if (req.method === 'DELETE') {
      const { request_id } = req.body;
      if (!request_id) return res.status(400).json({ error: 'request_id é obrigatório' });

      const request = await requestsCollection.findOne({ _id: request_id });
      if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });

      if (request.to_user_id !== user.id && request.from_user_id !== user.id) {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      await requestsCollection.deleteOne({ _id: request_id });
      
      const isCancel = request.from_user_id === user.id;
      return res.status(200).json({ success: true, message: isCancel ? 'Solicitação cancelada.' : 'Solicitação recusada.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /friend_requests:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}

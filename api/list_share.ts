import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const user = await authenticateUser(req);
    const listsCollection = db.collection('shared_lists');
    const usersCollection = db.collection('users');

    const { list_id, friend_tag } = req.body;
    
    if (!list_id || !friend_tag) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    if (req.method === 'POST') {
      // 1. Busca a lista e valida se eu sou o dono
      const list = await listsCollection.findOne({ _id: list_id });
      if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
      
      if (list.owner_id !== user.id) {
        return res.status(403).json({ error: 'Apenas o dono da lista pode compartilhá-la.' });
      }

      // 2. Busca o amigo pela tag
      const friendProfile = await usersCollection.findOne({ tag: friend_tag });
      if (!friendProfile) {
        return res.status(404).json({ error: 'Nenhum usuário encontrado com essa Tag.' });
      }

      // 3. Adiciona o ID do amigo ao array shared_with (se já não estiver lá)
      const friendId = friendProfile.supabase_id;
      
      if (friendId === user.id) {
         return res.status(400).json({ error: 'Você já é o dono desta lista.' });
      }

      const isAlreadyShared = list.shared_with && list.shared_with.includes(friendId);
      if (!isAlreadyShared) {
        await listsCollection.updateOne(
          { _id: list_id },
          { $push: { shared_with: friendId } }
        );
      }

      return res.status(200).json({ success: true, message: 'Lista compartilhada com sucesso!' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /list_share:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

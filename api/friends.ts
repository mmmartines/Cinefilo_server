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
    const usersCollection = db.collection('users');

    // â”€â”€â”€ GET /api/friends?id=<supabase_id> â†’ detalhes de um amigo especÃ­fico
    if (req.method === 'GET' && req.query.id) {
      const { id } = req.query;

      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'ID invÃ¡lido' });
      }

      const myProfile = await usersCollection.findOne({ supabase_id: user.id });
      if (!myProfile) return res.status(404).json({ error: 'Seu perfil nÃ£o encontrado' });

      const myFriends = myProfile.friends || [];
      if (!myFriends.includes(id) && id !== user.id) {
        return res.status(403).json({ error: 'VocÃª sÃ³ pode ver os detalhes de quem Ã© seu amigo.' });
      }

      const friendProfile = await usersCollection.findOne({ supabase_id: id });
      if (!friendProfile) {
        return res.status(404).json({ error: 'Perfil do amigo nÃ£o encontrado' });
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
    }

    // â”€â”€â”€ GET /api/friends â†’ leaderboard (usuÃ¡rio + amigos ordenados por tempo)
    if (req.method === 'GET') {
      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      if (!userProfile) return res.status(404).json({ error: 'Perfil nÃ£o encontrado' });

      const friendsIds = userProfile.friends || [];
      let allProfiles = [userProfile];

      if (friendsIds.length > 0) {
        const friendsCursor = await usersCollection.find({ supabase_id: { $in: friendsIds } });
        const friendsProfiles = await friendsCursor.toArray();
        allProfiles = [...allProfiles, ...friendsProfiles];
      }

      allProfiles.sort((a, b) => {
        const timeA = a.stats?.total_minutes || 0;
        const timeB = b.stats?.total_minutes || 0;
        return timeB - timeA;
      });

      const leaderboard = allProfiles.map((p, index) => ({
        rank: index + 1,
        id: p.supabase_id,
        name: p.name,
        tag: p.tag,
        avatar_url: p.avatar_url || null,
        isMe: p.supabase_id === user.id,
        total_movies: p.stats?.total_movies || 0,
        total_minutes: p.stats?.total_minutes || 0,
        xp: p.stats?.xp || ((p.stats?.total_movies || 0) * 10),
        level: p.stats?.level || (Math.floor(((p.stats?.total_movies || 0) * 10) / 100) + 1),
      }));

      return res.status(200).json({ success: true, data: leaderboard });
    }

    // â”€â”€â”€ POST /api/friends â†’ adiciona amigo pela Tag
    if (req.method === 'POST') {
      const { tag } = req.body;
      if (!tag) return res.status(400).json({ error: 'Tag Ã© obrigatÃ³ria' });

      const friendProfile = await usersCollection.findOne({ tag: tag.toUpperCase() });
      if (!friendProfile) {
        return res.status(404).json({ error: 'Nenhum usuÃ¡rio encontrado com essa Tag' });
      }

      if (friendProfile.supabase_id === user.id) {
        return res.status(400).json({ error: 'VocÃª nÃ£o pode adicionar a si mesmo' });
      }

      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      const currentFriends = userProfile?.friends || [];

      if (currentFriends.includes(friendProfile.supabase_id)) {
        return res.status(400).json({ error: 'VocÃªs jÃ¡ sÃ£o amigos!' });
      }

      currentFriends.push(friendProfile.supabase_id);
      await usersCollection.updateOne(
        { supabase_id: user.id },
        { $set: { friends: currentFriends } }
      );

      const friendFriends = friendProfile.friends || [];
      if (!friendFriends.includes(user.id)) {
        friendFriends.push(user.id);
        await usersCollection.updateOne(
          { supabase_id: friendProfile.supabase_id },
          { $set: { friends: friendFriends } }
        );
      }

      return res.status(200).json({ success: true, message: 'Amigo adicionado com sucesso!' });
    }

    // â”€â”€â”€ DELETE /api/friends â†’ remove amigo
    if (req.method === 'DELETE') {
      const { friend_id } = req.body;
      if (!friend_id) return res.status(400).json({ error: 'ID do amigo Ã© obrigatÃ³rio' });

      const userProfile = await usersCollection.findOne({ supabase_id: user.id });
      if (!userProfile) return res.status(404).json({ error: 'Perfil nÃ£o encontrado' });

      let currentFriends = userProfile.friends || [];
      if (currentFriends.includes(friend_id)) {
        currentFriends = currentFriends.filter((id: string) => id !== friend_id);
        await usersCollection.updateOne(
          { supabase_id: user.id },
          { $set: { friends: currentFriends } }
        );
      }

      const friendProfile = await usersCollection.findOne({ supabase_id: friend_id });
      if (friendProfile) {
        let friendFriends = friendProfile.friends || [];
        if (friendFriends.includes(user.id)) {
          friendFriends = friendFriends.filter((id: string) => id !== user.id);
          await usersCollection.updateOne(
            { supabase_id: friend_id },
            { $set: { friends: friendFriends } }
          );
        }
      }

      return res.status(200).json({ success: true, message: 'Amigo removido.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /friends:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}


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
    
    // Garante as coleções
    const collections = await db.listCollections();
    if (!collections.some((col: any) => col.name === 'feed')) await db.createCollection('feed');
    if (!collections.some((col: any) => col.name === 'notifications')) await db.createCollection('notifications');

    const feedCollection = db.collection('feed');
    const usersCollection = db.collection('users');
    const notificationsCollection = db.collection('notifications');

    const userProfile = await usersCollection.findOne({ supabase_id: user.id });
    if (!userProfile) return res.status(404).json({ error: 'Perfil não encontrado' });

    if (req.method === 'GET') {
      const tab = req.query.tab as string || 'social';
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = 10;
      
      let query: any = {};
      
      if (tab === 'me') {
        query = { user_id: user.id };
      } else {
        const friendsIds = userProfile.friends || [];
        if (friendsIds.length > 0) {
          query = { user_id: { $in: friendsIds } };
        } else {
          // Sem amigos, retorna array vazio rapidamente
          return res.status(200).json({ success: true, data: [] });
        }
      }

      // AstraDB Data API uses options for sort and limit
      // $skip is supported for pagination, but it's expensive.
      // We will fetch up to limit * page, then slice it in memory since Data API handles small sets fast.
      const cursor = await feedCollection.find(
        query,
        { sort: { created_at: -1 }, limit: page * limit }
      );
      
      let activities = await cursor.toArray();
      // Emulação de skip
      activities = activities.slice((page - 1) * limit, page * limit);
      
      const userIds = [...new Set(activities.map((a: any) => a.user_id))];
      const latestProfiles = await usersCollection.find({ supabase_id: { $in: userIds } }).toArray();
      const avatarMap: Record<string, string> = {};
      latestProfiles.forEach((p: any) => {
        if (p.avatar_url) avatarMap[p.supabase_id] = p.avatar_url;
      });

      const updatedActivities = activities.map((act: any) => ({
        ...act,
        user_avatar: avatarMap[act.user_id] || act.user_avatar || null
      }));

      return res.status(200).json({ success: true, data: updatedActivities });
    }

    if (req.method === 'POST') {
      const { movie, action, rating, review, has_spoiler, badge, challenge_title, challenge_xp } = req.body;
      if (!action) return res.status(400).json({ error: 'action é obrigatório' });

      const newActivity = {
        user_id: user.id,
        user_name: userProfile?.name || 'Usuário',
        user_avatar: userProfile?.avatar_url || null,
        movie_id: movie?.movieId || null,
        movie_title: movie?.title || null,
        movie_poster: movie?.poster_path || null,
        action, 
        rating: rating || null,
        review: review || null,
        has_spoiler: has_spoiler || false,
        badge: badge || null,
        challenge_title: challenge_title || null,
        challenge_xp: challenge_xp || null,
        reactions: [],
        likes: [], // deprecated, mantendo p/ compatibilidade temporária
        created_at: new Date().toISOString()
      };

      const result = await feedCollection.insertOne(newActivity);
      return res.status(200).json({ success: true, data: { _id: result.insertedId, ...newActivity } });
    }

    if (req.method === 'PUT') {
      // Reagir a um post
      const { activity_id, reaction_type } = req.body;
      if (!activity_id || !reaction_type) return res.status(400).json({ error: 'activity_id e reaction_type são obrigatórios' });

      const activity = await feedCollection.findOne({ _id: activity_id });
      if (!activity) return res.status(404).json({ error: 'Atividade não encontrada' });

      let reactions = activity.reactions || [];
      // Se era antigo (likes array), converte
      if (activity.likes && activity.likes.length > 0 && reactions.length === 0) {
        reactions = activity.likes.map((id: string) => ({ user_id: id, type: 'like', created_at: activity.created_at }));
      }

      const existingIndex = reactions.findIndex((r: any) => r.user_id === user.id);
      let isNew = false;

      if (existingIndex > -1) {
        if (reactions[existingIndex].type === reaction_type) {
           reactions.splice(existingIndex, 1);
        } else {
           reactions[existingIndex].type = reaction_type;
           reactions[existingIndex].created_at = new Date().toISOString();
        }
      } else {
         reactions.push({
           user_id: user.id,
           user_name: userProfile?.name || 'Usuário',
           user_avatar: userProfile?.avatar_url || null,
           type: reaction_type,
           created_at: new Date().toISOString()
         });
         isNew = true;
      }

      await feedCollection.updateOne({ _id: activity_id }, { $set: { reactions } });

      // Notificação
      if (isNew && activity.user_id !== user.id) {
         await notificationsCollection.insertOne({
            target_user_id: activity.user_id,
            actor_id: user.id,
            actor_name: userProfile?.name || 'Usuário',
            actor_avatar: userProfile?.avatar_url || null,
            type: 'reaction',
            reaction_type,
            activity_id: activity._id,
            activity_action: activity.action,
            movie_title: activity.movie_title || '',
            created_at: new Date().toISOString(),
            read: false
         });
      }

      return res.status(200).json({ success: true, reactions });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Erro na API /feed:', error);
    return res.status(401).json({ error: error.message || 'Erro interno' });
  }
}

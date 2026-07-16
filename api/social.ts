import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';
import { z } from 'zod';

const createClubSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().optional()
});

const joinClubSchema = z.object({
  joinCode: z.string().length(6)
});


async function sendPushNotification(expoPushToken, title, body) {
  if (!expoPushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
      }),
    });
  } catch (err) {
    console.error('Erro ao enviar push notification:', err);
  }
}

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
    const { route } = req.query; // ?route=clubs ou ?route=swipes

    // =====================================
    // ROTA: SWIPES (MATCH DE FILMES)
    // =====================================
    if (route === 'swipes') {
      const collections = await db.listCollections();
      if (!collections.some((col: any) => col.name === 'movie_swipes')) {
        await db.createCollection('movie_swipes');
      }

      const swipesCollection = db.collection('movie_swipes');

      if (req.method === 'POST') {
        const { friendId, movieId, action } = req.body;
        
        if (!friendId || !movieId || !action) {
          return res.status(400).json({ error: 'friendId, movieId e action são obrigatórios.' });
        }

        const existingSwipe = await swipesCollection.findOne({
          user_id: user.id,
          friend_id: friendId,
          movie_id: movieId
        });

        if (existingSwipe) {
          await swipesCollection.updateOne(
            { _id: existingSwipe._id },
            { $set: { action, updated_at: new Date().toISOString() } }
          );
        } else {
          await swipesCollection.insertOne({
            user_id: user.id,
            friend_id: friendId,
            movie_id: movieId,
            action: action,
            created_at: new Date().toISOString()
          });
        }

        let isMatch = false;

        if (action === 'liked') {
          const friendMatch = await swipesCollection.findOne({
            user_id: friendId,
            friend_id: user.id,
            movie_id: movieId,
            action: 'liked'
          });

          if (friendMatch) {
            isMatch = true;
            // Busca o amigo para enviar push
            const usersCollection = db.collection('users');
            const friendProfile = await usersCollection.findOne({ supabase_id: friendId });
            if (friendProfile && friendProfile.expo_push_token && friendProfile.notifications_enabled !== false) {
              await sendPushNotification(
                friendProfile.expo_push_token,
                '🎬 Novo Match!',
                'Alguém curtiu o mesmo filme que você. Hora de combinar a pipoca!'
              );
            }
          }
        }

        return res.status(200).json({ success: true, isMatch });
      }

      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // =====================================
    // ROTA: CLUBS (GRUPOS PRIVADOS)
    // =====================================
    if (route === 'clubs') {
      const collections = await db.listCollections();
      if (!collections.some((col: any) => col.name === 'clubs')) {
        await db.createCollection('clubs');
      }

      const clubsCollection = db.collection('clubs');

      if (req.method === 'GET') {
        const cursor = await clubsCollection.find({ members: user.id });
        const myClubs = await cursor.toArray();
        return res.status(200).json({ success: true, data: myClubs });
      }

      if (req.method === 'POST') {
        const { action } = req.query;

        if (action === 'join') {
          try {
            const { joinCode } = joinClubSchema.parse(req.body);
            const club = await clubsCollection.findOne({ joinCode: joinCode.toUpperCase() });
            
            if (!club) return res.status(404).json({ error: 'Clube não encontrado ou código inválido.' });
            
            if (club.members.includes(user.id)) {
              return res.status(400).json({ error: 'Você já está neste clube.' });
            }

            club.members.push(user.id);
            await clubsCollection.updateOne({ _id: club._id }, { $set: { members: club.members } });
            
            
            // Envia push para o dono do clube
            const usersCollection = db.collection('users');
            const ownerProfile = await usersCollection.findOne({ supabase_id: club.owner_id });
            const myProfile = await usersCollection.findOne({ supabase_id: user.id });
            if (ownerProfile && ownerProfile.expo_push_token && ownerProfile.notifications_enabled !== false && club.owner_id !== user.id) {
              const memberName = myProfile?.name || 'Um amigo';
              await sendPushNotification(
                ownerProfile.expo_push_token,
                '🍿 Novo membro no Clube',
                `${memberName} entrou no seu clube: ${club.name}!`
              );
            }
            
            return res.status(200).json({ success: true, message: 'Bem-vindo ao clube!', data: club });
          } catch (validationError: any) {
            return res.status(400).json({ error: 'Código inválido', details: validationError.errors });
          }
        } 
        else {
          try {
            const { name, description } = createClubSchema.parse(req.body);
            
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let joinCode = '';
            for (let i = 0; i < 6; i++) {
              joinCode += characters.charAt(Math.floor(Math.random() * characters.length));
            }

            const newClub = {
              name,
              description: description || '',
              owner_id: user.id,
              members: [user.id],
              movie_of_the_week: null,
              joinCode,
              created_at: new Date().toISOString()
            };

            const result = await clubsCollection.insertOne(newClub);
            return res.status(200).json({ success: true, message: 'Clube criado com sucesso!', data: { _id: result.insertedId, ...newClub } });
          } catch (validationError: any) {
            return res.status(400).json({ error: 'Dados inválidos', details: validationError.errors });
          }
        }
      }
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    return res.status(400).json({ error: 'Rota não especificada. Use ?route=swipes ou ?route=clubs' });

  } catch (error: any) {
    console.error('Erro na API /social:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração básica de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Responde imediatamente a requisições de preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. Valida se o usuário tem um token válido do Supabase
    const user = await authenticateUser(req);

    // Verifica se a collection "users" existe, se não, cria ela
    const collections = await db.listCollections();
    const hasUsersCollection = collections.some((col: any) => col.name === 'users');
    if (!hasUsersCollection) {
      await db.createCollection('users');
    }
    
    const usersCollection = db.collection('users');

    if (req.method === 'GET') {
      // 2. Busca o perfil do usuário no Astra DB usando o ID do Supabase
      let userProfile = await usersCollection.findOne({ supabase_id: user.id });

      if (!userProfile) {
        // Gera uma tag alfanumérica única de 10 dígitos
        let userTag = '';
        let isUnique = false;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        
        while (!isUnique) {
          userTag = '';
          for (let i = 0; i < 10; i++) {
            userTag += characters.charAt(Math.floor(Math.random() * characters.length));
          }
          // Verifica se a tag já existe no banco
          const existingTag = await usersCollection.findOne({ tag: userTag });
          if (!existingTag) {
            isUnique = true;
          }
        }

        // Se for o primeiro acesso, cria um perfil base no Astra DB
        const newUser: any = {
          supabase_id: user.id,
          email: user.email,
          name: user.user_metadata?.name || '',
          tag: userTag,
          created_at: new Date().toISOString(),
          stats: {
            total_movies: 0,
            total_minutes: 0
          }
        };

        if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
          newUser.avatar_url = user.user_metadata?.avatar_url || user.user_metadata?.picture;
        }
        await usersCollection.insertOne(newUser);
        userProfile = newUser;
      }

      return res.status(200).json({ success: true, data: userProfile });
    }

    if (req.method === 'PUT') {
      // Exemplo: Atualizar dados do usuário
      const updates = req.body;
      await usersCollection.updateOne(
        { supabase_id: user.id },
        { $set: updates }
      );
      return res.status(200).json({ success: true, message: 'Usuário atualizado com sucesso' });
    }

    if (req.method === 'DELETE') {
      const deleteResult = await usersCollection.deleteOne({ supabase_id: user.id });
      if (deleteResult.deletedCount === 1) {
        return res.status(200).json({ success: true, message: 'Usuário excluído com sucesso' });
      } else {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
    }

    // Método não suportado
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /users:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../utils/supabase';
import { db } from '../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const user = await authenticateUser(req);
    const listsCollection = db.collection('shared_lists');

    const { list_id, movie } = req.body;
    
    if (!list_id || !movie || !movie.movieId) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    // Busca a lista para validar permissões
    const list = await listsCollection.findOne({ _id: list_id });
    
    if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
    
    // Verifica se o usuário é dono ou está nos convidados
    const canEdit = list.owner_id === user.id || (list.shared_with && list.shared_with.includes(user.id));
    if (!canEdit) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta lista' });
    }

    if (req.method === 'PUT') {
      // Adicionar filme
      // Previne duplicação manual (o Astra pode não ter pull nativo direto no Node driver sem script, faremos via array manipulation simples ou push)
      
      const exists = list.movies.some((m: any) => m.movieId === movie.movieId);
      if (!exists) {
        await listsCollection.updateOne(
          { _id: list_id },
          { $push: { movies: { ...movie, addedAt: new Date().toISOString() } } }
        );
      }
      return res.status(200).json({ success: true, message: 'Filme adicionado.' });
      
    } else if (req.method === 'DELETE') {
      // Remover filme
      // No astra-db-ts, possiamo usar $pull
      await listsCollection.updateOne(
        { _id: list_id },
        { $pull: { movies: { movieId: movie.movieId } } }
      );
      return res.status(200).json({ success: true, message: 'Filme removido.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error('Erro na API /list_movies:', error);
    return res.status(401).json({ error: error.message || 'Não autorizado' });
  }
}

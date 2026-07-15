import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../../utils/supabase';
import { db } from '../../utils/astra';
import { GoogleGenAI } from '@google/genai';

// Inicialização será feita no handler para garantir que as vars de ambiente estejam carregadas
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chave da API do Gemini não configurada no servidor.' });
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const user = await authenticateUser(req);
    const usersCollection = db.collection('users');

    const userProfile = await usersCollection.findOne({ supabase_id: user.id });
    if (!userProfile) return res.status(404).json({ error: 'Perfil não encontrado' });

    const watchedMovies = userProfile.watched_movies || [];
    if (watchedMovies.length === 0) {
      return res.status(200).json({ 
        success: true, 
        recommendation: "Você ainda não avaliou nenhum filme. Adicione filmes à sua lista para que eu possa recomendar algo que você vai gostar!" 
      });
    }

    // Pega os 20 últimos filmes assistidos que tenham notas boas (se possível)
    const recentFavorites = watchedMovies
      .filter((m: any) => m.status === 'watched' && m.rating >= 4)
      .slice(0, 10);
      
    let promptText = "O usuário assistiu aos seguintes filmes recentemente e gostou:\n";
    recentFavorites.forEach((m: any) => {
      promptText += `- ${m.title} (Avaliação: ${m.rating}/5)\n`;
    });

    promptText += "\nBaseado nisso, recomende 3 filmes parecidos que ele possa gostar, explicando brevemente o porquê de forma amigável e direta (use até 4 parágrafos no máximo). Não precisa colocar saudações iniciais, apenas comece a recomendar.";

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: promptText,
    });

    const recommendation = response.text || "Desculpe, não consegui pensar em nada no momento.";

    return res.status(200).json({ success: true, recommendation });
  } catch (error: any) {
    console.error('Erro na API /ai/recommend:', error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../../utils/supabase';
import { db } from '../../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
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
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Chave da API do Groq (GROQ_API_KEY) não configurada no servidor.' });
    }
    
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

    // Pega os 10 últimos filmes assistidos que tenham notas boas
    const recentFavorites = watchedMovies
      .filter((m: any) => m.status === 'watched' && m.rating >= 4)
      .slice(0, 10);
      
    let promptText = "O usuário assistiu aos seguintes filmes recentemente e gostou:\n";
    recentFavorites.forEach((m: any) => {
      promptText += `- ${m.title} (Avaliação: ${m.rating}/5)\n`;
    });

    promptText += "\nBaseado nisso, recomende 3 filmes parecidos de forma BEM CURTA e DIRETA. Para cada filme, escreva o título em negrito (**Título**) seguido de apenas uma frase explicando o porquê. Não use introduções, conclusões ou textos extras.";

    // Chamada direta via REST API para o Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Você é um recomendador de filmes extremamente objetivo. Responda apenas com a lista dos 3 filmes e uma frase curta para cada. Sem enrolação.' },
          { role: 'user', content: promptText }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Groq Error:', errorData);
      throw new Error(`Erro na API do Groq: ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    const recommendation = data.choices?.[0]?.message?.content || "Desculpe, não consegui pensar em nada no momento.";

    return res.status(200).json({ success: true, recommendation });
  } catch (error: any) {
    console.error('Erro na API /ai/recommend:', error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}

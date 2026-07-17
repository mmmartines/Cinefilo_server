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
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Chave da API do Groq (GROQ_API_KEY) não configurada.' });
    }
    
    const user = await authenticateUser(req);
    const { action } = req.query; // ?action=recommend ou ?action=chat

    if (action === 'recommend' && req.method === 'GET') {
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

      const recentFavorites = watchedMovies
        .filter((m: any) => m.status === 'watched' && m.rating >= 4)
        .slice(0, 10);
        
      let promptText = "O usuário assistiu aos seguintes filmes recentemente e gostou:\n";
      recentFavorites.forEach((m: any) => {
        promptText += `- ${m.title} (Avaliação: ${m.rating}/5)\n`;
      });

      promptText += "\nBaseado nisso, recomende 3 filmes parecidos de forma BEM CURTA e DIRETA. Para cada filme, escreva o título em negrito (**Título**) seguido de apenas uma frase explicando o porquê. Não use introduções, conclusões ou textos extras.";

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: promptText }],
          temperature: 0.7,
        })
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text();
        throw new Error(`Falha na resposta do Groq: ${groqRes.status} ${errorText}`);
      }
      const groqData = await groqRes.json();
      return res.status(200).json({ success: true, recommendation: groqData.choices[0].message.content });
    }

    if (action === 'chat' && req.method === 'POST') {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages não enviadas corretamente' });
      }

      const systemPrompt = {
        role: 'system',
        content: 'Você é a Cinemateca, uma assistente virtual especializada em cinema da plataforma Cinelândia. Responda de forma curta, engajante e em pt-BR. Seu objetivo é indicar filmes, discutir cinema, atores e diretores. Mantenha as respostas objetivas.'
      };

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [systemPrompt, ...messages],
          temperature: 0.7,
        })
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text();
        throw new Error(`Falha na resposta do Groq: ${groqRes.status} ${errorText}`);
      }
      const groqData = await groqRes.json();
      return res.status(200).json({ success: true, message: groqData.choices[0].message.content });
    }

    return res.status(400).json({ error: 'Ação inválida.' });

  } catch (error: any) {
    console.error('Erro na API AI:', error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}

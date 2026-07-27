import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../utils/astra';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { nickname } = req.query;

  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'Nickname parameter is required' });
  }
  
  nickname = nickname.toLowerCase().trim();

  try {
    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ nickname });

    // Se existingUser não for nulo, significa que já está em uso (available: false)
    return res.status(200).json({ success: true, available: !existingUser });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

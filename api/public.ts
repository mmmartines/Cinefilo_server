import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../utils/astra';

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

  const { action } = req.query;

  try {
    const usersCollection = db.collection('users');

    if (action === 'check-nickname') {
      let { nickname } = req.query;
      if (!nickname || typeof nickname !== 'string') {
        return res.status(400).json({ error: 'Nickname parameter is required' });
      }
      nickname = nickname.toLowerCase().trim();
      const existingUser = await usersCollection.findOne({ nickname });
      return res.status(200).json({ success: true, available: !existingUser });
    }

    if (action === 'suggest-nickname') {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Name parameter is required' });
      }
      const baseName = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let suggestedNickname = baseName;
      let counter = 1;
      let isAvailable = false;
      while (!isAvailable) {
        const existing = await usersCollection.findOne({ nickname: suggestedNickname });
        if (!existing) {
          isAvailable = true;
        } else {
          suggestedNickname =  + "${baseName}" + @";
          counter++;
          if (counter > 10) {
            suggestedNickname =  + "${baseName}" + @";
            isAvailable = true; 
          }
        }
      }
      return res.status(200).json({ success: true, nickname: suggestedNickname });
    }

    if (action === 'check-provider') {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }
      const user = await usersCollection.findOne({ email });
      if (user) {
        return res.status(200).json({ provider: user.provider || 'email' });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

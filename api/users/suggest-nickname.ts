import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../utils/astra';

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
}

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

  const { name } = req.query;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name parameter is required' });
  }

  try {
    const usersCollection = db.collection('users');
    const suggestions: string[] = [];
    const parts = name.split(' ').map(n => normalizeName(n)).filter(n => n.length > 0);
    
    let baseName = parts.length > 0 ? parts[0] : 'user';
    let lastName = parts.length > 1 ? parts[parts.length - 1] : '';

    const candidates = [
      `${baseName}${lastName}`,
      `${baseName}.${lastName}`,
      `${baseName}${Math.floor(Math.random() * 1000)}`,
      `${baseName}_${lastName}`,
      `${baseName}${new Date().getFullYear()}`,
      `cine${baseName}`,
    ].filter(c => c.length > 2); // Avoid very short candidates like "."

    // Generate unique candidates
    for (const candidate of candidates) {
      if (suggestions.length >= 3) break;
      const cleanCandidate = candidate.replace(/[^a-z0-9._]/g, '').toLowerCase(); // Only allow valid chars
      if (!cleanCandidate) continue;
      
      const existingUser = await usersCollection.findOne({ nickname: cleanCandidate });
      if (!existingUser && !suggestions.includes(cleanCandidate)) {
        suggestions.push(cleanCandidate);
      }
    }
    
    // If we couldn't find 3, generate random numbers
    let attempt = 0;
    while (suggestions.length < 3 && attempt < 10) {
      const cleanCandidate = `${baseName}${Math.floor(Math.random() * 9999)}`;
      const existingUser = await usersCollection.findOne({ nickname: cleanCandidate });
      if (!existingUser && !suggestions.includes(cleanCandidate)) {
        suggestions.push(cleanCandidate);
      }
      attempt++;
    }

    return res.status(200).json({ success: true, suggestions });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

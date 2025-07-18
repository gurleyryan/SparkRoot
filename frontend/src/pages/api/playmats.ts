import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const publicDir = path.join(process.cwd(), 'public');
  const files = fs.readdirSync(publicDir);
  const playmatFiles = files.filter(f => f.startsWith('playmat-texture') && (f.endsWith('.svg') || f.endsWith('.png') || f.endsWith('.jpg')));
  res.status(200).json({ success: true, files: playmatFiles });
}

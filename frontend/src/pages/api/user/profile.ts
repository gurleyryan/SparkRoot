import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get user id from Bearer token (assume JWT in Authorization header)
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.replace('Bearer ', '');
  const { data: user, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.user?.id) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const userId = user.user.id;

  // Fetch profile info for this user
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url, created_at, updated_at')
      .eq('user_id', userId)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

import { supabase } from '../../config/db.js';

export async function getUsers(req, res) {
  try {
    const { data, error } = await supabase.from('users').select('id_user, email, role');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


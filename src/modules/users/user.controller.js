import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getUsers(req, res) {
  try {
    const { data, error } = await supabase.from('users_coba').select('id, username, role');
    if (error) throw error;

    logger.info(`User list requested by user: ${req.user.id}`)
    res.json(data);
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`)
    res.status(500).json({ error: error.message });
  }
}


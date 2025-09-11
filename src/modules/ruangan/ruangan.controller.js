import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'
import { nanoid } from 'nanoid';

export async function getRuangan(req, res) {
  try {
    const { data, error } = await supabase.from('ruangan').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function registerRuangan(req, res) {
  try {
    const { nama_ruangan } = req.body

    const id_ruangan = nanoid();

    if (!nama_ruangan) {
      return res.status(400).json({ message: "Nama ruangan wajib diisi" })
    }

    const { data, error } = await supabase
      .from("ruangan")
      .insert([{ id_ruangan, nama_ruangan }])
      .select()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    res.status(201).json({
      message: "Ruangan berhasil didaftarkan"
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}




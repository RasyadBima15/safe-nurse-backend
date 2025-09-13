import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getPerawat(req, res) {
  try {
    const { data, error } = await supabase.from('perawat').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updatePerawat(req, res) {
  try {
    const { id_user } = req.params;
    const { nama_perawat } = req.body;

    if (!id_user || !nama_perawat ) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_perawat };

    const { data, error } = await supabase
      .from("perawat")
      .update(updatedFields)
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Perawat tidak ditemukan" });
    }

    res.status(200).json({
      message: "Perawat berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}









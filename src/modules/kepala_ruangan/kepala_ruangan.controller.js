import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getKepalaRuangan(req, res) {
  try {
    const { data, error } = await supabase.from('kepala_ruangan').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateKepalaRuangan(req, res) {
  try {
    const { id_user } = req.params;
    const { nama_kepala_ruangan, jabatan, no_telp } = req.body;

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!nama_kepala_ruangan || !jabatan || !no_telp) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_kepala_ruangan, jabatan, no_telp };

    const { data, error } = await supabase
      .from("kepala_ruangan")
      .update(updatedFields)
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Kepala Ruangan tidak ditemukan" });
    }

    res.status(200).json({
      message: "Kepala Ruangan berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






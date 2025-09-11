import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getVerifikator(req, res) {
  try {
    const { data, error } = await supabase.from('verifikator').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateVerifikator(req, res) {
  try {
    const { id_user, nama_verifikator, jabatan, unit_kerja, no_telp } = req.body;

    if (!id_user || !nama_verifikator || !jabatan || !unit_kerja || !no_telp) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const { data, error } = await supabase
      .from("verifikator")
      .update({ nama_verifikator, jabatan, unit_kerja, no_telp })
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Verifikator tidak ditemukan" });
    }

    res.status(200).json({
      message: "Verifikator berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






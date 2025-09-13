import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getChiefNursing(req, res) {
  try {
    const { data, error } = await supabase.from('chief_nursing').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateChiefNursing(req, res) {
  try {
    const { id_user, nama_chief_nursing, jabatan, no_telp } = req.body;

    if (!id_user || !nama_chief_nursing || !jabatan || !no_telp ) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_chief_nursing, jabatan, no_telp };

    const { data, error } = await supabase
      .from("chief_nursing")
      .update(updatedFields)
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Chief Nursing tidak ditemukan" });
    }

    res.status(200).json({
      message: "Chief Nurse berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






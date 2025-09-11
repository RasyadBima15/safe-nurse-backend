import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getIpcn(req, res) {
  try {
    const { data, error } = await supabase.from('ipcn').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateIpcn(req, res) {
  try {
    const { id_user, nama_ipcn, jabatan, no_telp } = req.body;

    if (!id_user || !nama_ipcn || !jabatan || !no_telp ) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_ipcn, jabatan, no_telp };

    const { data, error } = await supabase
      .from("ipcn")
      .update(updatedFields)
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "IPCN tidak ditemukan" });
    }

    res.status(200).json({
      message: "IPCN berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






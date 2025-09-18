import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js';
import { nanoid } from 'nanoid';

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
    const { nama_verifikator, jabatan, unit_kerja, no_telp } = req.body;
    const id_user = req.user?.id_user;

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!nama_verifikator || !jabatan || !unit_kerja || !no_telp) {
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

    // ✅ Kirim notifikasi ke dirinya sendiri
    if (id_user) {
      const selfNotif = {
        id_notifikasi: nanoid(),
        id_user: id_user,
        message: `Anda berhasil memperbarui data anda`,
      };

      const { error: notifError } = await supabase
        .from("notifikasi")
        .insert([selfNotif]);

      if (notifError) {
        console.error("Gagal insert notifikasi ke dirinya sendiri:", notifError.message);
      }
    }

    res.status(200).json({
      message: "Verifikator berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}







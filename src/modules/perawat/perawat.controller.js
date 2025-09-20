import { supabase } from '../../config/db.js';
import { nanoid } from 'nanoid';

export async function getPerawat(req, res) {
  try {
    const { data, error } = await supabase.from('perawat').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPerawatbyIdPerawat(req, res) {
  try {
    const { id_perawat } = req.params;

    if (!id_perawat) {
      return res.status(400).json({ error: "Id Perawat wajib diisi" });
    }

    const { data, error } = await supabase
      .from("perawat")
      .select(`
        *,
        ruangan(nama_ruangan)
        `)
      .eq("id_perawat", id_perawat)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function updatePerawat(req, res) {
  try {
    const { nama_perawat } = req.body;
    const id_user = req.user?.id_user;

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!nama_perawat) {
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

    // ✅ Kirim notifikasi ke dirinya sendiri
    if (id_user) {
      const selfNotif = {
        id_notifikasi: nanoid(),
        id_user: id_user,
        message: `Anda berhasil memperbarui data anda.`,
      };

      const { error: notifError } = await supabase
        .from("notifikasi")
        .insert([selfNotif]);

      if (notifError) {
        console.error("Gagal insert notifikasi ke dirinya sendiri:", notifError.message);
      }
    }

    res.status(200).json({
      message: "Perawat berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}










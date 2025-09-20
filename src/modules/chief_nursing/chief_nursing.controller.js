import { supabase } from '../../config/db.js';
import { nanoid } from 'nanoid';

export async function getChiefNursing(req, res) {
  try {
    const { data, error } = await supabase.from('chief_nursing').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChiefNursingById(req, res) {
  try {
    const { id_chief_nursing } = req.params;

    if (!id_chief_nursing) {
      return res.status(400).json({ error: "Id chief nursing wajib diisi" });
    }

    const { data, error } = await supabase
      .from("chief_nursing")
      .select(`
        *
        `)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateChiefNursing(req, res) {
  try {
    const { nama_chief_nursing, jabatan, no_telp } = req.body;
    const id_user = req.user?.id_user; // user yang login sekarang

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!nama_chief_nursing || !jabatan || !no_telp) {
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
      message: "Chief Nursing berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}







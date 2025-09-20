import { supabase } from '../../config/db.js';
import { nanoid } from 'nanoid';

export async function getAdmin(req, res) {
  try {
    const { data, error } = await supabase.from('super_admin').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateAdmin(req, res) {
  try {
    const { email } = req.body;
    const id_user = req.user?.id_user; // user yang sedang login

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!email) {
      return res.status(400).json({ message: "Tidak ada field yang diupdate" });
    }

    const { data: adminData, error: adminError } = await supabase
      .from("super_admin")
      .select("id_user")
      .eq("id_user", id_user);

    if (adminError) {
      return res.status(500).json({ message: adminError.message });
    }

    if (!adminData || adminData.length === 0) {
      return res.status(404).json({ message: "Super Admin tidak ditemukan" });
    }

    const { error: userError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user)
      .select();

    if (userError) {
      return res.status(500).json({ message: "Gagal update email user: " + userError.message });
    }

    // ✅ Kirim notifikasi ke dirinya sendiri
    if (id_user) {
      const selfNotif = {
        id_notifikasi: nanoid(),
        id_user: id_user,
        message: `Anda berhasil memperbarui email anda`,
      };

      const { error: notifError } = await supabase
        .from("notifikasi")
        .insert([selfNotif]);

      if (notifError) {
        console.error("Gagal insert notifikasi ke dirinya sendiri:", notifError.message);
      }
    }

    res.status(200).json({
      message: "Super Admin berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}





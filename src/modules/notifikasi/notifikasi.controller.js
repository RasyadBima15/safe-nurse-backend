import { supabase } from '../../config/db.js';

export async function getNotifikasi(req, res) {
  try {
    const { id_user } = req.query;
    if (!id_user) {
      return res.status(400).json({ message: "ID User wajib diisi" });
    }

    const { data, error } = await supabase
      .from("notifikasi")
      .select("id_notifikasi, message, status, created_at")
      .eq("id_user", id_user)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }

    const notifikasiBaru = data.filter(n => n.status === "belum_dibaca");
    const notifikasiLama = data.filter(n => n.status === "sudah_dibaca");

    if (notifikasiBaru.length > 0) {
      const ids = notifikasiBaru.map(n => n.id_notifikasi);
      const { error: updateError } = await supabase
        .from("notifikasi")
        .update({ status: "sudah_dibaca" })
        .in("id_notifikasi", ids);

      if (updateError) throw updateError;
    }

    res.json({
      notifikasi_baru: notifikasiBaru,
      notifikasi_lama: notifikasiLama,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getNewNotifikasi(req, res) {
  try {
    const { id_user } = req.query;
    if (!id_user) {
      return res.status(400).json({ message: "ID User wajib diisi" });
    }

    const { data, error } = await supabase
      .from("notifikasi")
      .select("id_notifikasi, message, status, created_at")
      .eq("id_user", id_user)
      .eq("status", "belum_dibaca")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

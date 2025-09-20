import { supabase } from '../../config/db.js';
import { nanoid } from 'nanoid';
import { timeAgo } from '../../utils/time.js';

export async function getNotifikasi(req, res) {
  try {
    const { id_user } = req.user;
    if (!id_user) {
      return res.status(400).json({ message: "ID User wajib diisi" });
    }

    const { data, error } = await supabase
      .from("notifikasi")
      .select("id_notifikasi, message, status, created_at")
      .eq("id_user", id_user)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }

    // Tambahkan waktu relatif
    const formatted = data.map((n) => ({
      ...n,
      waktu: timeAgo(n.created_at),
    }));

    const notifikasiBaru = formatted.filter((n) => n.status === "belum_dibaca");
    const notifikasiLama = formatted.filter((n) => n.status === "sudah_dibaca");

    if (notifikasiBaru.length > 0) {
      const ids = notifikasiBaru.map((n) => n.id_notifikasi);
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
    const { id_user } = req.user;
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
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }

    // ubah created_at ke format waktu relatif
    const formatted = data.map((n) => ({
      ...n,
      waktu: timeAgo(n.created_at),
    }));

    res.json({
      message: "Data notifikasi berhasil diambil.",
      data: formatted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createNotifikasi(req, res) {
  try {
    const { message, roles } = req.body;
    if (!message || !roles || roles.length === 0) {
      return res.status(400).json({ message: "Message dan roles wajib diisi" });
    }
    let id_users = [];
    if (roles.includes("all")) {
      const { data, error } = await supabase.from("users").select("id_user");
      if (error) throw error;
      id_users = data.map(user => user.id_user);
    } else {
      const { data, error } = await supabase
        .from("users")
        .select("id_user")
        .in("role", roles);
      if (error) throw error;
      id_users = data.map(user => user.id_user);
    }
    if (id_users.length === 0) {
      return res.status(404).json({ message: "Tidak ada user yang ditemukan untuk role tersebut" });
    }

    const { error: insertError } = await supabase
      .from("notifikasi")
      .insert(
        id_users.map(id_user => ({
          id_notifikasi: nanoid(),
          id_user,
          message,
        }))
      );
    if (insertError) throw insertError;

    res.status(201).json({ message: "Notifikasi berhasil dikirim" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

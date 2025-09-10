import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getPerawat(req, res) {
  try {
    const { data, error } = await supabase.from('perawat').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function registerPerawat(req, res) {
  try {
    const { id_user, nama_perawat, email, id_ruangan } = req.body;

    if (!id_user || !nama_perawat || !email || !id_ruangan) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const { data: userData, error: userCheckError } = await supabase
      .from("users")
      .select("id_user, role")
      .eq("id_user", id_user)
      .maybeSingle();

    if (userCheckError) {
      return res.status(500).json({ message: "Gagal cek user: " + userCheckError.message });
    }

    if (!userData) {
      return res.status(404).json({ message: "User dengan id_user tersebut tidak ditemukan" });
    }

    if (userData.role !== "perawat") {
      return res.status(403).json({ message: "User bukan perawat" });
    }

    const newPerawat = { id_user, nama_perawat, id_ruangan };

    const { data, error } = await supabase
      .from("perawat")
      .insert([newPerawat])
      .select()

    if (error) {
      return res.status(500).json({ message: "Gagal tambah perawat: " + error.message })
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user);

    if (updateError) {
      return res.status(500).json({ message: "Gagal update email user: " + updateError.message });
    }

    res.status(201).json({
      message: "Perawat berhasil didaftarkan"
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export async function updatePerawat(req, res) {
  try {
    const { id_user, nama_perawat, email, id_ruangan } = req.body;

    if (!id_user || !nama_perawat || !email || !id_ruangan) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_perawat, id_ruangan };

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

    const { data: userData, error: userError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user)
      .select();

    if (userError) {
      return res.status(500).json({ message: "Gagal update email user: " + userError.message });
    }

    res.status(200).json({
      message: "Perawat berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}









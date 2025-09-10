import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getAdmin(req, res) {
  try {
    const { data, error } = await supabase.from('super_admin').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function registerAdmin(req, res) {
  try {
    const { id_user, email } = req.body;

    if (!id_user || !email) {
      return res.status(400).json({ message: "id_user dan email wajib diisi" });
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

    if (userData.role !== "super_admin") {
      return res.status(403).json({ message: "User bukan super_admin" });
    }

    const { error: adminError } = await supabase
      .from("super_admin")
      .insert([{ id_user }]);

    if (adminError) {
      return res.status(500).json({ message: "Gagal tambah super_admin: " + adminError.message });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user);

    if (updateError) {
      return res.status(500).json({ message: "Gagal update email user: " + updateError.message });
    }

    res.status(201).json({
      message: "Super Admin berhasil didaftarkan"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function updateAdmin(req, res) {
  try {
    const { id_user, email } = req.body;

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

    res.status(200).json({
      message: "Super Admin berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}





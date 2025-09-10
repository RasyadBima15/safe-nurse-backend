import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'

export async function getVerifikator(req, res) {
  try {
    const { data, error } = await supabase.from('verifikator').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function registerVerifikator(req, res) {
  try {
    const { id_user, nama_verifikator, email, jabatan, unit_kerja, no_telp } = req.body;

    if (!id_user || !nama_verifikator || !email || !jabatan || !unit_kerja || !no_telp) {
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
    if (userData.role !== "verifikator") {
      return res.status(403).json({ message: "User bukan verifikator" });
    }

    const newVerifikator = { id_user, nama_verifikator, jabatan, unit_kerja, no_telp };

    const { data, error } = await supabase
      .from("verifikator")
      .insert([newVerifikator])
      .select()

    if (error) {
      return res.status(500).json({ message: "Gagal tambah verifikator: " + error.message })
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user);
    if (updateError) {
      return res.status(500).json({ message: "Gagal update email user: " + updateError.message });
    }

    res.status(201).json({
      message: "Verifikator berhasil didaftarkan"
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export async function updateVerifikator(req, res) {
  try {
    const { id_user, nama_verifikator, email, jabatan, unit_kerja, no_telp } = req.body;

    if (!id_user || !nama_verifikator || !email || !jabatan || !unit_kerja || !no_telp) {
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

    const { data: userData, error: userError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user)
      .select();

    if (userError) {
      return res.status(500).json({ message: "Gagal update email user: " + userError.message });
    }

    res.status(200).json({
      message: "Verifikator berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






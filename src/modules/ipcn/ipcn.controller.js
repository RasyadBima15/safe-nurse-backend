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

export async function registerIpcn(req, res) {
  try {
    const { id_user, nama_ipcn, email, jabatan, no_telp, id_ruangan } = req.body;

    if (!id_user || !nama_ipcn || !email || !jabatan || !no_telp || !id_ruangan) {
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

    if (userData.role !== "ipcn") {
      return res.status(403).json({ message: "User bukan ipcn" });
    }

    const newIpcn = { id_user, nama_ipcn, jabatan, no_telp, id_ruangan };

    const { data, error } = await supabase
      .from("ipcn")
      .insert([newIpcn])
      .select()

    if (error) {
      return res.status(500).json({ message: "Gagal tambah ipcn: " +  error.message })
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user);

    if (updateError) {
      return res.status(500).json({ message: "Gagal update email user: " + updateError.message });
    }

    res.status(201).json({
      message: "IPCN berhasil didaftarkan"
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export async function updateIpcn(req, res) {
  try {
    const { id_user, nama_ipcn, email, jabatan, no_telp, id_ruangan } = req.body;

    if (!id_user || !nama_ipcn || !email || !jabatan || !no_telp || !id_ruangan) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_ipcn, jabatan, no_telp, id_ruangan };

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

    const { error: userError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user)
      .select();

    if (userError) {
      return res.status(500).json({ message: "Gagal update email user: " + userError.message });
    }

    res.status(200).json({
      message: "IPCN berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






import { supabase } from '../../config/db.js';
import { nanoid } from 'nanoid';

export async function getKepalaRuangan(req, res) {
  try {
    const { data, error } = await supabase.from('kepala_ruangan').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getKepalaRuanganById(req, res) {
  try {
    const { id_kepala_ruangan } = req.params;

    if (!id_kepala_ruangan) {
      return res.status(400).json({ error: "Id kepala ruangan wajib diisi" });
    }

    // 1. Ambil data kepala ruangan + user
    const { data: kepala, error: kepalaError } = await supabase
      .from("kepala_ruangan")
      .select(`
        id_kepala_ruangan,
        nama_kepala_ruangan,
        jabatan,
        no_telp,
        users(email)
      `)
      .eq("id_kepala_ruangan", id_kepala_ruangan)
      .maybeSingle();

    if (kepalaError || !kepala) {
      return res.status(404).json({ error: "Kepala ruangan tidak ditemukan" });
    }

    // 2. Ambil semua ruangan yang ditangani
    const { data: ruangan, error: ruanganError } = await supabase
      .from("ruangan")
      .select("id_ruangan, nama_ruangan")
      .eq("id_kepala_ruangan", id_kepala_ruangan);

    if (ruanganError) throw ruanganError;

    return res.json({
      ...kepala,
      ruangan: ruangan || []
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}


export async function updateKepalaRuangan(req, res) {
  try {
    const { nama_kepala_ruangan, jabatan, no_telp } = req.body;
    const id_user = req.user?.id_user;

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!nama_kepala_ruangan || !jabatan || !no_telp) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const updatedFields = { nama_kepala_ruangan, jabatan, no_telp };

    const { data, error } = await supabase
      .from("kepala_ruangan")
      .update(updatedFields)
      .eq("id_user", id_user)
      .select();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Kepala Ruangan tidak ditemukan" });
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
      message: "Kepala Ruangan berhasil diperbarui"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}






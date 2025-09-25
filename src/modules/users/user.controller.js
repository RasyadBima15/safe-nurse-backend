import { supabase } from '../../config/db.js';

export async function getUsers(req, res) {
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id_user, email, role');

    if (usersError) throw usersError;

    const result = await Promise.all(users.map(async user => {
      let nama = "-";
      let nama_ruangan = "-";

      if (user.role === "perawat") {
        const { data: p } = await supabase
          .from('perawat')
          .select('nama_perawat, id_ruangan')
          .eq('id_user', user.id_user)
          .single();
        nama = p?.nama_perawat || "-";

        if (p?.id_ruangan) {
          const { data: r } = await supabase
            .from('ruangan')
            .select('nama_ruangan')
            .eq('id_ruangan', p.id_ruangan)
            .single();
          nama_ruangan = r?.nama_ruangan || "-";
        }
      } else if (user.role === "kepala_ruangan") {
        const { data: k } = await supabase
          .from('kepala_ruangan')
          .select('nama_kepala_ruangan, id_ruangan')
          .eq('id_user', user.id_user)
          .single();
        nama = k?.nama_kepala_ruangan || "-";

        if (k?.id_ruangan) {
          const { data: r } = await supabase
            .from('ruangan')
            .select('nama_ruangan')
            .eq('id_ruangan', k.id_ruangan)
            .single();
          nama_ruangan = r?.nama_ruangan || "-";
        }
      } else if (user.role === "chief_nursing") {
        const { data: c } = await supabase
          .from('chief_nursing')
          .select('nama_chief_nursing')
          .eq('id_user', user.id_user)
          .single();
        nama = c?.nama_chief_nursing || "-";
      } else if (user.role === "verifikator") {
        const { data: v } = await supabase
          .from('verifikator')
          .select('nama_verifikator')
          .eq('id_user', user.id_user)
          .single();
        nama = v?.nama_verifikator || "-";
      }

      return {
        id_user: user.id_user,
        email: user.email,
        role: user.role,
        nama,
        nama_ruangan
      };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}



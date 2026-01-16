import { supabase } from '../../config/db.js';

export async function getUsers(req, res) {
  try {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id_user, email, role");

    if (usersError) throw usersError;

    const result = await Promise.all(
      users.map(async (user) => {
        let nama = "-";
        let id_ruangan = null;
        let nama_ruangan = "-";
        let jabatan = "-";
        let no_telp = "-";
        let unit_kerja = "-";

        // === PERAWAT ===
        if (user.role === "perawat") {
          const { data: p } = await supabase
            .from("perawat")
            .select("nama_perawat, id_ruangan")
            .eq("id_user", user.id_user)
            .single();

          nama = p?.nama_perawat || "-";
          id_ruangan = p?.id_ruangan || null;

          if (id_ruangan) {
            const { data: r } = await supabase
              .from("ruangan")
              .select("nama_ruangan")
              .eq("id_ruangan", id_ruangan)
              .single();
            nama_ruangan = r?.nama_ruangan || "-";
          }

          return {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            nama,
            id_ruangan,
            nama_ruangan,
          };
        }

        if (user.role === "kepala_ruangan") {
          // 1. Ambil data kepala ruangan
          const { data: k, error: kepalaError } = await supabase
            .from("kepala_ruangan")
            .select("id_kepala_ruangan, nama_kepala_ruangan, jabatan, no_telp")
            .eq("id_user", user.id_user)
            .maybeSingle();

          if (kepalaError || !k) {
            return null; // atau throw error sesuai kebutuhan
          }

          // 2. Ambil semua ruangan yang ditangani
          const { data: ruanganList } = await supabase
            .from("ruangan")
            .select("id_ruangan, nama_ruangan")
            .eq("id_kepala_ruangan", k.id_kepala_ruangan);

          return {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            nama: k.nama_kepala_ruangan || "-",
            ruangan: ruanganList || [], // ARRAY
            jabatan: k.jabatan || "-",
            no_telp: k.no_telp || "-"
          };
        }

        // === CHIEF NURSING (tanpa ruangan) ===
        if (user.role === "chief_nursing") {
          const { data: c } = await supabase
            .from("chief_nursing")
            .select("nama_chief_nursing, jabatan, no_telp")
            .eq("id_user", user.id_user)
            .single();

          nama = c?.nama_chief_nursing || "-";
          jabatan = c?.jabatan || "-";
          no_telp = c?.no_telp || "-";

          return {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            nama,
            jabatan,
            no_telp,
          };
        }

        // === VERIFIKATOR ===
        if (user.role === "verifikator") {
          const { data: v } = await supabase
            .from("verifikator")
            .select("nama_verifikator, unit_kerja, jabatan, no_telp")
            .eq("id_user", user.id_user)
            .single();

          nama = v?.nama_verifikator || "-";
          unit_kerja = v?.unit_kerja || "-";
          jabatan = v?.jabatan || "-";
          no_telp = v?.no_telp || "-";

          return {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            nama,
            unit_kerja,
            jabatan,
            no_telp,
          };
        }

        // === SUPER ADMIN ===
        if (user.role === "super_admin") {
          const { data: s } = await supabase
            .from("super_admin")
            .select("nama_super_admin")
            .eq("id_user", user.id_user)
            .single();

          nama = s?.nama_super_admin || "-";

          return {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            nama,
          };
        }

        // fallback
        return user;
      })
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateUser(req, res) {
  try {
    const { id_user } = req.params;
    const { nama, email, id_ruangan, role, jabatan, unit_kerja, no_telp } = req.body;

    if (!id_user || !nama || !email || !role) {
      return res.status(400).json({ error: "id_user, nama, email, dan role wajib diisi" });
    }

    const validRoles = ["perawat", "kepala_ruangan", "chief_nursing", "verifikator", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role tidak valid" });
    }

    // 🔎 Validasi khusus role
    if (role === "perawat" && !id_ruangan) {
      return res.status(400).json({ error: "id_ruangan wajib diisi untuk role perawat" });
    }

    if (role === "kepala_ruangan") {
      if (!id_ruangan) return res.status(400).json({ error: "id_ruangan wajib diisi untuk role kepala_ruangan" });
      if (!jabatan) return res.status(400).json({ error: "jabatan wajib diisi untuk role kepala_ruangan" });
      if (!no_telp) return res.status(400).json({ error: "no_telp wajib diisi untuk role kepala_ruangan" });
    }

    if (role === "chief_nursing") {
      if (!jabatan) return res.status(400).json({ error: "jabatan wajib diisi untuk role chief_nursing" });
      if (!no_telp) return res.status(400).json({ error: "no_telp wajib diisi untuk role chief_nursing" });
    }

    if (role === "verifikator") {
      if (!jabatan) return res.status(400).json({ error: "jabatan wajib diisi untuk role verifikator" });
      if (!unit_kerja) return res.status(400).json({ error: "unit_kerja wajib diisi untuk role verifikator" });
      if (!no_telp) return res.status(400).json({ error: "no_telp wajib diisi untuk role verifikator" });
    }

    // 🔄 Update email di users
    const { error: userError } = await supabase
      .from("users")
      .update({ email })
      .eq("id_user", id_user);
    if (userError) throw userError;

    // 🔄 Update tabel sesuai role
    if (role === "perawat") {
      const { error } = await supabase
        .from("perawat")
        .update({ nama_perawat: nama, id_ruangan })
        .eq("id_user", id_user);
      if (error) throw error;

    } else if (role === "kepala_ruangan") {
      const { data: profile, error: fetchError } = await supabase
        .from("kepala_ruangan")
        .select("id_kepala_ruangan")
        .eq("id_user", id_user)
        .single();

      if (fetchError || !profile) {
        throw new Error("Profil Kepala Ruangan tidak ditemukan");
      }

      const idKR = profile.id_kepala_ruangan;

      const { error: krError } = await supabase
        .from("kepala_ruangan")
        .update({ 
          nama_kepala_ruangan: nama, 
          jabatan, 
          no_telp 
        })
        .eq("id_user", id_user);

      if (krError) throw krError;

      const { error: resetError } = await supabase
        .from("ruangan")
        .update({ id_kepala_ruangan: null })
        .eq("id_kepala_ruangan", idKR);

      if (resetError) throw resetError;

      const ruanganIds = Array.isArray(id_ruangan) ? id_ruangan : [id_ruangan];
      
      if (ruanganIds.length > 0) {
        const { error: roomUpdateError } = await supabase
          .from("ruangan")
          .update({ id_kepala_ruangan: idKR })
          .in("id_ruangan", ruanganIds);

        if (roomUpdateError) throw roomUpdateError;
      }
    } else if (role === "chief_nursing") {
      const { error } = await supabase
        .from("chief_nursing")
        .update({ nama_chief_nursing: nama, jabatan, no_telp })
        .eq("id_user", id_user);
      if (error) throw error;

    } else if (role === "verifikator") {
      const { error } = await supabase
        .from("verifikator")
        .update({ nama_verifikator: nama, jabatan, unit_kerja, no_telp })
        .eq("id_user", id_user);
      if (error) throw error;

    } else if (role === "super_admin") {
      const { error } = await supabase
        .from("super_admin")
        .update({ nama_super_admin: nama })
        .eq("id_user", id_user);
      if (error) throw error;
    }

    res.json({ message: "Update berhasil" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id_user } = req.params;

    if (!id_user) {
      return res.status(400).json({ error: "id_user wajib diisi" });
    }

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id_user", id_user);

    if (error) throw error;

    res.json({ message: "User berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}




import { supabase } from '../../config/db.js';
import { generateKodeLaporan } from '../../utils/generateKodeLaporan.js';
import { hitungSkor } from '../../utils/scoring.js';
import { requiredFieldsForConfirmation, requiredFieldsForAI } from '../../utils/requiredFields.js';
import { callOpenAIAPI, validateChronologyAPI } from '../../config/openAI.js';
import { nanoid } from 'nanoid'; 
import { parseTanggal, parseTanggalDateOnly } from '../../utils/parseTanggal.js';
import { emailTemplates, transporter } from '../../config/email.js';

export async function getLaporanByIdLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { id_user, role } = req.user;

    // 1. Ambil data laporan utama
    const { data: laporan, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(nama_perawat),
        ruangan:id_ruangan(nama_ruangan)
      `)
      .eq("kode_laporan", kode_laporan)
      .maybeSingle();

    if (!laporan) {
      return res.status(404).json({ message: "Laporan tidak ada" });
    }
    if (laporanError) throw new Error(laporanError.message);

    // 2. Ambil history aksi user ini
    const { data: historyAksi, error: aksiError } = await supabase
      .from("history_aksi")
      .select("id_aksi, aksi, kategori, grading, kronologi, hasil, implementasi, rencana_tindak_lanjut, created_at")
      .eq("kode_laporan", kode_laporan)
      .eq("id_user", id_user)
      .order("created_at", { ascending: false })
      .limit(3);

    if (aksiError) throw new Error(aksiError.message);

    // 3. Ambil history catatan user ini
    const { data: historyCatatan, error: catatanError } = await supabase
      .from("history_catatan")
      .select("id_catatan, catatan, created_at")
      .eq("kode_laporan", kode_laporan)
      .eq("id_user", id_user)
      .order("created_at", { ascending: false })
      .limit(3);

    if (catatanError) throw new Error(catatanError.message);

    // 4. Ambil semua history aksi + role user
    const { data: allHistoryAksi } = await supabase
      .from("history_aksi")
      .select("kategori, grading, kronologi, implementasi, id_user, hasil, rencana_tindak_lanjut, created_at, users(role)")
      .eq("kode_laporan", kode_laporan)
      .order("created_at", { ascending: false });

    const { data: allHistoryCatatan } = await supabase
      .from("history_catatan")
      .select("catatan, created_at, users(role)")
      .eq("kode_laporan", kode_laporan)
      .order("created_at", { ascending: false });

    // Ambil history terbaru per role
    const latestKepala = allHistoryAksi?.find(h => h.users?.role === "kepala_ruangan");
    const latestCatatanKepala = allHistoryCatatan?.find(h => h.users?.role === "kepala_ruangan");

    const latestChief = allHistoryAksi?.find(h => h.users?.role === "chief_nursing");
    const latestCatatanChief = allHistoryCatatan?.find(h => h.users?.role === "chief_nursing");

    const latestVerifikator = allHistoryAksi?.find(h => h.users?.role === "verifikator");
    const latestCatatanVerifikator = allHistoryCatatan?.find(h => h.users?.role === "verifikator");

    // Helper kasih label "updated"
    const EXCLUDED_USER_ID = "yRDjzhMBvRBDZxTcKNbAR";

    const markUpdated = (obj) => {
      // jika history dari user tertentu → jangan kasih "(Updated)"
      if (obj?.id_user === EXCLUDED_USER_ID) {
        return {
          kategori: obj?.kategori ?? laporan.kategori,
          grading: obj?.grading ?? laporan.grading,
          kronologi: obj?.kronologi ?? laporan.kronologi
        };
      }

      return {
        kategori: obj?.kategori
          ? obj.kategori + " (Updated)"
          : laporan.kategori,
        grading: obj?.grading
          ? obj.grading + " (Updated)"
          : laporan.grading,
        kronologi: obj?.kronologi
          ? obj.kronologi + " (Updated)"
          : laporan.kronologi
      };
    };


    // 5. Tentukan nilai kategori, grading, kronologi berdasarkan role
    let override = {
      kategori: laporan.kategori,
      grading: laporan.grading,
      kronologi: laporan.kronologi
    };

    if (role === "kepala_ruangan") {
      if (latestKepala) override = markUpdated(latestKepala);
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    if (role === "chief_nursing") {
      if (latestKepala) override = laporan; // default dari AI
      if (latestChief) override = markUpdated(latestChief);
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    if (role === "verifikator") {
      if (latestKepala) override = laporan; // default dari kepala_ruangan
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    // Apply override ke laporan dengan fallback "-"
    laporan.kategori = override.kategori || "-";
    laporan.grading = override.grading || "-";
    laporan.kronologi = override.kronologi || "-";

    // 6. Siapkan extra validasi khusus untuk verifikator
    let extraValidasi = {};
    if (role === "verifikator") {
    extraValidasi = {
        validasi_kepala_ruangan: {
        kategori: latestKepala?.kategori || "-",
        grading: latestKepala?.grading || "-",
        kronologi: latestKepala?.kronologi || "-",
        implementasi: latestKepala?.implementasi || "-",
        hasil: latestKepala?.hasil || "-",
        rencana_tindak_lanjut: latestKepala?.rencana_tindak_lanjut || "-"
        },
        validasi_chief_nursing: {
        kategori: latestChief?.kategori || "-",
        grading: latestChief?.grading || "-",
        kronologi: latestChief?.kronologi || "-",
        implementasi: latestChief?.implementasi || "-",
        hasil: latestChief?.hasil || "-",
        rencana_tindak_lanjut: latestChief?.rencana_tindak_lanjut || "-"
        }
    };
    }

    // 7. Response
    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: {
        ...laporan,
        catatan_kepala_ruangan: latestCatatanKepala?.catatan || "-",
        catatan_chief_nursing: latestCatatanChief?.catatan || "-",
        catatan_verifikator: latestCatatanVerifikator?.catatan || "-",
        ...extraValidasi,
        history_aksi: historyAksi || [],
        history_catatan: historyCatatan || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLaporanMasuk(req, res) {
  try {
    const { role, ruangan, id_user } = req.user; // dari middleware

    let query = supabase
      .from("laporan")
      .select(`
        kode_laporan,
        judul_insiden,
        tgl_waktu_pelaporan,
        perawat(nama_perawat)
      `);

    if (role === "kepala_ruangan") {
      const ruanganIds = ruangan.map(r => r.id_ruangan);

      query = query
        .eq("status", "diteruskan ke validator")
        .in("id_ruangan", ruanganIds);
    } else if (role === "chief_nursing") {
      query = query.eq("status", "diteruskan ke verifikator");
      if (id_user === "e_6JYm7ada_WjdnbB1zJV") {
          query = query.neq("id_perawat", "oVteW89a6AIVOvFtyt3iV");
      }
    } else if (role === "verifikator") {
      query = query.or(
        'status.eq.diteruskan ke verifikator,status.eq.laporan disetujui chief nursing'
      );
      if (id_user === "w6U5pPSyatpBbjbGzQuzY" || id_user === "yRDjzhMBvRBDZxTcKNbAR") {
        query = query.neq("id_perawat", "oVteW89a6AIVOvFtyt3iV");
      }
    } else {
      return res.status(403).json({ message: "Role tidak diizinkan" });
    }

    query = query.order("tgl_waktu_pelaporan", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({ message: "Laporan belum ada" });
    }

    // Custom formatter: "20 September 2025, 09:32 WITA"
    const formatter = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Makassar",
    });

    const formattedData = data.map((lap) => {
      if (!lap.tgl_waktu_pelaporan) return lap;

      const parts = formatter.formatToParts(new Date(lap.tgl_waktu_pelaporan));
      const tanggal = `${parts.find(p => p.type === "day").value} ${parts.find(p => p.type === "month").value} ${parts.find(p => p.type === "year").value}`;
      const jam = `${parts.find(p => p.type === "hour").value}:${parts.find(p => p.type === "minute").value}`;

      return {
        ...lap,
        tgl_waktu_pelaporan: `${tanggal}, ${jam} WITA`
      };
    });

    return res.status(200).json({ data: formattedData });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getLaporanForChiefNursing(req, res) {
  try {
    const { id_user } = req.user;

    // Bangun query dulu
    let query = supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(nama_perawat),
        ruangan:id_ruangan(nama_ruangan)
      `)
      .order("tgl_waktu_pelaporan", { ascending: false });

    // Kondisi khusus
    if (id_user === "e_6JYm7ada_WjdnbB1zJV") {
      query = query.neq("id_perawat", "oVteW89a6AIVOvFtyt3iV");
    }

    // Eksekusi di akhir
    const { data: laporanList, error: laporanError } = await query;

    if (laporanError) {
      throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    }
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk Chief Nursing" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // Default dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          kronologi: laporan.kronologi || "-"
        };

        // --- Ambil history aksi terbaru dari user sendiri ---
        const { data: selfHistoryAksi } = await supabase
          .from("history_aksi")
          .select("aksi, created_at")
          .eq("kode_laporan", laporan.kode_laporan)
          .eq("id_user", id_user) // hanya aksi sendiri
          .order("created_at", { ascending: false })
          .limit(1);

        const tindak_lanjut = selfHistoryAksi?.[0]?.aksi || "-";

        // --- Ambil history aksi terbaru dari kepala_ruangan, chief nursing, verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator", "chief_nursing"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const rolePriority = ["verifikator", "chief_nursing", "kepala_ruangan"];
          let selected = null;

          for (const role of rolePriority) {
            selected = allHistoryAksi.find(h => h.users?.role === role);
            if (selected) break; // ambil yang pertama sesuai prioritas
          }

          if (selected) {
            override.kategori = selected.kategori || override.kategori;
            override.grading = selected.grading || override.grading;
            override.kronologi =
              selected.kronologi || override.kronologi;
          }
        }

        // --- Ambil history catatan terbaru per role ---
        const { data: allHistoryCatatan } = await supabase
          .from("history_aksi")
          .select("rencana_tindak_lanjut, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestCatatanKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestCatatanChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestCatatanVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          kronologi: override.kronologi || "-",
          rencana_tindak_lanjut_kepala_ruangan: latestCatatanKepala?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_chief_nursing: latestCatatanChief?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_verifikator: latestCatatanVerif?.rencana_tindak_lanjut || "-",
          tindak_lanjut: tindak_lanjut
        };
      })
    );

    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: laporanWithOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAllLaporanForVerifikator(req, res) {
  try {
    const { id_user } = req.user;

    let query = supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(id_perawat, nama_perawat),
        ruangan:id_ruangan(id_ruangan, nama_ruangan)
      `)
      .order("tgl_waktu_pelaporan", { ascending: false });

    // Kondisi khusus
    if (id_user === "w6U5pPSyatpBbjbGzQuzY" || id_user === "yRDjzhMBvRBDZxTcKNbAR") {
      query = query.neq("id_perawat", "oVteW89a6AIVOvFtyt3iV");
    }

    // Eksekusi DI AKHIR
    const { data: laporanList, error: laporanError } = await query;

    if (laporanError) {
      throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    }
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk Verifikator" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // Default dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          kronologi: laporan.kronologi || "-"
        };

        // --- Ambil history aksi terbaru dari user sendiri ---
        const { data: selfHistoryAksi } = await supabase
          .from("history_aksi")
          .select("aksi, created_at")
          .eq("kode_laporan", laporan.kode_laporan)
          .eq("id_user", id_user) // hanya aksi sendiri
          .order("created_at", { ascending: false })
          .limit(1);

        const tindak_lanjut = selfHistoryAksi?.[0]?.aksi || "-";

        // --- Ambil history aksi terbaru dari kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const rolePriority = ["verifikator", "kepala_ruangan"];
          let selected = null;

          for (const role of rolePriority) {
            selected = allHistoryAksi.find(h => h.users?.role === role);
            if (selected) break; // ambil yang pertama sesuai prioritas
          }

          if (selected) {
            override.kategori = selected.kategori || override.kategori;
            override.grading = selected.grading || override.grading;
            override.kronologi =
              selected.kronologi || override.kronologi;
          }
        }

        const { data: allHistoryAksi2 } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, hasil, rencana_tindak_lanjut, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

          const { data: allHistoryCatatan } = await supabase
          .from("history_catatan")
          .select("catatan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestCatatanKepala = allHistoryCatatan?.find(h => h.users?.role === "kepala_ruangan");
        const latestCatatanChief = allHistoryCatatan?.find(h => h.users?.role === "chief_nursing");
        const latestCatatanVerifikator = allHistoryCatatan?.find(h => h.users?.role === "verifikator");

        const latestAksiKepala = allHistoryAksi2?.find((c) => c.users?.role === "kepala_ruangan");
        const latestAksiChief = allHistoryAksi2?.find((c) => c.users?.role === "chief_nursing");
        const latestAksiVerif = allHistoryAksi2?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          kronologi: override.kronologi || "-",
          catatan_kepala_ruangan: latestCatatanKepala?.catatan || "-",
          catatan_chief_nursing: latestCatatanChief?.catatan || "-",
          catatan_verifikator: latestCatatanVerifikator?.catatan || "-",
          kategori_kepala_ruangan: latestAksiKepala?.kategori || "-",
          kategori_chief_nursing: latestAksiChief?.kategori || "-",
          kategori_verifikator: latestAksiVerif?.kategori || "-",
          grading_kepala_ruangan: latestAksiKepala?.grading || "-",
          grading_chief_nursing: latestAksiChief?.grading || "-",
          grading_verifikator: latestAksiVerif?.grading || "-",
          kronologi_kepala_ruangan: latestAksiKepala?.kronologi || "-",
          kronologi_chief_nursing: latestAksiChief?.kronologi || "-",
          kronologi_verifikator: latestAksiVerif?.kronologi || "-",
          implementasi_kepala_ruangan: latestAksiKepala?.implementasi || "-",
          implementasi_chief_nursing: latestAksiChief?.implementasi || "-",
          implementasi_verifikator: latestAksiVerif?.implementasi || "-",
          hasil_kepala_ruangan: latestAksiKepala?.hasil || "-",
          hasil_chief_nursing: latestAksiChief?.hasil || "-",
          hasil_verifikator: latestAksiVerif?.hasil || "-",
          rencana_tindak_lanjut_kepala_ruangan: latestAksiKepala?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_chief_nursing: latestAksiChief?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_verifikator: latestAksiVerif?.rencana_tindak_lanjut || "-",
          tindak_lanjut: tindak_lanjut
        };
      })
    );

    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: laporanWithOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAllLaporanForAdmin(req, res) {
  try {
    // 🔹 Ambil laporan + join ke perawat & ruangan
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat(nama_perawat),
        ruangan(nama_ruangan)
      `)
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan tersedia" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // --- Default dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          kronologi: laporan.kronologi || "-"
        };

        // --- Ambil history aksi terbaru untuk kepala_ruangan & verifikator
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const latestKepala = allHistoryAksi.find((a) => a.users?.role === "kepala_ruangan");
          const latestVerif = allHistoryAksi.find((a) => a.users?.role === "verifikator");

          if (latestKepala) {
            override.kategori = latestKepala.kategori || override.kategori;
            override.grading = latestKepala.grading || override.grading;
            override.kronologi =
              latestKepala.kronologi || override.kronologi;
          }
          if (latestVerif) {
            override.kategori = latestVerif.kategori || override.kategori;
            override.grading = latestVerif.grading || override.grading;
            override.kronologi =
              latestVerif.kronologi || override.kronologi;
          }
        }

        // --- Ambil catatan terbaru untuk 3 role
        const { data: allHistoryCatatan } = await supabase
          .from("history_catatan")
          .select("catatan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "chief_nursing", "verifikator"])
          .order("created_at", { ascending: false });

        const latestCatatanKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestCatatanChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestCatatanVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          kronologi: override.kronologi || "-",
          catatan_kepala_ruangan: latestCatatanKepala?.catatan || "-",
          catatan_chief_nursing: latestCatatanChief?.catatan || "-",
          catatan_verifikator: latestCatatanVerif?.catatan || "-"
        };
      })
    );

    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: laporanWithOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLaporanForPerawat(req, res) {
  try {
    const { id_perawat } = req.user;
    if (!id_perawat) {
      return res.status(400).json({ message: "ID Perawat wajib diisi" });
    }

    // Ambil semua laporan berdasarkan perawat
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat(nama_perawat, id_ruangan),
        ruangan(nama_ruangan)
      `)
      .eq("id_perawat", id_perawat)
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk perawat ini" });
    }

    // Proses setiap laporan
    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // Default override dari laporan (kalau null -> "-")
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          kronologi: laporan.kronologi || "-"
        };

        // --- Ambil history aksi terbaru dari kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const rolePriority = ["verifikator", "kepala_ruangan"];
          let selected = null;

          for (const role of rolePriority) {
            selected = allHistoryAksi.find(h => h.users?.role === role);
            if (selected) break; // ambil yang pertama sesuai prioritas
          }

          if (selected) {
            override.kategori = selected.kategori || override.kategori;
            override.grading = selected.grading || override.grading;
            override.kronologi =
              selected.kronologi || override.kronologi;
          }
        }

        // --- Ambil history Aksi terbaru per role ---
        const { data: allHistoryAksi2 } = await supabase
          .from("history_aksi")
          .select("rencana_tindak_lanjut, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestAksi2Kepala = allHistoryAksi2?.find((c) => c.users?.role === "kepala_ruangan");
        const latestAksi2Chief = allHistoryAksi2?.find((c) => c.users?.role === "chief_nursing");
        const latestAksi2Verif = allHistoryAksi2?.find((c) => c.users?.role === "verifikator");

        const { data: allHistoryCatatan } = await supabase
          .from("history_catatan")
          .select("catatan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestCatatanKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestCatatanChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestCatatanVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          kronologi: override.kronologi || "-",
          rencana_tindak_lanjut_kepala_ruangan: latestAksi2Kepala?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_chief_nursing: latestAksi2Chief?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_verifikator: latestAksi2Verif?.rencana_tindak_lanjut || "-",
          catatan_kepala_ruangan: latestCatatanKepala?.catatan || "-",
          catatan_chief_nursing: latestCatatanChief?.catatan || "-",
          catatan_verifikator: latestCatatanVerif?.catatan || "-",
        };
      })
    );

    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: laporanWithOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLaporanForKepalaRuangan(req, res) {
  try {
    const { id_user, ruangan } = req.user; // array ruangan

    if (!ruangan || ruangan.length === 0) {
      return res.status(400).json({ message: "Kepala ruangan belum memiliki ruangan" });
    }

    const ruanganIds = ruangan.map(r => r.id_ruangan);

    // Ambil semua laporan dari semua ruangan yang ditangani
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat(nama_perawat),
        ruangan(nama_ruangan)
      `)
      .in("id_ruangan", ruanganIds)
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk ruangan ini" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // Default override dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          kronologi: laporan.kronologi || "-"
        };

        // --- Ambil history aksi terbaru dari user sendiri ---
        const { data: selfHistoryAksi } = await supabase
          .from("history_aksi")
          .select("aksi, created_at")
          .eq("kode_laporan", laporan.kode_laporan)
          .eq("id_user", id_user) // hanya aksi sendiri
          .order("created_at", { ascending: false })
          .limit(1);

        const tindak_lanjut = selfHistoryAksi?.[0]?.aksi || "-";

        // --- Ambil history aksi terbaru dari kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, kronologi, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const rolePriority = ["verifikator", "kepala_ruangan"];
          let selected = null;

          for (const role of rolePriority) {
            selected = allHistoryAksi.find(h => h.users?.role === role);
            if (selected) break; // ambil yang pertama sesuai prioritas
          }

          if (selected) {
            override.kategori = selected.kategori || override.kategori;
            override.grading = selected.grading || override.grading;
            override.kronologi =
              selected.kronologi || override.kronologi;
          }
        }

        // --- Ambil history catatan terbaru per role ---
        const { data: allHistoryCatatan } = await supabase
          .from("history_aksi")
          .select("rencana_tindak_lanjut, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestCatatanKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestCatatanChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestCatatanVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          kronologi: override.kronologi || "-",
          rencana_tindak_lanjut_kepala_ruangan: latestCatatanKepala?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_chief_nursing: latestCatatanChief?.rencana_tindak_lanjut || "-",
          rencana_tindak_lanjut_verifikator: latestCatatanVerif?.rencana_tindak_lanjut || "-",
          tindak_lanjut: tindak_lanjut
        };
      })
    );

    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: laporanWithOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function cleanLaporanUsingLLM(req, res) {
    try {
        const body = req.body;
        const { id_perawat, id_ruangan } = req.user;
        const missingFields = requiredFieldsForAI.filter((field) => !body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Field berikut wajib diisi: ${missingFields.join(", ")}`,
            });
        }

        const { data: cleanedData, usage } = await callOpenAIAPI(body);

        // console.log("Data berhasil diolah oleh AI:", cleanedData);

        // if (usage && usage.promptTokenCount) {
        //     console.log(`Monitoring Penggunaan Token: ${usage.promptTokenCount} token digunakan untuk input.`);
        // }

        const finalReport = {
            ...body,
            id_perawat,
            id_ruangan,
            ...cleanedData
        };

        res.status(200).json({
            message: "Laporan berhasil dianalisis dan diformat oleh AI.",
            data: finalReport,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function validateChronology(req, res) {
    // 1. Ambil data 'chronology' dari body request
    const { chronology, judul_insiden } = req.body;

    // 2. Validasi input: pastikan 'chronology' tidak kosong
    if (!chronology || chronology.trim() === '') {
        // Jika kosong, kirim respon error 400 (Bad Request)
        return res.status(400).json({ 
            message: 'Input "chronology" tidak boleh kosong.' 
        });
    }

    // Validasi input: pastikan 'judul_insiden' tidak kosong
    if (!judul_insiden || judul_insiden.trim() === '') {
        return res.status(400).json({ 
            message: 'Input "judul_insiden" tidak boleh kosong.' 
        });
    }

    try {
        // 3. Panggil fungsi yang sudah kita buat sebelumnya
        //    Gunakan 'await' karena fungsi ini bersifat asynchronous
        const result = await validateChronologyAPI(chronology, judul_insiden);

        // 4. Kirim respon sukses (200 OK) ke client
        //    'result.data' berisi objek JSON hasil validasi dari Gemini
        res.status(200).json(result.data);

    } catch (error) {
        // 5. Jika terjadi error saat memanggil API Gemini
        console.error('Error saat memvalidasi kronologi via API:', error);
        
        // Kirim respon error 500 (Internal Server Error)
        res.status(500).json({ 
            message: 'Terjadi kesalahan pada server saat validasi.' 
        });
    }
}

export async function generateLaporan(req, res) { 
    try {
        const body = req.body;
        const { id_perawat, id_ruangan } = req.user;

        const missingFields = requiredFieldsForConfirmation.filter((field) => !body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Field berikut wajib diisi: ${missingFields.join(", ")}`,
            });
        }

        const { data: perawat, error: perawatError } = await supabase
            .from("perawat")
            .select("id_perawat, id_user, id_ruangan")
            .eq("id_perawat", id_perawat)
            .maybeSingle();

        if (perawatError || !perawat) {
            return res.status(400).json({ error: "id_perawat tidak valid / tidak ditemukan" });
        }

        const { data: ruangan, error: ruanganError } = await supabase
            .from("ruangan")
            .select(`
                id_ruangan,
                kepala_ruangan(id_user, nama_kepala_ruangan)
            `)
            .eq("id_ruangan", id_ruangan)
            .maybeSingle();

        if (ruanganError || !ruangan) {
            return res.status(400).json({ error: "id_ruangan tidak valid / tidak ditemukan" });
        }

        const kode_laporan = generateKodeLaporan();
        const { skor_dampak, skor_probabilitas, skor_grading, grading, rekomendasi_tindakan } = hitungSkor(
            body.dampak,
            body.probabilitas
        );

        const tgl_insiden = body.tgl_insiden ? parseTanggal(body.tgl_insiden) : null;
        const tgl_msk_rs = body.tgl_msk_rs ? parseTanggalDateOnly(body.tgl_msk_rs) : null;

        for (const [key, value] of Object.entries(body)) {
          if (typeof value === "string" && value.length > 100) {
            console.warn(`⚠️ Field "${key}" memiliki panjang ${value.length} karakter (lebih dari 100)`);
          }
        }

        // Tentukan status berdasarkan aturan
        const kategoriValidator = ["KPC", "KNC", "KTC"];
        let status = "diteruskan ke verifikator"; // default

        if (
          ["biru", "hijau"].includes(grading) &&
          kategoriValidator.includes(body.kategori)
        ) {
          status = "diteruskan ke validator";
        }

        const { data: laporan, error: insertError } = await supabase
            .from("laporan")
            .insert([{
                kode_laporan,
                ...body,
                tgl_msk_rs,
                tgl_insiden,
                skor_dampak,
                skor_probabilitas,
                skor_grading,
                grading,
                rekomendasi_tindakan,
                status,
                id_perawat,
                id_ruangan
            }])
            .select()
            .single();

        if (insertError) {
            return res.status(500).json({ error: insertError.message });
        }

        // 🔔 Ambil semua user dengan role chief_nursing & verifikator
        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id_user, role");

        if (usersError) throw new Error(`Gagal ambil users: ${usersError.message}`);

        let notifikasi = [];

        // Notif ke perawat
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user: perawat.id_user,
            message: `Laporan dengan kode laporan ${kode_laporan} sudah diterima dan sedang ditindak lanjuti oleh validator`,
        });

        // Notif ke kepala ruangan (hanya 1 orang dari data ruangan)
        if (ruangan?.kepala_ruangan?.id_user) {
            notifikasi.push({
                id_notifikasi: nanoid(),
                id_user: ruangan.kepala_ruangan.id_user,
                message: `Ada laporan baru dengan kode ${kode_laporan} dari perawat di ruangan Anda.`,
            });
        }

        // ID khusus penerima
        const SPECIAL_PERAWAT_ID = "oVteW89a6AIVOvFtyt3iV";
        const ALLOWED_USERS_FOR_SPECIAL = [
          "nLw9Qf7iJxTQ1t1J8rwQd",
          "pJtJf-p7bOmpJo0tHxNb9",
        ];

        // Tentukan target penerima
        let targetUsers = [];

        if (id_perawat === SPECIAL_PERAWAT_ID) {
          // 🔒 Khusus: hanya 2 user ini
          targetUsers = usersData.filter(
            (u) =>
              ["chief_nursing", "verifikator"].includes(u.role) &&
              ALLOWED_USERS_FOR_SPECIAL.includes(u.id_user)
          );
        } else {
          // ✅ Normal: semua chief nursing & verifikator
          targetUsers = usersData.filter((u) =>
            ["chief_nursing", "verifikator"].includes(u.role)
          );
        }

        // Push notifikasi
        targetUsers.forEach((u) => {
          notifikasi.push({
            id_notifikasi: nanoid(),
            id_user: u.id_user,
            message: `Ada laporan baru dengan kode ${kode_laporan}.`,
          });
        });

        // ⬅️ INSERT SEKALI SAJA
        const { error: notifError } = await supabase
          .from("notifikasi")
          .insert(notifikasi);

        if (notifError) {
          return res.status(500).json({ error: notifError.message });
        }

        //tambahkan notifikasi Email ke kepala ruangan
        const link = `${process.env.FRONTEND_URL}`;

        const emailContent = emailTemplates.notifikasi(
            kode_laporan, 
            link
        );

        // ambil email kepala ruangan berdasarkan id_user
        let kepalaEmail = null;

        if (ruangan?.kepala_ruangan?.id_user) {
          const { data: kepalaUser, error: kepalaUserError } = await supabase
            .from("users")
            .select("email")
            .eq("id_user", ruangan.kepala_ruangan.id_user)
            .maybeSingle();

          if (kepalaUserError) {
            console.error("Gagal ambil email kepala ruangan:", kepalaUserError.message);
          } else {
            kepalaEmail = kepalaUser?.email;
          }
        }

        if (kepalaEmail) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: kepalaEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });
        }

        return res.status(200).json({
            message: "Laporan berhasil dibuat & notifikasi terkirim",
            data: laporan,
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function rejectLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { catatan } = req.body;
    const id_user = req.user?.id_user;

    if (!kode_laporan) {
      return res.status(400).json({ message: "Kode Laporan wajib diisi" });
    }

    if (!catatan || catatan.trim() === "") {
      return res.status(400).json({ message: "Catatan wajib diisi saat menolak laporan" });
    }

    // Ambil laporan
    const { data: laporan, error: laporanError } = await supabase
      .from("laporan")
      .select("id_perawat, status, kategori, grading, rekomendasi_tindakan, perawat(id_user, nama_perawat)")
      .eq("kode_laporan", kode_laporan)
      .single();

    if (laporanError) throw new Error(`Gagal cek laporan: ${laporanError.message}`);
    if (!laporan) return res.status(404).json({ message: "Laporan tidak ditemukan" });

    // if (laporan.status === "laporan disetujui verifikator") {
    //   return res.status(400).json({ message: "Status laporan tidak valid untuk ditolak" });
    // }

    // Update status laporan
    if (laporan.status !== "laporan disetujui verifikator") {
      const { data: laporanUpdate, error: updateError } = await supabase
      .from("laporan")
      .update({ status: "laporan ditolak validator" })
      .eq("kode_laporan", kode_laporan)
      .select("*, perawat(nama_perawat, id_user)")
      .single();

    if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
    }

    // Insert history_aksi
    const aksiInsert = {
      id_aksi: nanoid(),
      kode_laporan,
      id_user,
      aksi: "tolak",
    };
    const { error: aksiError } = await supabase.from("history_aksi").insert([aksiInsert]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // Simpan catatan ke history_catatan
    const catatanInsert = {
      id_catatan: nanoid(),
      kode_laporan,
      id_user,
      catatan,
    };
    const { error: catatanError } = await supabase.from("history_catatan").insert([catatanInsert]);
    if (catatanError) throw new Error(`Gagal insert history_catatan: ${catatanError.message}`);

    // 🔔 Notifikasi
    let notifikasi = [];

    // 1. Ke perawat laporan
    if (laporan.perawat?.id_user) {
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user: laporan.perawat.id_user,
        message: `Laporan dengan kode ${kode_laporan} ditolak oleh kepala ruangan. Catatan dari Kepala Ruangan: ${catatan}`,
      });
    }

    // 2. Ke dirinya sendiri
    notifikasi.push({
      id_notifikasi: nanoid(),
      id_user,
      message: `Anda berhasil menolak laporan dengan kode ${kode_laporan}. Catatan: ${catatan}`,
    });

    // 3. Ke chief nursing dan verifikator
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id_user, role");

    if (usersError) throw new Error(`Gagal ambil users: ${usersError.message}`);

    usersData
      .filter((u) => ["chief_nursing", "verifikator"].includes(u.role))
      .forEach((u) => {
        notifikasi.push({
          id_notifikasi: nanoid(),
          id_user: u.id_user,
          message: `Laporan dengan kode ${kode_laporan} ditolak oleh kepala ruangan. Catatan dari Kepala Ruangan: ${catatan}`,
        });
      });

    // Simpan semua notifikasi
    if (notifikasi.length > 0) {
      const { error: notifError } = await supabase.from("notifikasi").insert(notifikasi);
      if (notifError) throw new Error(`Gagal insert notifikasi: ${notifError.message}`);
    }

    return res.status(200).json({
      message: `Laporan berhasil ditolak. Catatan: ${catatan}`,
    });
  } catch (error) {
    console.error("rejectLaporan error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function approveLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { implementasi, hasil, rencana_tindak_lanjut } = req.body;
    const { role, id_user } = req.user;
    if (!kode_laporan) {
      return res.status(400).json({ message: "Kode Laporan wajib diisi" });
    }

    if (!implementasi || !hasil || !rencana_tindak_lanjut) {
      return res.status(400).json({
        message: "Minimal salah satu dari implementasi, hasil, atau rencana tindak lanjut wajib diisi."
      });
    }

    const { data: laporanData, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(id_user, nama_perawat),
        ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
      `)
      .eq("kode_laporan", kode_laporan)
      .maybeSingle();

    if (laporanError) throw new Error(`Gagal cek laporan: ${laporanError.message}`);
    if (!laporanData) {
      return res.status(404).json({ message: "Laporan tidak ditemukan" });
    }

    // 🔎 Validasi status sesuai role
    // if (role === "kepala_ruangan" && laporanData.status === "laporan disetujui verifikator") {
    //   return res.status(400).json({ message: "Status laporan tidak valid untuk disetujui oleh kepala_ruangan" });
    // }

    // if (role === "chief_nursing" &&
    //     ["laporan ditolak validator", "diteruskan ke validator"].includes(laporanData.status)) {
    //   return res.status(400).json({ message: "Status laporan tidak valid untuk disetujui oleh chief_nursing" });
    // }

    if (
    role === "verifikator" &&
    !["diteruskan ke verifikator", "laporan disetujui verifikator", "laporan disetujui chief nursing"].includes(laporanData.status)
    ) {
      if (laporanData.status === "laporan ditolak validator") {
        return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh verifikator karena laporan ditolak oleh validator" });
      }
      if (laporanData.status === "diteruskan ke validator") {
        return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh verifikator karena laporan belum divalidasi oleh validator" });
      }
    }

    let newStatus = laporanData.status;
    if (role === "kepala_ruangan" && laporanData.status !== "laporan disetujui verifikator") newStatus = "diteruskan ke verifikator";
    if (role === "verifikator") {
      newStatus = "laporan disetujui verifikator";
    }
    if (role === "chief_nursing" && !["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      newStatus = "laporan disetujui chief nursing";
    }

    // ✅ Update laporan (status only, kecuali chief_nursing)
    let laporanUpdate = laporanData;

    if (role === "kepala_ruangan" && laporanData.status !== "laporan disetujui verifikator") {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: laporanUpdate.grading, kategori: laporanUpdate.kategori, kronologi: laporanUpdate.kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    if (role === "chief_nursing" && !["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: laporanUpdate.grading, kategori: laporanUpdate.kategori, kronologi: laporanUpdate.kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    if (role === "verifikator" &&
      id_user !== "yRDjzhMBvRBDZxTcKNbAR") {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: laporanUpdate.grading, kategori: laporanUpdate.kategori, kronologi: laporanUpdate.kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    // 📝 Insert history_aksi
    const { error: aksiError } = await supabase.from("history_aksi").insert([
      {
        id_aksi: nanoid(),
        id_user,
        kode_laporan,
        aksi: "validasi",
        kategori: laporanUpdate.kategori,
        grading: laporanUpdate.grading,
        kronologi: laporanUpdate.kronologi,

        // kolom baru:
        implementasi,
        hasil,
        rencana_tindak_lanjut
      }
    ]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // 🔔 Kirim notifikasi
    const notifikasi = [];

    // Notifikasi umum
    if (role === "kepala_ruangan" && id_user !== "pldhkeWJ6Nun5WobD4P9l") {
        const { data: verifikatorList, error: verifikatorError } = await supabase
            .from("users")
            .select("id_user")
            .eq("role", "verifikator");

        if (verifikatorError) {
            throw new Error(`Gagal ambil daftar verifikator: ${verifikatorError.message}`);
        }
        const { data: chiefNursingList, error: chiefNursingError } = await supabase
            .from("users")
            .select("id_user")
            .eq("role", "chief_nursing");

        if (chiefNursingError) {
            throw new Error(`Gagal ambil daftar Chief Nursing: ${chiefNursingError.message}`);
        }

        // Kepala ruangan → perawat
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user: laporanUpdate.perawat.id_user,
            message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh kepala ruangan.`,
        });

        if (verifikatorList?.length) {
            verifikatorList.forEach((v) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: v.id_user,
                    message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh kepala ruangan.`,
                });
            });
        }

        if (chiefNursingList?.length) {
            chiefNursingList.forEach((c) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: c.id_user,
                    message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh kepala ruangan.`,
                });
            });
        }

        // ✅ Notifikasi ke dirinya sendiri
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user,
            message: `Anda berhasil menyetujui laporan dengan kode ${kode_laporan}.`,
        });

        //kirimkan notifikasi ke WA verifikator dan chief nursing

    } else if (role === "verifikator" && id_user !== "nLw9Qf7iJxTQ1t1J8rwQd" && id_user !== "yRDjzhMBvRBDZxTcKNbAR") {
        const { data: chiefNursingList, error: chiefNursingError } = await supabase
            .from("users")
            .select("id_user")
            .eq("role", "chief_nursing");

        if (chiefNursingError) {
            throw new Error(`Gagal ambil daftar Chief Nursing: ${chiefNursingError.message}`);
        }

        // Verifikator → perawat & kepala ruangan
        notifikasi.push(
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.perawat.id_user,
                message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh verifikator.`,
            },
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.ruangan.kepala_ruangan[0].id_user,
                message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh verifikator.`,
            }
        );

        if (chiefNursingList?.length) {
            chiefNursingList.forEach((c) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: c.id_user,
                    message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh verifikator.`,
                });
            });
        }

        // ✅ Notifikasi ke dirinya sendiri
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user,
            message: `Anda berhasil menyetujui laporan dengan kode ${kode_laporan}.`,
        });

    } else if (role === "chief_nursing" && id_user !== "pJtJf-p7bOmpJo0tHxNb9") {
        const { data: verifikatorList, error: verifikatorError } = await supabase
            .from("users")
            .select("id_user")
            .eq("role", "verifikator");

        if (verifikatorError) {
            throw new Error(`Gagal ambil daftar verifikator: ${verifikatorError.message}`);
        }

        if (verifikatorList?.length) {
            verifikatorList.forEach((v) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: v.id_user,
                    message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh chief nursing.`,
                });
            });
        }

        // ✅ Notifikasi ke dirinya sendiri
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user,
            message: `Anda berhasil menyetujui laporan dengan kode ${kode_laporan}.`,
        });

        //kirimkan notifikasi ke WA verifikator
    }

    if (notifikasi.length > 0) {
        const { error: notifError } = await supabase
            .from("notifikasi")
            .insert(notifikasi);

        if (notifError) throw new Error(`Gagal kirim notifikasi: ${notifError.message}`);
    }

    // Tambahkan notifikasi Email sesuai role
    const link = `${process.env.FRONTEND_URL}`;

    if (role === 'kepala_ruangan' && id_user !== 'pldhkeWJ6Nun5WobD4P9l') {
      // kepala_ruangan -> verifikator & chief nursing
      const { data: verifikatorList } = await supabase.from("users").select("email").eq("role", "verifikator");
      const { data: chiefNursingList } = await supabase.from("users").select("email").eq("role", "chief_nursing");

      [...(verifikatorList || []), ...(chiefNursingList || [])].forEach(async (u) => {
        const emailContent = emailTemplates.notifikasi(kode_laporan, link, "kepala_ruangan");
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      });

    } else if (role === 'chief_nursing' && id_user !== 'pJtJf-p7bOmpJo0tHxNb9') {
      // chief_nursing -> verifikator
      const { data: verifikatorList } = await supabase.from("users").select("email").eq("role", "verifikator");

      (verifikatorList || []).forEach(async (u) => {
        const emailContent = emailTemplates.notifikasi(kode_laporan, link, "chief_nursing");
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      });

    } else if (role === 'verifikator' && id_user !== 'nLw9Qf7iJxTQ1t1J8rwQd' && id_user !== 'yRDjzhMBvRBDZxTcKNbAR') {
      // verifikator -> kepala ruangan & chief nursing
      const kepalaId = laporanData.ruangan?.kepala_ruangan?.id_user;
      let kepalaEmail = null;
      if (kepalaId) {
        const { data: kepalaUser } = await supabase.from("users").select("email").eq("id_user", kepalaId).maybeSingle();
        kepalaEmail = kepalaUser?.email;
      }

      const { data: chiefNursingList } = await supabase.from("users").select("email").eq("role", "chief_nursing");

      const targets = [];
      if (kepalaEmail) targets.push({ email: kepalaEmail });
      targets.push(...(chiefNursingList || []));

      targets.forEach(async (u) => {
        const emailContent = emailTemplates.notifikasi(kode_laporan, link, "verifikator");
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      });
    }

    return res.status(200).json({
      message: "Laporan berhasil di-approve"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function revisiLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { kategori, grading, kronologi, catatan } = req.body;
    const { role, id_user } = req.user;

    // Validasi utama
    if (!kode_laporan) {
      return res.status(400).json({ message: "Kode Laporan wajib diisi" });
    }
    if (!role) {
      return res.status(400).json({ message: "Role wajib diisi" });
    }
    if (!catatan || catatan.trim() === "") {
      return res.status(400).json({ message: "Catatan wajib diisi" });
    }

    // Ambil data laporan
    const { data: laporanData, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(id_user, nama_perawat),
        ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
      `)
      .eq("kode_laporan", kode_laporan)
      .maybeSingle();

    if (laporanError) throw new Error(`Gagal cek laporan: ${laporanError.message}`);
    if (!laporanData) {
      return res.status(404).json({ message: "Laporan tidak ditemukan" });
    }

    // Validasi status berdasarkan role
    // if (role === "kepala_ruangan" && laporanData.status === "laporan disetujui verifikator") {
    //   return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh kepala_ruangan" });
    // }

    // if (
    //   role === "chief_nursing" &&
    //   ["laporan ditolak validator", "diteruskan ke validator"].includes(laporanData.status)
    // ) {
    //   return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh chief_nursing" });
    // }

    if (
      role === "verifikator" &&
      id_user !== "yRDjzhMBvRBDZxTcKNbAR" &&
      !["diteruskan ke verifikator", "laporan disetujui verifikator", "laporan disetujui chief nursing"]
        .includes(laporanData.status)
    ) {
      if (laporanData.status === "laporan ditolak validator") {
        return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh verifikator karena laporan ditolak oleh validator" });
      }
      if (laporanData.status === "diteruskan ke validator") {
        return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh verifikator karena laporan belum divalidasi oleh validator" });
      }
    }

    // Tentukan status baru
    let newStatus = laporanData.status;
    if (role === "kepala_ruangan" && laporanData.status !== "laporan disetujui verifikator") newStatus = "diteruskan ke verifikator";
    if (role === "verifikator" &&
      id_user !== "yRDjzhMBvRBDZxTcKNbAR") newStatus = "laporan disetujui verifikator";
    if (role === "chief_nursing" && !["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      newStatus = "laporan disetujui chief nursing";
    }

    // Update status jika diperlukan
    let laporanUpdate = laporanData;

    if (role === "kepala_ruangan" && laporanData.status !== "laporan disetujui verifikator") {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: grading, kategori: kategori, kronologi: kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    if (role === "chief_nursing" && !["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: grading, kategori: kategori, kronologi: kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    if (role === "verifikator" &&
      id_user !== "yRDjzhMBvRBDZxTcKNbAR") {
      if (newStatus) {
        const { data, error: updateError } = await supabase
          .from("laporan")
          .update({ status: newStatus, grading: grading, kategori: kategori, kronologi: kronologi })
          .eq("kode_laporan", kode_laporan)
          .select(`
            *,
            perawat:id_perawat(id_user, nama_perawat),
            ruangan:id_ruangan(nama_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
          `)
          .single();

        if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);
        laporanUpdate = data;
      }
    }

    const aksiValue = id_user === "yRDjzhMBvRBDZxTcKNbAR" ? "-" : "revisi";

    // Insert history_aksi (kategori, grading, kronologi boleh kosong)
    const { error: aksiError } = await supabase.from("history_aksi").insert([
      {
        id_aksi: nanoid(),
        id_user,
        kode_laporan,
        aksi: aksiValue,
        kategori: kategori || null,
        grading: grading || null,
        kronologi: kronologi || null
      }
    ]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // Insert catatan wajib
    const { error: catatanError } = await supabase.from("history_catatan").insert([
      {
        id_catatan: nanoid(),
        kode_laporan,
        id_user,
        catatan,
      }
    ]);

    if (catatanError) throw new Error(`Gagal insert history_catatan: ${catatanError.message}`);

    // ======================================================
    // ============  NOTIFIKASI (tidak diubah)  =============
    // ======================================================

    // ================= INSERT NOTIFIKASI =================
    const notifikasi = [];

    if (role === "kepala_ruangan" && id_user !== "pldhkeWJ6Nun5WobD4P9l") {
      // ambil verifikator & chief nursing
      const { data: verifikatorList, error: verifikatorError } = await supabase
        .from("users")
        .select("id_user")
        .eq("role", "verifikator");

      if (verifikatorError) {
        throw new Error(`Gagal ambil verifikator: ${verifikatorError.message}`);
      }

      const { data: chiefNursingList, error: chiefNursingError } = await supabase
        .from("users")
        .select("id_user")
        .eq("role", "chief_nursing");

      if (chiefNursingError) {
        throw new Error(`Gagal ambil chief nursing: ${chiefNursingError.message}`);
      }

      // ke perawat
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user: laporanUpdate.perawat.id_user,
        message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan. Catatan: ${catatan}`,
      });

      // ke verifikator
      verifikatorList?.forEach(v => {
        notifikasi.push({
          id_notifikasi: nanoid(),
          id_user: v.id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan.`,
        });
      });

      // ke chief nursing
      chiefNursingList?.forEach(c => {
        notifikasi.push({
          id_notifikasi: nanoid(),
          id_user: c.id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan.`,
        });
      });

      // ke diri sendiri
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
      });

    } else if (role === "verifikator" && id_user !== "nLw9Qf7iJxTQ1t1J8rwQd" && id_user !== "yRDjzhMBvRBDZxTcKNbAR") {
      // ke perawat & kepala ruangan
      notifikasi.push(
        {
          id_notifikasi: nanoid(),
          id_user: laporanUpdate.perawat.id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator. Catatan: ${catatan}`,
        },
        {
          id_notifikasi: nanoid(),
          id_user: laporanUpdate.ruangan.kepala_ruangan[0].id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator. Catatan: ${catatan}`,
        }
      );

      // ke chief nursing
      const { data: chiefNursingList } = await supabase
        .from("users")
        .select("id_user")
        .eq("role", "chief_nursing");

      chiefNursingList?.forEach(c => {
        notifikasi.push({
          id_notifikasi: nanoid(),
          id_user: c.id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator. Catatan: ${catatan}`,
        });
      });

      // ke diri sendiri
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
      });

    } else if (role === "chief_nursing" && id_user !== "pJtJf-p7bOmpJo0tHxNb9") {
      // ke verifikator
      const { data: verifikatorList } = await supabase
        .from("users")
        .select("id_user")
        .eq("role", "verifikator");

      verifikatorList?.forEach(v => {
        notifikasi.push({
          id_notifikasi: nanoid(),
          id_user: v.id_user,
          message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh chief nursing. Catatan: ${catatan}`,
        });
      });

      // ke diri sendiri
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
      });
    }

    // eksekusi insert
    if (notifikasi.length > 0) {
      const { error: notifError } = await supabase
        .from("notifikasi")
        .insert(notifikasi);

      if (notifError) {
        throw new Error(`Gagal insert notifikasi: ${notifError.message}`);
      }
    }

    // ================= EMAIL NOTIFIKASI =================
    const link = `${process.env.FRONTEND_URL}`;

    if (role === "kepala_ruangan" && id_user !== "pldhkeWJ6Nun5WobD4P9l") {
      // kepala_ruangan -> verifikator & chief nursing
      const { data: verifikatorList } = await supabase
        .from("users")
        .select("email")
        .eq("role", "verifikator");

      const { data: chiefNursingList } = await supabase
        .from("users")
        .select("email")
        .eq("role", "chief_nursing");

      const targets = [
        ...(verifikatorList || []),
        ...(chiefNursingList || []),
      ];

      for (const u of targets) {
        const emailContent = emailTemplates.revisi(
          kode_laporan,
          catatan,
          link,
          "kepala_ruangan"
        );

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      }

    } else if (role === "verifikator" && id_user !== "nLw9Qf7iJxTQ1t1J8rwQd" && id_user !== "yRDjzhMBvRBDZxTcKNbAR") {
      // verifikator -> kepala ruangan & chief nursing
      const kepalaId = laporanData.ruangan?.kepala_ruangan?.id_user;

      let kepalaEmail = null;
      if (kepalaId) {
        const { data: kepalaUser } = await supabase
          .from("users")
          .select("email")
          .eq("id_user", kepalaId)
          .maybeSingle();

        kepalaEmail = kepalaUser?.email;
      }

      const { data: chiefNursingList } = await supabase
        .from("users")
        .select("email")
        .eq("role", "chief_nursing");

      const targets = [];
      if (kepalaEmail) targets.push({ email: kepalaEmail });
      targets.push(...(chiefNursingList || []));

      for (const u of targets) {
        const emailContent = emailTemplates.revisi(
          kode_laporan,
          catatan,
          link,
          "verifikator"
        );

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      }

    } else if (role === "chief_nursing" && id_user !== "pJtJf-p7bOmpJo0tHxNb9") {
      // chief nursing -> verifikator
      const { data: verifikatorList } = await supabase
        .from("users")
        .select("email")
        .eq("role", "verifikator");

      for (const u of verifikatorList || []) {
        const emailContent = emailTemplates.revisi(
          kode_laporan,
          catatan,
          link,
          "chief_nursing"
        );

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      }
    }

    return res.status(200).json({
      message: "Laporan berhasil di-revisi"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}



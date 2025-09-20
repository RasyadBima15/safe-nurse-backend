import { supabase } from '../../config/db.js';
import { generateKodeLaporan } from '../../utils/generateKodeLaporan.js';
import { hitungSkor } from '../../utils/scoring.js';
import { requiredFieldsForConfirmation, requiredFieldsForAI } from '../../utils/requiredFields.js';
import { callGeminiAPI, validateChronologyAPI } from '../../config/geminiAI.js';
import { nanoid } from 'nanoid'; 
import { sendWA } from '../../config/wa.js'
import { parseTanggal, parseTanggalDateOnly } from '../../utils/parseTanggal.js';

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
      .select("id_aksi, aksi, kategori, grading, rekomendasi_tindakan, created_at")
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
      .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
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
    // const latestCatatanVerifikator = allHistoryCatatan?.find(h => h.users?.role === "verifikator");

    // Helper kasih label "updated"
    const markUpdated = (obj) => ({
      kategori: obj?.kategori ? obj.kategori + " (Updated)" : laporan.kategori,
      grading: obj?.grading ? obj.grading + " (Updated)" : laporan.grading,
      rekomendasi_tindakan: obj?.rekomendasi_tindakan
        ? obj.rekomendasi_tindakan + " (Updated)"
        : laporan.rekomendasi_tindakan
    });

    // 5. Tentukan nilai kategori, grading, rekomendasi_tindakan berdasarkan role
    let override = {
      kategori: laporan.kategori,
      grading: laporan.grading,
      rekomendasi_tindakan: laporan.rekomendasi_tindakan
    };

    if (role === "kepala_ruangan") {
      if (latestKepala) override = markUpdated(latestKepala);
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    if (role === "chief_nursing") {
      if (latestKepala) override = latestKepala; // default dari kepala_ruangan
      if (latestChief) override = markUpdated(latestChief);
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    if (role === "verifikator") {
      if (latestKepala) override = latestKepala; // default dari kepala_ruangan
      if (latestVerifikator) override = markUpdated(latestVerifikator);
    }

    // Apply override ke laporan dengan fallback "-"
    laporan.kategori = override.kategori || "-";
    laporan.grading = override.grading || "-";
    laporan.rekomendasi_tindakan = override.rekomendasi_tindakan || "-";

    // 6. Siapkan extra validasi khusus untuk verifikator
    let extraValidasi = {};
    if (role === "verifikator") {
    extraValidasi = {
        validasi_kepala_ruangan: {
        kategori: latestKepala?.kategori || "-",
        grading: latestKepala?.grading || "-",
        rekomendasi_tindakan: latestKepala?.rekomendasi_tindakan || "-",
        catatan: latestCatatanKepala?.catatan || "-"
        },
        validasi_chief_nursing: {
        kategori: latestChief?.kategori || "-",
        grading: latestChief?.grading || "-",
        rekomendasi_tindakan: latestChief?.rekomendasi_tindakan || "-",
        catatan: latestCatatanChief?.catatan || "-"
        }
    };
    }

    // 7. Response
    return res.status(200).json({
      message: "Data laporan berhasil diambil.",
      data: {
        ...laporan,
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
    const { role, id_ruangan } = req.user; // dari middleware

    let query = supabase
      .from("laporan")
      .select(`
        judul_insiden,
        tgl_waktu_pelaporan,
        perawat(nama_perawat)
      `);

    if (role === "kepala_ruangan") {
      query = query
        .eq("status", "diteruskan ke validator")
        .eq("id_ruangan", id_ruangan);
    } else if (role === "chief_nursing") {
      query = query.eq("status", "diteruskan ke verifikator");
    } else if (role === "verifikator") {
      query = query.eq("status", "diteruskan ke verifikator");
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
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(nama_perawat),
        ruangan:id_ruangan(nama_ruangan)
      `)
      // .or("status.eq.diteruskan ke verifikator, status.eq.laporan disetujui verifikator, status.eq.laporan disetujui chief nursing")
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) {
      throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    }
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk Chief Nursing" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // --- Default dari laporan dulu
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          rekomendasi_tindakan: laporan.rekomendasi_tindakan || "-"
        };

        // --- Ambil history aksi terbaru untuk kepala_ruangan, chief_nursing, verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "chief_nursing", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          // Hierarki: kepala_ruangan -> chief_nursing -> verifikator
          const latestKepala = allHistoryAksi.find((a) => a.users?.role === "kepala_ruangan");
          const latestChief = allHistoryAksi.find((a) => a.users?.role === "chief_nursing");
          const latestVerif = allHistoryAksi.find((a) => a.users?.role === "verifikator");

          if (latestKepala) {
            override.kategori = latestKepala.kategori || override.kategori;
            override.grading = latestKepala.grading || override.grading;
            override.rekomendasi_tindakan =
              latestKepala.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
          if (latestChief) {
            override.kategori = latestChief.kategori || override.kategori;
            override.grading = latestChief.grading || override.grading;
            override.rekomendasi_tindakan =
              latestChief.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
          if (latestVerif) {
            override.kategori = latestVerif.kategori || override.kategori;
            override.grading = latestVerif.grading || override.grading;
            override.rekomendasi_tindakan =
              latestVerif.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
        }

        // --- Ambil catatan terbaru per role ---
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
          rekomendasi_tindakan: override.rekomendasi_tindakan || "-",
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

export async function getAllLaporanForVerifikator(req, res) {
  try {
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat:id_perawat(id_perawat, nama_perawat),
        ruangan:id_ruangan(id_ruangan, nama_ruangan)
      `)
      // .or("status.eq.diteruskan ke verifikator, status.eq.laporan disetujui verifikator, status.eq.laporan disetujui chief nursing")
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) {
      throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    }
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk Verifikator" });
    }

    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // --- Default dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          rekomendasi_tindakan: laporan.rekomendasi_tindakan || "-"
        };

        // --- Ambil history aksi terbaru untuk kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const latestKepala = allHistoryAksi.find((a) => a.users?.role === "kepala_ruangan");
          const latestVerif = allHistoryAksi.find((a) => a.users?.role === "verifikator");

          if (latestKepala) {
            override.kategori = latestKepala.kategori || override.kategori;
            override.grading = latestKepala.grading || override.grading;
            override.rekomendasi_tindakan =
              latestKepala.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
          if (latestVerif) {
            override.kategori = latestVerif.kategori || override.kategori;
            override.grading = latestVerif.grading || override.grading;
            override.rekomendasi_tindakan =
              latestVerif.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
        }

        // --- Ambil catatan terbaru untuk 3 role ---
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
          rekomendasi_tindakan: override.rekomendasi_tindakan || "-",
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
          rekomendasi_tindakan: laporan.rekomendasi_tindakan || "-"
        };

        // --- Ambil history aksi terbaru untuk kepala_ruangan & verifikator
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const latestKepala = allHistoryAksi.find((a) => a.users?.role === "kepala_ruangan");
          const latestVerif = allHistoryAksi.find((a) => a.users?.role === "verifikator");

          if (latestKepala) {
            override.kategori = latestKepala.kategori || override.kategori;
            override.grading = latestKepala.grading || override.grading;
            override.rekomendasi_tindakan =
              latestKepala.rekomendasi_tindakan || override.rekomendasi_tindakan;
          }
          if (latestVerif) {
            override.kategori = latestVerif.kategori || override.kategori;
            override.grading = latestVerif.grading || override.grading;
            override.rekomendasi_tindakan =
              latestVerif.rekomendasi_tindakan || override.rekomendasi_tindakan;
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
          rekomendasi_tindakan: override.rekomendasi_tindakan || "-",
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
          rekomendasi_tindakan: laporan.rekomendasi_tindakan || "-"
        };

        // --- Ambil history aksi terbaru dari kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const latest = allHistoryAksi[0]; // 🔥 ambil yang terbaru
          override.kategori = latest.kategori || override.kategori;
          override.grading = latest.grading || override.grading;
          override.rekomendasi_tindakan =
            latest.rekomendasi_tindakan || override.rekomendasi_tindakan;
        }

        // --- Ambil history catatan terbaru per role ---
        const { data: allHistoryCatatan } = await supabase
          .from("history_catatan")
          .select("catatan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          rekomendasi_tindakan: override.rekomendasi_tindakan || "-",
          catatan_kepala_ruangan: latestKepala?.catatan || "-",
          catatan_chief_nursing: latestChief?.catatan || "-",
          catatan_verifikator: latestVerif?.catatan || "-"
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
    const { id_ruangan } = req.user;
    if (!id_ruangan) {
      return res.status(400).json({ message: "ID Ruangan wajib diisi" });
    }

    // Ambil semua laporan berdasarkan ruangan
    const { data: laporanList, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        *,
        perawat(nama_perawat),
        ruangan(nama_ruangan)
      `)
      .eq("id_ruangan", id_ruangan)
      .order("tgl_waktu_pelaporan", { ascending: false });

    if (laporanError) throw new Error(`Gagal mengambil data laporan: ${laporanError.message}`);
    if (!laporanList || laporanList.length === 0) {
      return res.status(404).json({ message: "Tidak ada laporan untuk ruangan ini" });
    }

    // Proses setiap laporan
    const laporanWithOverride = await Promise.all(
      laporanList.map(async (laporan) => {
        // Default override dari laporan
        let override = {
          kategori: laporan.kategori || "-",
          grading: laporan.grading || "-",
          rekomendasi_tindakan: laporan.rekomendasi_tindakan || "-"
        };

        // --- Ambil history aksi terbaru dari kepala_ruangan & verifikator ---
        const { data: allHistoryAksi } = await supabase
          .from("history_aksi")
          .select("kategori, grading, rekomendasi_tindakan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .in("users.role", ["kepala_ruangan", "verifikator"])
          .order("created_at", { ascending: false });

        if (allHistoryAksi && allHistoryAksi.length > 0) {
          const latest = allHistoryAksi[0]; // 🔥 ambil yang terbaru
          override.kategori = latest.kategori || override.kategori;
          override.grading = latest.grading || override.grading;
          override.rekomendasi_tindakan =
            latest.rekomendasi_tindakan || override.rekomendasi_tindakan;
        }

        // --- Ambil history catatan terbaru per role ---
        const { data: allHistoryCatatan } = await supabase
          .from("history_catatan")
          .select("catatan, created_at, users(role)")
          .eq("kode_laporan", laporan.kode_laporan)
          .order("created_at", { ascending: false });

        const latestKepala = allHistoryCatatan?.find((c) => c.users?.role === "kepala_ruangan");
        const latestChief = allHistoryCatatan?.find((c) => c.users?.role === "chief_nursing");
        const latestVerif = allHistoryCatatan?.find((c) => c.users?.role === "verifikator");

        return {
          ...laporan,
          kategori: override.kategori || "-",
          grading: override.grading || "-",
          rekomendasi_tindakan: override.rekomendasi_tindakan || "-",
          catatan_kepala_ruangan: latestKepala?.catatan || "-",
          catatan_chief_nursing: latestChief?.catatan || "-",
          catatan_verifikator: latestVerif?.catatan || "-"
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

        const { data: cleanedData, usage } = await callGeminiAPI(body);

        // console.log("Data berhasil diolah oleh AI:", cleanedData);

        if (usage && usage.promptTokenCount) {
            console.log(`Monitoring Penggunaan Token: ${usage.promptTokenCount} token digunakan untuk input.`);
        }

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
    const { chronology } = req.body;

    // 2. Validasi input: pastikan 'chronology' tidak kosong
    if (!chronology || chronology.trim() === '') {
        // Jika kosong, kirim respon error 400 (Bad Request)
        return res.status(400).json({ 
            message: 'Input "chronology" tidak boleh kosong.' 
        });
    }

    try {
        // 3. Panggil fungsi yang sudah kita buat sebelumnya
        //    Gunakan 'await' karena fungsi ini bersifat asynchronous
        const result = await validateChronologyAPI(chronology);

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
                status: "diteruskan ke validator",
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

        console.log(ruangan?.kepala_ruangan[0]?.id_user)
        console.log(ruangan.kepala_ruangan[0].id_user)

        // Notif ke kepala ruangan (hanya 1 orang dari data ruangan)
        if (ruangan?.kepala_ruangan[0]?.id_user) {
            notifikasi.push({
                id_notifikasi: nanoid(),
                id_user: ruangan.kepala_ruangan[0].id_user,
                message: `Ada laporan baru dengan kode ${kode_laporan} dari perawat di ruangan Anda.`,
            });
        }

        // Notif ke semua Chief Nursing & Verifikator
        usersData
            .filter((u) => ["chief_nursing", "verifikator"].includes(u.role))
            .forEach((u) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: u.id_user,
                    message: `Ada laporan baru dengan kode ${kode_laporan}.`,
                });
            });

        // Simpan semua notifikasi
        const { error: notifError } = await supabase.from("notifikasi").insert(notifikasi);

        if (notifError) {
            return res.status(500).json({ error: notifError.message });
        }

        //tambahkan notifikasi WA ke kepala ruangan

        return res.status(200).json({
            message: "Laporan berhasil dibuat & notifikasi terkirim",
            data: laporan,
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function sendWANotification(req, res){
    try {
        const pengirim = "Pengguna A";
        const penerimaB = "628871293167";
        const pesanDariA = "Halo B, ini pesan dikirim via node-fetch!";

        await sendWA(penerimaB, pengirim, pesanDariA);

        return res.status(200).json({
            message: "Berhasil terkirim!!!"
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function tambahCatatan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { catatan } = req.body;
    const { id_user, role } = req.user;

    if (!kode_laporan || !catatan?.trim()) {
      return res.status(400).json({ message: "Kode Laporan dan Catatan wajib diisi" });
    }

    const { data: laporan, error: laporanError } = await supabase
      .from("laporan")
      .select(`
        status,
        perawat(id_user, nama_perawat),
        ruangan(id_ruangan, kepala_ruangan(id_user, nama_kepala_ruangan))
      `)
      .eq("kode_laporan", kode_laporan)
      .single();

    if (laporanError) throw new Error(`Gagal cek laporan: ${laporanError.message}`);
    if (!laporan) return res.status(404).json({ message: "Laporan tidak ditemukan" });

    const catatanInsert = {
      id_catatan: nanoid(),
      kode_laporan,
      id_user,
      catatan: catatan.trim(),
    };
    const { error: catatanError } = await supabase.from("history_catatan").insert([catatanInsert]);
    if (catatanError) throw new Error(`Gagal insert history_catatan: ${catatanError.message}`);

    let notifikasi = [];

    if (role === "kepala_ruangan") {
    // kepala ruangan → hanya ke perawat
    notifikasi.push({
        id_notifikasi: nanoid(),
        id_user: laporan.perawat.id_user,
        message: `Catatan dari kepala ruangan: ${catatan.trim()}`,
    });

    // notifikasi khusus untuk dirinya sendiri
    notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Catatan Anda untuk laporan ${kode_laporan} berhasil dikirim.`,
    });

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
            message: `Catatan dari kepala ruangan: ${catatan.trim()}`,
            });
    });
    } else if (role === "verifikator" || role === "chief_nursing") {
    // verifikator & chief nursing → broadcast ke semua pihak
    const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id_user, role");

    if (usersError) throw new Error(`Gagal ambil users: ${usersError.message}`);

    const targetIds = new Set();

    // Perawat laporan
    if (laporan.perawat?.id_user) targetIds.add(laporan.perawat.id_user);

    // Kepala ruangan laporan
    if (laporan.ruangan?.kepala_ruangan?.length > 0) {
        laporan.ruangan.kepala_ruangan.forEach((k) => targetIds.add(k.id_user));
    }

    // Semua chief nursing & verifikator
    usersData.forEach((u) => {
        if (["chief_nursing", "verifikator"].includes(u.role)) {
        targetIds.add(u.id_user);
        }
    });

    // Broadcast ke semua target (kecuali diri sendiri)
    notifikasi = Array.from(targetIds)
        .filter((uid) => uid !== id_user)
        .map((uid) => ({
        id_notifikasi: nanoid(),
        id_user: uid,
        message: `Catatan dari ${role.replace("_", " ")}: ${catatan.trim()}`,
        }));

    // Notifikasi khusus untuk dirinya sendiri
    notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Catatan Anda untuk laporan ${kode_laporan} berhasil dikirim.`,
    });
    }

    // Insert jika ada notifikasi
    if (notifikasi.length > 0) {
    const { error: notifError } = await supabase.from("notifikasi").insert(notifikasi);
    if (notifError) throw new Error(`Gagal insert notifikasi: ${notifError.message}`);
    }

    return res.status(200).json({
      message: "Catatan berhasil ditambahkan."
    });
  } catch (error) {
    console.error("tambahCatatan error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function rejectLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const id_user = req.user?.id_user;

    if (!kode_laporan) {
      return res.status(400).json({ message: "Kode Laporan wajib diisi" });
    }

    // Ambil laporan
    const { data: laporan, error: laporanError } = await supabase
      .from("laporan")
      .select("id_perawat, status, kategori, grading, rekomendasi_tindakan, perawat(id_user, nama_perawat)")
      .eq("kode_laporan", kode_laporan)
      .single();

    if (laporanError) throw new Error(`Gagal cek laporan: ${laporanError.message}`);
    if (!laporan) return res.status(404).json({ message: "Laporan tidak ditemukan" });

    if (laporan.status === "laporan disetujui verifikator") {
      return res.status(400).json({ message: "Status laporan tidak valid untuk ditolak" });
    }

    // Update status laporan
    const { data: laporanUpdate, error: updateError } = await supabase
      .from("laporan")
      .update({ status: "laporan ditolak validator" })
      .eq("kode_laporan", kode_laporan)
      .select("*, perawat(nama_perawat, id_user)")
      .single();

    if (updateError) throw new Error(`Gagal update laporan: ${updateError.message}`);

    // Insert history_aksi
    const aksiInsert = {
      id_aksi: nanoid(),
      kode_laporan,
      id_user,
      aksi: "tolak",
    };
    const { error: aksiError } = await supabase.from("history_aksi").insert([aksiInsert]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // 🔔 Notifikasi
    let notifikasi = [];

    // 1. Ke perawat laporan
    if (laporan.perawat?.id_user) {
      notifikasi.push({
        id_notifikasi: nanoid(),
        id_user: laporan.perawat.id_user,
        message: `Laporan dengan kode ${kode_laporan} ditolak oleh kepala ruangan.`,
      });
    }

    // 2. Ke dirinya sendiri
    notifikasi.push({
      id_notifikasi: nanoid(),
      id_user,
      message: `Anda berhasil menolak laporan dengan kode ${kode_laporan}.`,
    });

    // ke chief nursing dan verifikator
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
            message: `Laporan dengan kode ${kode_laporan} ditolak oleh kepala ruangan.`,
          });
        });

    // Simpan semua notifikasi
    if (notifikasi.length > 0) {
      const { error: notifError } = await supabase.from("notifikasi").insert(notifikasi);
      if (notifError) throw new Error(`Gagal insert notifikasi: ${notifError.message}`);
    }

    return res.status(200).json({
      message: "Laporan berhasil ditolak.",
    });
  } catch (error) {
    console.error("rejectLaporan error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function approveLaporan(req, res) {
  try {
    const { kode_laporan } = req.params;
    const { role, id_user } = req.user;
    if (!kode_laporan) {
      return res.status(400).json({ message: "Kode Laporan wajib diisi" });
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
    if (role === "kepala_ruangan" && laporanData.status === "laporan disetujui verifikator") {
      return res.status(400).json({ message: "Status laporan tidak valid untuk disetujui oleh kepala_ruangan" });
    }

    if (role === "chief_nursing" &&
        ["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      return res.status(400).json({ message: "Status laporan tidak valid untuk disetujui oleh chief_nursing" });
    }

    if (
    role === "verifikator" &&
    !["diteruskan ke verifikator", "laporan disetujui verifikator", "laporan disetujui chief nursing"].includes(laporanData.status)
    ) {
    return res.status(400).json({
        message: "Status laporan tidak valid untuk disetujui oleh verifikator",
    });
    }

    let newStatus = null;
    if (role === "kepala_ruangan") newStatus = "diteruskan ke verifikator";
    if (role === "verifikator") newStatus = "laporan disetujui verifikator";
    if (role === "chief_nursing") newStatus = "laporan disetujui chief nursing";

    // ✅ Update laporan (status only, kecuali chief_nursing)
    let laporanUpdate = laporanData;
    if (newStatus) {
      const { data, error: updateError } = await supabase
        .from("laporan")
        .update({ status: newStatus })
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

    // 📝 Insert history_aksi
    const { error: aksiError } = await supabase.from("history_aksi").insert([
    {
        id_aksi: nanoid(),
        id_user,
        kode_laporan,
        aksi: "validasi",
        kategori: laporanUpdate.kategori,
        grading: laporanUpdate.grading,
        rekomendasi_tindakan: laporanUpdate.rekomendasi_tindakan
    }
    ]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // 🔔 Kirim notifikasi
    const notifikasi = [];

    // Notifikasi umum
    if (role === "kepala_ruangan") {
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

    } else if (role === "verifikator") {
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

    } else if (role === "chief_nursing") {
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

        notifikasi.push(
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.perawat.id_user,
                message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh chief nursing.`,
            },
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.ruangan.kepala_ruangan[0].id_user,
                message: `Laporan dengan kode ${kode_laporan} telah disetujui oleh chief nursing.`,
            }
        );

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
        const { kategori, grading, rekomendasi_tindakan } = req.body;
        const { role, id_user } = req.user;

        if (!kode_laporan) {
            return res.status(400).json({ message: "Kode Laporan wajib diisi" });
        }
        if (!role) {
            return res.status(400).json({ message: "Role wajib diisi" });
        }
        if (!kategori || !grading || !rekomendasi_tindakan) {
            return res.status(400).json({
                message: "Kategori, grading, dan rekomendasi_tindakan wajib diisi",
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
    if (role === "kepala_ruangan" && laporanData.status === "laporan disetujui verifikator") {
      return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh kepala_ruangan" });
    }

    if (role === "chief_nursing" &&
        ["laporan ditolak validator", "diteruskan ke validator", "laporan disetujui verifikator"].includes(laporanData.status)) {
      return res.status(400).json({ message: "Status laporan tidak valid untuk direvisi oleh chief_nursing" });
    }

    if (
    role === "verifikator" &&
    !["diteruskan ke verifikator", "laporan disetujui verifikator", "laporan disetujui chief nursing"].includes(laporanData.status)
    ) {
    return res.status(400).json({
        message: "Status laporan tidak valid untuk direvisi oleh verifikator",
    });
    }


    let newStatus = null;
    if (role === "kepala_ruangan") newStatus = "diteruskan ke verifikator";
    if (role === "verifikator") newStatus = "laporan disetujui verifikator";
    if (role === "chief_nursing") newStatus = "laporan disetujui chief nursing";

    // ✅ Update laporan (status only, kecuali chief_nursing)
    let laporanUpdate = laporanData;

    if (newStatus) {
      const { data, error: updateError } = await supabase
        .from("laporan")
        .update({ status: newStatus })
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

    // 📝 Insert history_aksi
    const { error: aksiError } = await supabase.from("history_aksi").insert([
    {
        id_aksi: nanoid(),
        id_user,
        kode_laporan,
        aksi: "revisi",
        kategori: kategori,
        grading: grading,
        rekomendasi_tindakan: rekomendasi_tindakan
    }
    ]);
    if (aksiError) throw new Error(`Gagal insert history_aksi: ${aksiError.message}`);

    // 🔔 Kirim notifikasi
    const notifikasi = [];

    // Notifikasi umum
    if (role === "kepala_ruangan") {
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
        message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan.`,
    });

    if (verifikatorList?.length) {
        verifikatorList.forEach((v) => {
            notifikasi.push({
                id_notifikasi: nanoid(),
                id_user: v.id_user,
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan.`,
            });
        });
    }

    if (chiefNursingList?.length) {
        chiefNursingList.forEach((c) => {
            notifikasi.push({
                id_notifikasi: nanoid(),
                id_user: c.id_user,
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh kepala ruangan.`,
            });
        });
    }

    // ✅ Notifikasi ke dirinya sendiri
    notifikasi.push({
        id_notifikasi: nanoid(),
        id_user,
        message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
    });

    //kirimkan notifikasi WA ke verifikator dan chief nursing

    } else if (role === "verifikator") {
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
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator.`,
            },
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.ruangan.kepala_ruangan[0].id_user,
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator.`,
            }
        );

        if (chiefNursingList?.length) {
            chiefNursingList.forEach((c) => {
                notifikasi.push({
                    id_notifikasi: nanoid(),
                    id_user: c.id_user,
                    message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh verifikator.`,
                });
            });
        }

        // ✅ Notifikasi ke dirinya sendiri
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user,
            message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
        });

    } else if (role === "chief_nursing") {
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

        notifikasi.push(
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.perawat.id_user,
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh chief nursing.`,
            },
            {
                id_notifikasi: nanoid(),
                id_user: laporanUpdate.ruangan.kepala_ruangan[0].id_user,
                message: `Laporan dengan kode ${kode_laporan} telah direvisi oleh chief nursing.`,
            }
        );

        // ✅ Notifikasi ke dirinya sendiri
        notifikasi.push({
            id_notifikasi: nanoid(),
            id_user,
            message: `Anda berhasil merevisi laporan dengan kode ${kode_laporan}.`,
        });

        //kirimkan notifikasi WA ke verifikator
    }

    if (notifikasi.length > 0) {
    const { error: notifError } = await supabase
        .from("notifikasi")
        .insert(notifikasi);

    if (notifError) throw new Error(`Gagal kirim notifikasi: ${notifError.message}`);
    }

    return res.status(200).json({
      message: "Laporan berhasil di-revisi"
    });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


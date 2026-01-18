import cron from "node-cron";
import { supabase } from "../config/db.js";
import { nanoid } from "nanoid";
import { transporter, emailTemplates } from "../config/email.js";

async function cekLaporanTerlambat() {
  console.log("⏳ Mengecek status laporan...");

  // Ambil laporan yang statusnya masih diteruskan ke validator
  const { data: laporan, error } = await supabase
    .from("laporan")
    .select("kode_laporan, id_ruangan, tgl_waktu_pelaporan, status")
    .eq("status", "diteruskan ke validator");

  if (error) {
    console.error("Gagal fetch laporan:", error);
    return;
  }

  const now = new Date();

  for (const l of laporan) {
    const dibuat = new Date(l.tgl_waktu_pelaporan);
    const selisihJam = (now - dibuat) / (1000 * 60 * 60);

    // Ambil status terbaru (mencegah race condition)
    const { data: terbaru } = await supabase
      .from("laporan")
      .select("status")
      .eq("kode_laporan", l.kode_laporan)
      .single();

    if (!terbaru) continue;

    const latestStatus = terbaru.status;

    // Stop jika status berubah
    const statusStop = [
      "diteruskan ke verifikator",
      "laporan ditolak validator",
      "laporan disetujui verifikator",
      "laporan disetujui chief nursing",
    ];

    if (statusStop.includes(latestStatus)) {
      console.log(`⛔ Laporan ${l.kode_laporan} status berubah → skip`);
      continue;
    }

    // === NOTIFIKASI 1×24 JAM ===
    if (selisihJam >= 24 && selisihJam < 48) {
      const notifMsg = `⚠️ Laporan ${l.kode_laporan} tersisa 1×24 jam lagi untuk divalidasi agar dapat dikirim ke Unit Mutu.`;

      // Cek duplikasi notif berdasarkan message
      const { data: exists } = await supabase
        .from("notifikasi")
        .select("id_notifikasi")
        .eq("message", notifMsg)
        .limit(1);

      if (!exists || exists.length === 0) {
        await kirimNotifikasi(notifMsg, l.id_ruangan, l.kode_laporan);
        console.log(`⚠️ Notifikasi 1×24 jam dikirim untuk ${l.kode_laporan}`);
      }
    }

    // === NOTIFIKASI TELAT 2×24 JAM ===
    if (selisihJam >= 48) {
      const notifMsg = `🚨 Laporan ${l.kode_laporan} terlambat divalidasi lebih dari 2×24 jam.`;

      // Cek duplikasi notif
      const { data: exists } = await supabase
        .from("notifikasi")
        .select("id_notifikasi")
        .eq("message", notifMsg)
        .limit(1);

      if (!exists || exists.length === 0) {
        await kirimNotifikasi(notifMsg, l.id_ruangan, l.kode_laporan);
        console.log(`🚨 Notifikasi keterlambatan dikirim untuk ${l.kode_laporan}`);
      }
    }
  }
}

// ===================================================================
// 🔥 Fungsi Kirim Notifikasi → chief_nursing & kepala ruangan (by id_ruangan)
// ===================================================================
async function kirimNotifikasi(message, idRuanganLaporan, kode_laporan) {
  try {
    // === Ambil chief nursing ===
    const { data: chiefList, error: chiefError } = await supabase
      .from("users")
      .select("id_user")
      .eq("role", "chief_nursing");

    if (chiefError) {
      console.error("❌ Error ambil chief nursing:", chiefError);
      return;
    }

    const safeChief = Array.isArray(chiefList) ? chiefList : [];

    // === Ambil kepala ruangan lewat tabel ruangan ===
    const { data: ruangan, error: ruangError } = await supabase
      .from("ruangan")
      .select("id_kepala_ruangan")
      .eq("id_ruangan", idRuanganLaporan)
      .single();

    if (ruangError || !ruangan?.id_kepala_ruangan) {
      console.warn("⚠️ Ruangan tidak punya kepala ruangan");
    }

    let kepalaUserIds = [];

    if (ruangan?.id_kepala_ruangan) {
      const { data: kepala, error: kepalaError } = await supabase
        .from("kepala_ruangan")
        .select("id_user")
        .eq("id_kepala_ruangan", ruangan.id_kepala_ruangan)
        .single();

      if (!kepalaError && kepala?.id_user) {
        kepalaUserIds.push(kepala.id_user);
      }
    }

    const allUserIds = [
      ...safeChief.map(c => c.id_user),
      ...kepalaUserIds,
    ];

    if (allUserIds.length === 0) {
      console.warn("⚠️ Tidak ada penerima notifikasi");
      return;
    }

    // === Insert notifikasi ===
    await supabase.from("notifikasi").insert(
      allUserIds.map(uid => ({
        id_notifikasi: nanoid(),
        id_user: uid,
        message,
        status: "belum_dibaca",
      }))
    );

    console.log(`📨 Notifikasi disimpan untuk ${allUserIds.length} user`);

    // === Ambil email user ===
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id_user, email, role")
      .in("id_user", allUserIds);

    if (userError || !Array.isArray(userData)) {
      console.error("❌ Gagal ambil data user:", userError);
      return;
    }

    const linkKepala = `${process.env.FRONTEND_URL}/laporan-masuk-kepala-ruangan`;
    const linkChief = `${process.env.FRONTEND_URL}/laporan-masuk-chiefnursing`;

    for (const u of userData) {
      if (!u.email) continue;

      const link = u.role === "kepala_ruangan" ? linkKepala : linkChief;
      const tipeAlert = message.includes("1×24") ? "24" : "48";

      try {
        const emailContent = emailTemplates.alert(
          kode_laporan,
          link,
          u.role,
          tipeAlert
        );

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: u.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        console.log(`📧 Email terkirim ke ${u.email}`);
      } catch (mailErr) {
        console.error("❌ Gagal kirim email:", mailErr);
      }
    }
  } catch (err) {
    console.error("🔥 Fatal error kirimNotifikasi:", err);
  }
}

// Cron berjalan setiap 10 menit
cron.schedule("*/10 * * * *", () => {
  cekLaporanTerlambat();
});

export default cekLaporanTerlambat;
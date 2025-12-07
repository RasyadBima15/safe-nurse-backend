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
        await kirimNotifikasi(notifMsg, l.id_ruangan);
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
        await kirimNotifikasi(notifMsg, l.id_ruangan);
        console.log(`🚨 Notifikasi keterlambatan dikirim untuk ${l.kode_laporan}`);
      }
    }
  }
}

// ===================================================================
// 🔥 Fungsi Kirim Notifikasi → chief_nursing & kepala ruangan (by id_ruangan)
// ===================================================================
async function kirimNotifikasi(message, idRuanganLaporan) {
  // Ambil user chief_nursing
  const { data: chiefList, error: e1 } = await supabase
    .from("users")
    .select("id_user")
    .eq("role", "chief_nursing");

  if (e1) {
    console.error("Gagal fetch chief nursing:", e1);
    return;
  }

  // Ambil kepala ruangan dengan id_ruangan yang sama
  const { data: kepalaList, error: e2 } = await supabase
    .from("kepala_ruangan")
    .select("id_user")
    .eq("id_ruangan", idRuanganLaporan);

  if (e2) {
    console.error("Gagal fetch kepala ruangan:", e2);
    return;
  }

  // Gabungkan penerima
  const idUsers = [
    ...chiefList.map(u => u.id_user),
    ...kepalaList.map(u => u.id_user)
  ];

  if (idUsers.length === 0) {
    console.warn("⚠️ Tidak ada penerima notifikasi (tidak ada chief/kepala ruangan).");
    return;
  }

  // Insert notifikasi
  await supabase.from("notifikasi").insert(
    idUsers.map(uid => ({
      id_notifikasi: nanoid(),
      id_user: uid,
      message,
      status: "belum_dibaca"
    }))
  );

  console.log(`📨 Notifikasi dikirim ke ${idUsers.length} user`);

  const link_kepala_ruangan = `${process.env.FRONTEND_URL}/laporan-masuk-kepala-ruangan`;
  const link_chief_nursing = `${process.env.FRONTEND_URL}/laporan-masuk-chiefnursing`;

  for (const u of idUsers) {
    if (!u.email) continue;

    try {
      const link =
      u.role === "kepala_ruangan"
        ? link_kepala_ruangan
        : link_chief_nursing;

      const emailContent = emailTemplates.notifikasi(
        kode_laporan,
        link,
        u.role // chief_nursing atau kepala_ruangan
      );

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: u.email,
        subject: emailContent.subject,
        html: emailContent.html,
      });

      console.log(`📧 Email notifikasi terkirim ke ${u.email}`);
    } catch (err) {
      console.error("❌ Gagal mengirim email:", err);
    }
  }
}

// Cron berjalan setiap 10 menit
cron.schedule("*/10 * * * *", () => {
  cekLaporanTerlambat();
});

export default cekLaporanTerlambat;
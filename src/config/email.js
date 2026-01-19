import { createTransport } from 'nodemailer';

const roleDisplayName = {
  perawat: "Perawat",
  kepala_ruangan: "Kepala Ruangan",
  chief_nursing: "Chief Nursing",
  verifikator: "Verifikator",
  super_admin: "Super Admin",
};

export const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export const emailTemplates = {
  passwordReset: (resetLink) => ({
    subject: 'Reset Password - SAFE-Nurse',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3B82F6; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SAFE-Nurse</h1>
          <p style="margin: 10px 0 0 0;">Reset Password Request</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937; margin-bottom: 20px;">👋 Hai!</h2>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Kami menerima permintaan untuk mereset password akun SAFE-Nurse Anda.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            Atau copy link berikut ke browser Anda:
          </p>
          
          <p style="color: #3B82F6; word-break: break-all; font-size: 14px;">
            ${resetLink}
          </p>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="color: #dc2626; margin: 0; font-size: 14px;">
              <strong>Peringatan:</strong> Link ini akan expired dalam 5 menit. 
              Jika Anda tidak meminta reset password, abaikan email ini.
            </p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© 2025 SAFE-Nurse. Semua hak dilindungi.</p>
        </div>
      </div>
    `
  }),
  notifikasi: (kodeLaporan, link, dari = null) => {
    let subject = "Notifikasi Laporan - SAFE-Nurse";
    let message = "";

    if (dari === null) {
      // default (misalnya saat laporan pertama kali dibuat oleh perawat)
      message = `Ada laporan baru dengan kode <strong>${kodeLaporan}</strong> dari perawat di ruangan Anda. Segera lakukan tindak lanjut.`;
    } else if (dari === "kepala_ruangan") {
      message = `Laporan dengan kode <strong>${kodeLaporan}</strong> telah disetujui oleh kepala ruangan. Segera lakukan tindak lanjut.`;
    } else if (dari === "chief_nursing") {
      message = `Laporan dengan kode <strong>${kodeLaporan}</strong> telah disetujui oleh chief nursing. Segera lakukan tindak lanjut.`;
    } else if (dari === "verifikator") {
      message = `Laporan dengan kode <strong>${kodeLaporan}</strong> telah disetujui oleh verifikator. Segera review laporan.`; 
    }

    return {
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">SAFE-Nurse</h1>
            <p style="margin: 10px 0 0 0;">Notifikasi Laporan</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-bottom: 20px;">📢 Pemberitahuan</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
              ${message}
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" 
                style="background-color: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Lihat Laporan
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px; text-align: center;">
              Atau buka link berikut di browser Anda:<br>
              <span style="color: #059669; word-break: break-all;">${link}</span>
            </p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">© 2025 SAFE-Nurse. Semua hak dilindungi.</p>
          </div>
        </div>
      `
    };
  },
  revisi: (kodeLaporan, catatan, link, role) => {
    const subject = "Notifikasi Revisi Laporan - SAFE-Nurse";
    let message = "";

    switch (role) {
      case "kepala_ruangan":
        message = `
          Laporan dengan kode <strong>${kodeLaporan}</strong> telah
          <strong>direvisi oleh Kepala Ruangan</strong>.
        `;
        break;

      case "verifikator":
        message = `
          Laporan dengan kode <strong>${kodeLaporan}</strong> telah
          <strong>direvisi oleh Verifikator</strong>.
        `;
        break;

      case "chief_nursing":
        message = `
          Laporan dengan kode <strong>${kodeLaporan}</strong> telah
          <strong>direvisi oleh Chief Nursing</strong>.
        `;
        break;

      default:
        message = `
          Laporan dengan kode <strong>${kodeLaporan}</strong> telah
          <strong>direvisi</strong>.
        `;
    }

    return {
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">SAFE-Nurse</h1>
            <p style="margin: 10px 0 0 0;">Notifikasi Revisi Laporan</p>
          </div>

          <div style="padding: 30px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-bottom: 20px;">✏️ Revisi Laporan</h2>

            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
              ${message}
            </p>

            ${
              catatan
                ? `
                  <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
                    <strong>Catatan Revisi:</strong>
                    <p style="margin: 8px 0 0 0; color: #92400e;">
                      ${catatan}
                    </p>
                  </div>
                `
                : ""
            }

            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}"
                style="background-color: #f59e0b; color: white; padding: 12px 30px;
                text-decoration: none; border-radius: 6px; display: inline-block;
                font-weight: bold;">
                Lihat Laporan
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Atau buka link berikut:<br>
              <span style="color: #f59e0b; word-break: break-all;">${link}</span>
            </p>
          </div>

          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">© 2025 SAFE-Nurse. Semua hak dilindungi.</p>
          </div>

        </div>
      `
    };
  },
  registerAccount: (email, plainPassword, role, loginLink) => {
  const displayRole = roleDisplayName[role] || role;

  return {
    subject: 'Akun SAFE-Nurse Anda Telah Dibuat',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SAFE-Nurse</h1>
          <p style="margin: 10px 0 0 0;">Akun Baru Berhasil Dibuat</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937; margin-bottom: 20px;">👋 Selamat datang di SAFE-Nurse!</h2>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Akun Anda telah berhasil didaftarkan dengan detail berikut:
          </p>

          <ul style="color: #1f2937; line-height: 1.6; margin-bottom: 20px;">
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Role:</strong> ${displayRole}</li>
          </ul>

          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">Password:</p>
            <div style="background-color: #ffffff; border: 1px solid #d1d5db; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 16px; color: #111827; text-align: center;">
              ${plainPassword}
            </div>
            <p style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
              (Salin password ini untuk login pertama kali)
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" 
              style="background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Login ke SAFE-Nurse
            </a>
          </div>

          <div style="background-color: #FEF9C3; border: 1px solid #FACC15; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="color: #92400E; margin: 0; font-size: 14px;">
              ⚠️ Demi keamanan, segera login dan ganti password Anda setelah berhasil masuk ke sistem.
            </p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© 2025 SAFE-Nurse. Semua hak dilindungi.</p>
        </div>
      </div>
    `
    };
  },
  alert: (kodeLaporan, link, role, tipe = "24") => {
    const judul =
      tipe === "24"
        ? "⚠️ Peringatan 1×24 Jam"
        : "🚨 Peringatan Keterlambatan 2×24 Jam";

    const warnaHeader = tipe === "24" ? "#F59E0B" : "#DC2626";  
    const warnaButton = tipe === "24" ? "#F59E0B" : "#DC2626";

    const pesan =
      tipe === "24"
        ? `Laporan dengan kode <strong>${kodeLaporan}</strong> tersisa <strong>1×24 jam</strong> lagi untuk divalidasi. Harap segera lakukan validasi.`
        : `Laporan dengan kode <strong>${kodeLaporan}</strong> telah terlambat divalidasi lebih dari <strong>2×24 jam</strong>. Mohon segera ditindaklanjuti.`;

    const roleDisplay =
      role === "kepala_ruangan" ? "Kepala Ruangan" : "Chief Nursing";

    return {
      subject: `${judul} - SAFE-Nurse`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${warnaHeader}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">SAFE-Nurse</h1>
            <p style="margin: 10px 0 0 0;">${judul}</p>
          </div>

          <div style="padding: 30px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-bottom: 20px;">📢 ${roleDisplay}</h2>

            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
              ${pesan}
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" 
                style="background-color: ${warnaButton}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Lihat Laporan
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Link alternatif:<br>
              <span style="color: ${warnaButton}; word-break: break-all;">${link}</span>
            </p>
          </div>

          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">© 2025 SAFE-Nurse. Semua hak dilindungi.</p>
          </div>
        </div>
      `
    };
  },
};

// export default { transporter, emailTemplates };

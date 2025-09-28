import { createTransport } from 'nodemailer';

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
              <strong>Peringatan:</strong> Link ini akan expired dalam 1 jam. 
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
  notifikasi: (role, kodeLaporan, link, dari = null) => {
    let subject = "Notifikasi Laporan - SAFE-Nurse";
    let message = "";

    if (role === "kepala_ruangan") {
      message = `Ada laporan baru dengan kode <strong>${kodeLaporan}</strong> dari perawat di ruangan Anda. Segera lakukan tindak lanjut.`;
    } else if (role === "chief_nursing" || role === "verifikator") {
      if (dari === "kepala_ruangan") {
        message = `Laporan dengan kode <strong>${kodeLaporan}</strong> telah disetujui oleh kepala ruangan. Segera lakukan tindak lanjut.`;
      } else if (dari === "chief_nursing") {
        message = `Laporan dengan kode <strong>${kodeLaporan}</strong> telah disetujui oleh chief nursing. Segera lakukan tindak lanjut.`;
      }
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
  }
};

// export default { transporter, emailTemplates };

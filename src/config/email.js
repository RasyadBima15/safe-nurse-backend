import { createTransport } from 'nodemailer';

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const emailTemplates = {
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
          <p style="margin: 0;">© 2024 SAFE-Nurse. Semua hak dilindungi.</p>
        </div>
      </div>
    `
  })
};

export default { transporter, emailTemplates };

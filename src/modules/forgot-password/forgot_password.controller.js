import { supabase } from '../../config/db.js';
import logger from '../../config/logger.js'
import { transporter, emailTemplates } from '../../config/email.js';
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getMakassarTimestamp } from '../../utils/getMakassarTimestamp.js';
import { nanoid } from 'nanoid';

export async function sendTokenThroughEmail(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email wajib diisi" });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      return res.status(500).json({ message: "Gagal cek user: " + userError.message });
    }

    if (!user) {
      return res.status(404).json({ message: "User dengan email tersebut tidak ditemukan" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const id = nanoid();

    const { error: resetError } = await supabase
      .from("password_resets")
      .upsert(
        { id, email, token: resetToken, expires_at: expiresAt },
        { onConflict: "email" }
      );

    if (resetError) {
      return res.status(500).json({ message: "Gagal menyimpan token reset: " + resetError.message });
    }

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
        const emailContent = emailTemplates.passwordReset(
            resetLink
        );

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
        });

        res.status(200).json({
            message: "Token reset password berhasil dibuat dan email terkirim"
        });

        } catch (emailError) {
        console.log("Email sending failed:", emailError.message);

        res.status(200).json({
            message: "Token reset password berhasil dibuat, tetapi email gagal dikirim",
            error: emailError.message,
        });
        }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token dan New Password baru wajib diisi" });
    }

    const now = new Date();

    // Ambil waktu lokal Asia/Makassar
    const makassarTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Makassar" })
    );

    const makassarTimeStamp = getMakassarTimestamp(makassarTime);

    const { data: resetEntry, error: resetError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .gt("expires_at", makassarTimeStamp)
      .maybeSingle();

    if (resetError) {
      return res.status(500).json({ message: "Gagal cek token: " + resetError.message });
    }
    if (!resetEntry) {
      return res.status(400).json({ message: "Token tidak valid atau sudah expired" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
 
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: hashedPassword })
      .eq("email", resetEntry.email);
    if (updateError) {
      return res.status(500).json({ message: "Gagal update password: " + updateError.message });
    }
 
    const { error: deleteError } = await supabase
      .from("password_resets")
      .delete()
      .eq("token", token);
    if (deleteError) {
      return res.status(500).json({ message: "Gagal hapus token: " + deleteError.message });
    }

    res.status(200).json({ message: "Password berhasil direset" });
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export async function changePassword(req, res) {
  try {
    const { id_user } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!id_user) {
      return res.status(400).json({ message: "id_user wajib diisi" });
    }

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Old Password dan New Password baru wajib diisi" });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id_user", id_user)
      .maybeSingle();
    if (userError) {
      return res.status(500).json({ message: "Gagal cek user: " + userError.message });
    }
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Password lama tidak sesuai" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
 
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: hashedPassword })
      .eq("id_user", id_user);
    if (updateError) {
      return res.status(500).json({ message: "Gagal update password: " + updateError.message });
    }

    res.status(200).json({ message: "Password berhasil direset" });
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}






import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../../config/db.js'
import { nanoid } from 'nanoid'
import { generatePassword } from '../../utils/generatePassword.js'
import { emailTemplates, transporter } from '../../config/email.js'

export async function register(req, res) {
  try {
    const { email, role, id_ruangan, nama, no_telp, jabatan, unit_kerja } = req.body;

    if (!email || !role || !nama) {
      return res.status(400).json({ message: "Email, role, dan nama wajib diisi" });
    }

    if (!['super_admin', 'perawat', 'kepala_ruangan', 'verifikator', 'chief_nursing'].includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    if (['perawat', 'kepala_ruangan'].includes(role) && !id_ruangan) {
      return res.status(400).json({ message: "id_ruangan wajib diisi untuk role " + role });
    }

    if (['kepala_ruangan', 'chief_nursing', 'verifikator'].includes(role) && !no_telp) {
      return res.status(400).json({ message: "no_telp wajib diisi untuk role " + role });
    }

    // ✅ Validasi tambahan field
    if (role === "kepala_ruangan" && !jabatan) {
      return res.status(400).json({ message: "jabatan wajib diisi untuk role kepala_ruangan" });
    }
    if (role === "chief_nursing" && !jabatan) {
      return res.status(400).json({ message: "jabatan wajib diisi untuk role chief_nursing" });
    }
    if (role === "verifikator" && (!jabatan || !unit_kerja)) {
      return res.status(400).json({ message: "jabatan dan unit_kerja wajib diisi untuk role verifikator" });
    }

    const id_user = nanoid();
    // const plainPassword = generatePassword(16);
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const { error: userError } = await supabase
      .from("users")
      .insert([{ id_user, email, password_hash: hashedPassword, role }]);
    if (userError) throw userError;

    if (role === "perawat") {
      await supabase.from("perawat").insert([{
        id_perawat: nanoid(),
        id_user,
        id_ruangan,
        nama_perawat: nama
      }]);

    } else if (role === "kepala_ruangan") {
      await supabase.from("kepala_ruangan").insert([{
        id_kepala_ruangan: nanoid(),
        id_user,
        id_ruangan,
        nama_kepala_ruangan: nama,
        no_telp,
        jabatan
      }]);

    } else if (role === "chief_nursing") {
      await supabase.from("chief_nursing").insert([{
        id_chief_nursing: nanoid(),
        id_user,
        nama_chief_nursing: nama,
        no_telp,
        jabatan
      }]);

    } else if (role === "verifikator") {
      await supabase.from("verifikator").insert([{
        id_verifikator: nanoid(),
        id_user,
        nama_verifikator: nama,
        no_telp,
        jabatan,
        unit_kerja
      }]);

    } else if (role === "super_admin") {
      await supabase.from("super_admin").insert([{
        id_super_admin: nanoid(),
        id_user,
        nama_super_admin: nama
      }]);
    }

    const loginLink = `${process.env.FRONTEND_URL}/login`;

    const emailContent = emailTemplates.registerAccount(email, plainPassword, role, loginLink);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    res.status(201).json({ 
      message: "User registered successfully"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        message: error ? error.message : "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let extraData = {};

    if (user.role === "perawat") {
      const { data: perawat } = await supabase
        .from("perawat")
        .select("id_perawat, id_ruangan")
        .eq("id_user", user.id_user)
        .maybeSingle();
      extraData = { ...perawat };
    } else if (user.role === "kepala_ruangan") {
      const { data: kepala } = await supabase
        .from("kepala_ruangan")
        .select("id_kepala_ruangan, id_ruangan")
        .eq("id_user", user.id_user)
        .maybeSingle();
      extraData = { ...kepala };
    } else if (user.role === "chief_nursing") {
      const { data: chief } = await supabase
        .from("chief_nursing")
        .select("id_chief_nursing")
        .eq("id_user", user.id_user)
        .maybeSingle();
      extraData = { ...chief };
    } else if (user.role === "verifikator") {
      const { data: verifikator } = await supabase
        .from("verifikator")
        .select("id_verifikator")
        .eq("id_user", user.id_user)
        .maybeSingle();
      extraData = { ...verifikator };
    }

    // Buat payload JWT sesuai role
    const payload = {
      id_user: user.id_user,
      role: user.role,
      ...extraData,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });

    // hanya kirim token
    return res.json({ token });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}



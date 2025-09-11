import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../../config/db.js'
import logger from '../../config/logger.js'
import { nanoid } from 'nanoid'

export async function register(req, res) {
  try {
    const { email, password, role, id_ruangan, nama } = req.body;

    if (!email || !password || !role || !nama) {
      return res.status(400).json({ message: "Email, password, role, dan nama wajib diisi" });
    }

    if (!['super_admin', 'perawat', 'kepala_ruangan', 'verifikator', 'ipcn'].includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    if (['perawat', 'kepala_ruangan', 'ipcn'].includes(role) && !id_ruangan) {
      return res.status(400).json({ message: "id_ruangan wajib diisi untuk role " + role });
    }

    const id_user = nanoid();
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: userError } = await supabase
      .from("users")
      .insert([{ id_user, email, password_hash: hashedPassword, role }]);

    if (userError) throw userError;

    if (role === "perawat") {
      const id_perawat = nanoid();
      const { error } = await supabase.from("perawat").insert([{
        id_perawat,
        id_user,
        id_ruangan,
        nama_perawat: nama
      }]);
      if (error) throw error;
    }

    if (role === "kepala_ruangan") {
      const id_kepala_ruangan = nanoid();
      const { error } = await supabase.from("kepala_ruangan").insert([{
        id_kepala_ruangan,
        id_user,
        id_ruangan,
        nama_kepala_ruangan: nama
      }]);
      if (error) throw error;
    }

    if (role === "ipcn") {
      const id_ipcn = nanoid();
      const { error } = await supabase.from("ipcn").insert([{
        id_ipcn,
        id_user,
        id_ruangan,
        nama_ipcn: nama
      }]);
      if (error) throw error;
    }

    if (role === "verifikator") {
      const id_verifikator = nanoid();
      const { error } = await supabase.from("verifikator").insert([{
        id_verifikator,
        id_user,
        nama_verifikator: nama
      }]);
      if (error) throw error;
    }

    if (role === "super_admin") {
      const id_super_admin = nanoid();
      const { error } = await supabase.from("super_admin").insert([{
        id_super_admin,
        id_user
      }]);
      if (error) throw error;
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error || !data) return res.status(401).json({ message: error ? error.message : 'User not found' })

    const isMatch = await bcrypt.compare(password, data.password_hash)
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign({ id: data.id }, process.env.JWT_SECRET, { expiresIn: '1h' })

    res.json({ token, id_user: data.id_user })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

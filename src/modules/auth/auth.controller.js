import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../../config/db.js'
import logger from '../../config/logger.js'

export async function register(req, res) {
  try {
    const { username, password, role} = req.body
    if (!username || !password || !role) {
      return res.status(400).json({ message: "Username, password, dan role wajib diisi" });
    }
    
    if (!['super_admin', 'perawat', 'kepala_ruangan', 'verifikator', 'ipcn'].includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { error } = await supabase
      .from('users')
      .insert([{ username, password_hash: hashedPassword, role: role }])

    if (error) throw error
    res.status(201).json({ message: 'User registered successfully' })
  } catch (error) {

    res.status(500).json({ error: error.message })
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
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

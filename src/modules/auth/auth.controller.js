import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../../config/db.js'

export async function register(req, res) {
  try {
    const { username, password, role } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)

    const { error } = await supabase
      .from('users_coba')
      .insert([{ username, password: hashedPassword, role }])

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
      .from('users_coba')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !data) return res.status(401).json({ message: 'Invalid credentials' })

    const isMatch = await bcrypt.compare(password, data.password)
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1h' })

    res.json({ token })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

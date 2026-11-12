// controllers/authController.js
const bcrypt = require('bcrypt');
const User = require('../model/userModel');
const { setSession, clearSession } = require('../middlewares/session');

// Admin & Student Login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await User.touchLastLogin(user.id);
    setSession(res, user.id);

    const studentProfile = user.role === 'STUDENT' ? await User.findStudentProfile(user.id) : null;

    return res.status(200).json({
      message: 'Login successful',
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        studentDetails: studentProfile,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

function logout(req, res) {
  clearSession(res);
  return res.status(200).json({ message: 'Logged out successfully.' });
}

module.exports = { login, logout };

// controllers/authController.js - login and logout for admins and students.
const bcrypt = require('bcrypt'); // compares a password with its stored hash
const User = require('../model/userModel');
const { setSession, clearSession } = require('../middlewares/session');

// POST /api/auth/login - Admin & Student Login.
// Passwords are never stored as text. The database holds a bcrypt hash and bcrypt.compare checks a login attempt.
async function login(req, res) {
  try {
    const { email, password } = req.body; // destructuring pulls two fields out of the JSON body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findByEmail(email);
    // The same message for "no such user" and "wrong password" stops attackers learning which emails exist.
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
    setSession(res, user.id); // sets the signed session cookie

    const studentProfile = user.role === 'STUDENT' ? await User.findStudentProfile(user.id) : null;

    // The reply holds only display details. The password hash is never sent.
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

// POST /api/auth/logout - removes the session cookie.
function logout(req, res) {
  clearSession(res);
  return res.status(200).json({ message: 'Logged out successfully.' });
}

module.exports = { login, logout };

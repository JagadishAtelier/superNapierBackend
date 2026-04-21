// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../Model/User');
const PilotUser = require('../Model/pilotuser'); // adjust path/name if your model file differs
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET is not defined in .env');
}

// helper to extract token
function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
}

// Protect middleware (for normal users)
exports.protect = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpires');
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user; // attach user
    next();
  } catch (err) {
    console.error('protect (user) error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Protect middleware (for pilots)
exports.protectPilot = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // token payload should include pilotId (or userId) when issuing pilot tokens
    const pilotId = decoded.pilotId || decoded.userId || decoded.id;
    if (!pilotId) return res.status(401).json({ message: 'Invalid token payload' });

    const pilot = await PilotUser.findById(pilotId).select('-password -otp -otpExpires');
    if (!pilot) return res.status(401).json({ message: 'Pilot not found' });

    req.pilot = pilot; // attach pilot
    next();
  } catch (err) {
    console.error('protectPilot error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Role restriction middleware (works with req.user OR req.pilot)
exports.restrictToRole = (...roles) => {
  return (req, res, next) => {
    const actor = req.user || req.pilot;
    if (!actor) return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(actor.role)) {
      return res.status(403).json({ message: 'You do not have permission' });
    }
    next();
  };
};

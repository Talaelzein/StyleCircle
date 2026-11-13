import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);

  if (!match) {
    return res.status(401).json({ error: 'Missing or invalid authentication token' });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload.sub || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

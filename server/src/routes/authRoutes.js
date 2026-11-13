import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import User from '../models/User.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { signToken } from '../utils/signToken.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const signupSchema = z.object({
  username: z.string().trim().min(2).max(50),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
}).strict();

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
}).strict();

router.post('/signup', authLimiter, validateBody(signupSchema), async (req, res) => {
  const { username, email, password } = req.validatedBody;
  const existing = await User.exists({ email });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, passwordHash });
  res.status(201).json({
    token: signToken(user._id),
    user: { id: user.id, username: user.username, email: user.email },
  });
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.validatedBody;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({
    token: signToken(user._id),
    user: { id: user.id, username: user.username, email: user.email },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: { id: user.id, username: user.username, email: user.email } });
});

export default router;

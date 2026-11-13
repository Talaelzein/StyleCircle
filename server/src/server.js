import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const { MONGO_URI, JWT_SECRET } = process.env;
if (!MONGO_URI || MONGO_URI.startsWith('REPLACE_ME') ||
    !JWT_SECRET || JWT_SECRET.startsWith('REPLACE_ME') || JWT_SECRET.length < 32) {
  console.error('Configure MONGO_URI and a random JWT_SECRET (32+ characters) in server/.env first.');
  process.exit(1);
}

try {
  await connectDB();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`StyleCircle API listening on http://localhost:${port}`));
} catch (err) {
  console.error('MongoDB error:', err.name, err.message);
  process.exit(1);
}

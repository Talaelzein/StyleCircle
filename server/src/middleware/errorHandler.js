export function errorHandler(err, req, res, next) {
  // Invalid JSON body from express.json().
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'That value is already registered' });
  }

  console.error('Unexpected server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
}

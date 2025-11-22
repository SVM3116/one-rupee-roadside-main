const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Middleware to verify Supabase access token and attach user to req.user
 * If SUPABASE_URL + SUPABASE_ANON_KEY are present, calls Supabase /auth/v1/user
 * Fallback: when env vars are missing, treat the Bearer token itself as a uid (dev only).
 */
module.exports = async function verifySupabase(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    let token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    // Log whether Authorization header is present
    // eslint-disable-next-line no-console
    console.debug('[verifySupabase] Authorization header present:', Boolean(auth));

    // If no token provided and Supabase is not configured, allow dev fallback using mechanicId from body/query
    if (!token) {
      if (!SUPABASE_URL) {
        const devUid = (req.body && req.body.mechanicId) || req.query?.mechanicId || null;
        if (devUid) {
          // eslint-disable-next-line no-console
          console.debug('[verifySupabase] using mechanicId from body/query as dev uid fallback:', devUid);
          token = devUid;
        } else {
          // No token and no dev uid: reject
          return res.status(401).json({ error: 'Missing Authorization token or mechanicId (dev fallback)' });
        }
      } else {
        return res.status(401).json({ error: 'Missing Authorization token' });
      }
    }

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const resp = await axios.get(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });
        // resp.data should be the user object
        req.user = resp.data;
        // eslint-disable-next-line no-console
        console.debug('[verifySupabase] Supabase token verified, user id:', req.user?.id);
        return next();
      } catch (err) {
        console.error('Supabase token verification failed', err?.response?.data || err.message || err);
        // In dev mode, if Supabase verification fails but we have a token, use it as fallback
        if (process.env.NODE_ENV === 'development' || !SUPABASE_URL) {
          console.warn('[verifySupabase] Supabase verification failed, using token as uid fallback (dev mode)');
          req.user = { id: token };
          return next();
        }
        return res.status(401).json({ error: 'Invalid Supabase token' });
      }
    }

    // Dev fallback: treat token string as uid
    console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set. Using token as uid fallback (dev only).');
    // eslint-disable-next-line no-console
    console.debug('[verifySupabase] using token-as-uid fallback, uid=', token);
    req.user = { id: token };
    return next();
  } catch (err) {
    console.error('verifySupabase middleware error', err);
    return res.status(500).json({ error: 'Auth middleware error' });
  }
};

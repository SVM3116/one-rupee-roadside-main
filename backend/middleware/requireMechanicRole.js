/**
 * Middleware: requireMechanicRole
 * Ensures req.user exists (set by verifySupabase) and that the user has role 'mechanic'
 * Checks: req.user.user_metadata.role OR req.user.role
 */
module.exports = function requireMechanicRole(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // If Supabase isn't configured in this environment, allow toggling in dev mode
    if (!process.env.SUPABASE_URL || process.env.NODE_ENV === 'development') {
      console.warn('SUPABASE_URL not set or dev mode — allowing mechanic actions in dev-mode fallback', { id: user.id });
      return next();
    }

    const metaRole = (user.user_metadata && user.user_metadata.role) || user.role || null;
    if (metaRole === 'mechanic') return next();

    // In dev mode, if we can't verify role, allow access
    if (process.env.NODE_ENV === 'development') {
      console.warn('Cannot verify mechanic role in dev mode, allowing access', { id: user.id });
      return next();
    }

    console.warn('Access denied: user does not have mechanic role', { id: user.id, metaRole });
    return res.status(403).json({ error: 'Forbidden: mechanic role required' });
  } catch (err) {
    console.error('requireMechanicRole middleware error', err);
    return res.status(500).json({ error: 'Server error in role check' });
  }
};

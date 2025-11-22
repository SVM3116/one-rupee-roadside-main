/**
 * Middleware: requireAdminRole
 * Ensures req.user exists (set by verifySupabase) and that the user has role 'admin'
 * Checks: req.user.user_metadata.role OR req.user.role
 */
module.exports = function requireAdminRole(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // If Supabase isn't configured in this environment, allow admin actions in dev mode
    if (!process.env.SUPABASE_URL) {
      console.warn('SUPABASE_URL not set — allowing admin actions in dev-mode fallback', { id: user.id });
      return next();
    }

    const metaRole = (user.user_metadata && user.user_metadata.role) || user.role || null;
    if (metaRole === 'admin') return next();

    console.warn('Access denied: user does not have admin role', { id: user.id, metaRole });
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  } catch (err) {
    console.error('requireAdminRole middleware error', err);
    return res.status(500).json({ error: 'Server error in role check' });
  }
};


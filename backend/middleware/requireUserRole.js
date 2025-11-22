/**
 * Middleware: requireUserRole
 * Ensures req.user exists (set by verifySupabase) and that the user has role 'traveler' or 'user'
 * Checks: req.user.user_metadata.role OR req.user.role
 */
module.exports = function requireUserRole(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // If Supabase isn't configured in this environment, allow user actions in dev mode
    if (!process.env.SUPABASE_URL) {
      console.warn('SUPABASE_URL not set — allowing user actions in dev-mode fallback', { id: user.id });
      return next();
    }

    const metaRole = (user.user_metadata && user.user_metadata.role) || user.role || null;
    // Allow traveler, user, or if no role is set (default to user)
    if (metaRole === 'traveler' || metaRole === 'user' || !metaRole) return next();

    console.warn('Access denied: user does not have user/traveler role', { id: user.id, metaRole });
    return res.status(403).json({ error: 'Forbidden: user/traveler role required' });
  } catch (err) {
    console.error('requireUserRole middleware error', err);
    return res.status(500).json({ error: 'Server error in role check' });
  }
};


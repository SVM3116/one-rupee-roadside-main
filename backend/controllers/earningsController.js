const { supabase } = require('../utils/supabase');

/**
 * GET /api/earnings
 * Get mechanic's earnings
 */
exports.getEarnings = async (req, res) => {
  try {
    const mechanicId = req.user?.id;
    if (!mechanicId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { start_date, end_date, limit = 50 } = req.query;

    let query = supabase
      .from('mechanic_earnings')
      .select(`
        *,
        job_requests!inner(
          id,
          vehicle_type,
          issue_description,
          status,
          created_at
        )
      `)
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: earnings, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, earnings: earnings || [] });
  } catch (err) {
    console.error('getEarnings error:', err);
    return res.status(500).json({ error: 'Failed to fetch earnings', details: err.message });
  }
};

/**
 * GET /api/earnings/stats
 * Get earnings statistics
 */
exports.getEarningsStats = async (req, res) => {
  try {
    const mechanicId = req.user?.id;
    if (!mechanicId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { period = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const { data: earnings, error } = await supabase
      .from('mechanic_earnings')
      .select('net_amount, commission_amount, payment_status')
      .eq('mechanic_id', mechanicId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    const stats = {
      total_earnings: 0,
      total_commission: 0,
      paid_earnings: 0,
      pending_earnings: 0,
      job_count: earnings?.length || 0,
    };

    if (earnings) {
      earnings.forEach(earning => {
        stats.total_earnings += parseFloat(earning.net_amount || 0);
        stats.total_commission += parseFloat(earning.commission_amount || 0);
        if (earning.payment_status === 'paid') {
          stats.paid_earnings += parseFloat(earning.net_amount || 0);
        } else {
          stats.pending_earnings += parseFloat(earning.net_amount || 0);
        }
      });
    }

    return res.json({ success: true, stats, period });
  } catch (err) {
    console.error('getEarningsStats error:', err);
    return res.status(500).json({ error: 'Failed to fetch earnings stats', details: err.message });
  }
};

/**
 * GET /api/earnings/transactions
 * Get transaction history
 */
exports.getTransactions = async (req, res) => {
  try {
    const mechanicId = req.user?.id;
    if (!mechanicId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = 50, type } = req.query;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, transactions: transactions || [] });
  } catch (err) {
    console.error('getTransactions error:', err);
    return res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
};

/**
 * GET /api/earnings/admin/summary
 * Get all earnings summary (admin only)
 */
exports.getAdminSummary = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = supabase
      .from('mechanic_earnings')
      .select(`
        *,
        profiles!inner(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: earnings, error } = await query;

    if (error) {
      throw error;
    }

    const summary = {
      total_earnings: 0,
      total_commission: 0,
      total_payouts: 0,
      mechanic_count: new Set(),
      job_count: earnings?.length || 0,
      by_mechanic: {},
    };

    if (earnings) {
      earnings.forEach(earning => {
        const mechanicId = earning.mechanic_id;
        summary.mechanic_count.add(mechanicId);
        
        summary.total_earnings += parseFloat(earning.amount || 0);
        summary.total_commission += parseFloat(earning.commission_amount || 0);
        
        if (earning.payment_status === 'paid') {
          summary.total_payouts += parseFloat(earning.net_amount || 0);
        }

        if (!summary.by_mechanic[mechanicId]) {
          summary.by_mechanic[mechanicId] = {
            mechanic_name: earning.profiles?.full_name || 'Unknown',
            total_earnings: 0,
            total_payouts: 0,
            job_count: 0,
          };
        }

        summary.by_mechanic[mechanicId].total_earnings += parseFloat(earning.net_amount || 0);
        summary.by_mechanic[mechanicId].job_count += 1;
        if (earning.payment_status === 'paid') {
          summary.by_mechanic[mechanicId].total_payouts += parseFloat(earning.net_amount || 0);
        }
      });
    }

    summary.mechanic_count = summary.mechanic_count.size;

    return res.json({ success: true, summary });
  } catch (err) {
    console.error('getAdminSummary error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin summary', details: err.message });
  }
};


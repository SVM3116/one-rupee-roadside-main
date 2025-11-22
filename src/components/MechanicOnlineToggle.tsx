import { useEffect, useState } from 'react';
import api, { API_BASE } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  mechanicId: string;
  onStatusChange?: (isOnline: boolean) => void;
  onToggleOnline?: (isOnline: boolean) => Promise<void>; // New callback for location sharing
}

const MechanicOnlineToggle = ({ mechanicId, onStatusChange, onToggleOnline }: Props) => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get(`/api/mechanic/online-status/${mechanicId}`);
        if (!mounted) return;
        setIsOnline(Boolean(res.data?.status?.isOnline));
        setBackendAvailable(true);
      } catch (err) {
        // If backend returns 404 (no mechanic doc yet), treat as offline so toggle is usable
        // Otherwise show an error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e: any = err;
        if (e?.response?.status === 404) {
          setIsOnline(false);
        } else {
          console.error('Failed to load online status', err);
          // When backend is not reachable, avoid spamming toasts; show inline state instead
          setBackendAvailable(false);
          // Set to false so UI doesn't get stuck in loading state
          setIsOnline(false);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [mechanicId]);

  const toggle = async () => {
    if (isOnline === null) return;
    setLoading(true);
    const next = !isOnline;
    // Optimistic UI update
    setIsOnline(next);

    if (!backendAvailable) {
      // Prevent toggling while backend is down
      toast.error('Mechanic service is unavailable — unable to change online status');
      setIsOnline(!next);
      setLoading(false);
      return;
    }

    try {
      // Quick ping to ensure backend reachable and CORS/preflight OK
      try {
        await api.get('/api/mechanic/ping');
        setBackendAvailable(true);
      } catch (pingErr) {
        console.error('Backend ping failed before toggle', pingErr);
        // mark backend unavailable and abort toggle
        setBackendAvailable(false);
        throw new Error('backend_unreachable');
      }
      // get current access token from Supabase
      let token: string | null = null;
      try {
        const s = await supabase.auth.getSession();
        token = s?.data?.session?.access_token || null;
      } catch (e) {
        // ignore
        token = null;
      }

      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      // Debug: log token presence and request URL to help diagnose network failures
      // eslint-disable-next-line no-console
      console.debug('[MechanicOnlineToggle] toggle request', { url: `${API_BASE || ''}/api/mechanic/toggle-online`, hasToken: Boolean(token) });

      const body: any = { isOnline: next };
      if (!token) {
        // in dev-mode fallback, pass mechanicId so the backend can accept the request without a Supabase token
        body.mechanicId = mechanicId;
      }

      const res = await api.post('/api/mechanic/toggle-online', body, { headers });
      const newStatus = Boolean(res.data?.mechanic?.isOnline);
      setIsOnline(newStatus);
      
      // CRITICAL: Update Supabase profiles table directly to ensure it's synced
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const now = new Date().toISOString();
          const { error: supabaseError } = await supabase
            .from('profiles')
            .update({ 
              availability_status: newStatus ? 'online' : 'offline',
              updated_at: now
            })
            .eq('id', mechanicId);
          
          if (supabaseError) {
            console.error('[MechanicOnlineToggle] Failed to update Supabase profile:', supabaseError);
            toast.error('Failed to update status in database');
            setIsOnline(!next); // Revert
            setLoading(false);
            return;
          } else {
            console.log('[MechanicOnlineToggle] Successfully updated Supabase profile availability_status to:', newStatus ? 'online' : 'offline');
          }
        }
      } catch (supabaseErr) {
        console.error('[MechanicOnlineToggle] Error updating Supabase:', supabaseErr);
        toast.error('Failed to update status');
        setIsOnline(!next); // Revert
        setLoading(false);
        return;
      }
      
      // Notify parent component of status change FIRST
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
      
      // CRITICAL: If going online, start location sharing automatically
      // If going offline, stop location sharing
      if (onToggleOnline) {
        try {
          console.log(`[MechanicOnlineToggle] Calling onToggleOnline with status: ${newStatus}`);
          await onToggleOnline(newStatus);
        } catch (locationErr) {
          console.error('[MechanicOnlineToggle] Error with location sharing:', locationErr);
          // Don't revert online status if location fails - mechanic can still be online
          toast.warning('Status updated but location sharing failed. Please try manually.');
        }
      }
      
      // Show success message
      toast.success(newStatus ? 'You are now online and ready to receive jobs!' : 'You are now offline');
    } catch (err) {
      // Provide detailed error info in console and toast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: any = err;
      console.error('Failed to toggle online (axios):', e);

      // If we intentionally threw a backend_unreachable error, show clearer message
      if (String(e?.message) === 'backend_unreachable') {
        toast.error('Mechanic service unreachable — check the mechanic service is running');
        // backendAvailable already set to false above; revert optimistic UI
        setIsOnline(!next);
        setLoading(false);
        return;
      }

      // If network error (no response), try a fetch fallback to help diagnose
      if (!e?.response) {
        try {
          // dynamic import of API_BASE to avoid cycles
          const mod = await import('@/lib/api');
          const base: string = mod.API_BASE || window.location.origin;
            const headers: Record<string,string> = { 'Content-Type': 'application/json' };
            try {
              const s = await supabase.auth.getSession();
              const token = s?.data?.session?.access_token;
              if (token) headers.Authorization = `Bearer ${token}`;
            } catch (e) {
              // ignore
            }

            const fallback = await fetch(`${base}/api/mechanic/toggle-online`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ isOnline: next }),
            });

          if (fallback.ok) {
            const json = await fallback.json();
            const newStatus = Boolean(json?.mechanic?.isOnline);
            setIsOnline(newStatus);
            // Notify parent component of status change
            if (onStatusChange) {
              onStatusChange(newStatus);
            }
            toast.success('Online status updated (fallback)');
            setLoading(false);
            return;
          } else {
            const text = await fallback.text();
            console.error('Fallback fetch failed:', fallback.status, text);
            toast.error(`Failed to update online status: ${fallback.status}`);
          }
        } catch (fetchErr) {
          console.error('Fetch fallback error:', fetchErr);
          toast.error('Network error: failed to reach backend');
        }
      } else {
        // We have a response from server — show status and message if available
        const status = e.response.status;
        const data = e.response.data;
        console.error('Server response error:', status, data);
        const msg = data?.error || data?.message || JSON.stringify(data);
        if (status === 403) {
          toast.error('Forbidden: mechanic role required to change online status');
        } else if (status === 401) {
          toast.error('Unauthorized: please sign in again');
        } else {
          toast.error(`Failed to update online status: ${status} ${msg}`);
        }
      }

      // Revert optimistic update
      setIsOnline(!next);
    } finally {
      setLoading(false);
    }
  };

  // Render
  if (isOnline === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
        <div className="text-sm text-muted-foreground">Loading status...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <div className={`text-sm font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
          {isOnline ? 'You are Online' : 'You are Offline'}
        </div>
        <div className="text-xs text-muted-foreground">Toggle to change availability</div>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        aria-pressed={isOnline}
        aria-disabled={!backendAvailable || loading}
        className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-6 w-6 transform bg-white rounded-full shadow-md transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>

      {/* Inline message when backend is down */}
      {!backendAvailable && (
        <div className="ml-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span>Mechanic service unavailable — toggle disabled.</span>
            <button
              type="button"
              className="ml-2 underline"
              onClick={async () => {
                // simple retry: attempt ping
                try {
                  await api.get('/api/mechanic/ping');
                  setBackendAvailable(true);
                  toast.success('Mechanic service is reachable');
                } catch (e) {
                  setBackendAvailable(false);
                  toast.error('Still unreachable');
                }
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MechanicOnlineToggle;

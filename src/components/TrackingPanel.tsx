import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MapPin, Navigation, CheckCircle, Phone, Settings, User } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ChatButton from './ChatButton';

interface JobRequest {
  id: string;
  status: string;
  mechanic_id: string | null;
  issue_description: string | null;
  vehicle_type: string | null;
  created_at: string;
  mechanic_name?: string | null;
  mechanic_phone?: string | null;
  mechanic_photo?: string | null;
}

interface TrackingPanelProps {
  userId: string;
  onTrackingStart?: (mechanicId: string, jobId: string) => void;
  getUnreadCount?: (requestId: string) => number;
  onChatOpen?: (requestId: string) => void;
  onChatClose?: () => void;
}

const TrackingPanel = ({ userId, onTrackingStart, getUnreadCount, onChatOpen, onChatClose }: TrackingPanelProps) => {
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveJob();

    const channel = supabase
      .channel(`job-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_requests',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📨 TrackingPanel: Job update received:', payload);
          const newData = payload.new as JobRequest;
          const oldData = payload.old as any;

          setActiveJob(newData);

          // Handle all status changes, not just 'on_the_way'
          if (payload.eventType === 'UPDATE') {
            const oldStatus = oldData?.status;
            const newStatus = newData.status;

            if (oldStatus !== newStatus) {
              console.log(`📢 TrackingPanel: Status changed ${oldStatus} → ${newStatus}`);

              // Trigger tracking for any active status
              if (newData.status !== 'completed' && newData.status !== 'cancelled' && newData.mechanic_id) {
                onTrackingStart?.(newData.mechanic_id, newData.id);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 TrackingPanel subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onTrackingStart]);

  const fetchActiveJob = async () => {
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Fetch mechanic profile if mechanic is assigned
      if (data && data.mechanic_id) {
        const { data: mechanicProfile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, phone, profile_photo')
          .eq('id', data.mechanic_id)
          .maybeSingle();

        if (!profileError && mechanicProfile) {
          const profile = mechanicProfile as any;
          (data as any).mechanic_name = profile.full_name;
          (data as any).mechanic_phone = profile.phone;
          (data as any).mechanic_photo = profile.profile_photo;
        }
      }

      setActiveJob(data);

      // Start tracking for any active status (not completed/cancelled)
      if (data && data.status !== 'completed' && data.status !== 'cancelled' && data.mechanic_id) {
        onTrackingStart?.(data.mechanic_id, data.id);
      }
    } catch (error) {
      console.error('Error fetching active job:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!activeJob) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', className: 'bg-yellow-600' },
      accepted: { label: 'Accepted', className: 'bg-blue-600' },
      on_the_way: { label: 'On The Way', className: 'bg-green-600' },
      reached_destination: { label: 'Reached', className: 'bg-green-600' },
      repair_started: { label: 'Repair Started', className: 'bg-orange-600' },
      repair_completed: { label: 'Repair Completed', className: 'bg-green-600' },
      completed: { label: 'Completed', className: 'bg-gray-600' },
      rejected: { label: 'Rejected', className: 'bg-red-600' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-600' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-600' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getCardStyle = (status: string) => {
    const styles = {
      pending: 'from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
      accepted: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
      on_the_way: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800',
      reached_destination: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',
      repair_started: 'from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
      repair_completed: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
      completed: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
    };
    return styles[status as keyof typeof styles] || 'from-gray-50 to-gray-100 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Settings className="h-12 w-12 text-yellow-600 animate-spin-slow drop-shadow-xl" />;
      case 'accepted':
        return <CheckCircle className="h-12 w-12 text-blue-600 animate-bounce drop-shadow-xl" />;
      case 'on_the_way':
        return <Navigation className="h-12 w-12 text-orange-600 animate-pulse drop-shadow-xl" />;
      case 'reached_destination':
        return <MapPin className="h-12 w-12 text-purple-600 animate-bounce drop-shadow-xl" />;
      case 'repair_started':
        return <Settings className="h-12 w-12 text-yellow-600 animate-spin-slow drop-shadow-xl" />;
      case 'repair_completed':
        return <CheckCircle className="h-12 w-12 text-green-600 animate-bounce drop-shadow-xl" />;
      case 'completed':
        return <CheckCircle className="h-12 w-12 text-green-600 drop-shadow-xl" />;
      default:
        return <MapPin className="h-12 w-12 text-gray-600" />;
    }
  };

  return (
    <div className="relative group h-full">
      {/* Animated Glow Effect */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${getCardStyle(activeJob.status).split(' ')[0].replace('50', '400').replace('100', '600')} rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt`}></div>

      <Card className={`relative bg-gradient-to-br ${getCardStyle(activeJob.status)} border-2 shadow-xl overflow-hidden h-full flex flex-col justify-center`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rotate-45 transform"></div>

        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              Job Status
            </span>
            {getStatusBadge(activeJob.status)}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-2 pb-4 px-4 flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Animated Icon Container */}
            <div className="relative p-3 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-sm shadow-inner">
              {getStatusIcon(activeJob.status)}
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-lg sm:text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {activeJob.status === 'pending' && 'Finding a mechanic...'}
                {activeJob.status === 'accepted' && 'Mechanic Accepted! 🚀'}
                {activeJob.status === 'on_the_way' && 'Mechanic is On The Way! 🚗💨'}
                {activeJob.status === 'reached_destination' && 'Mechanic Arrived! 📍'}
                {activeJob.status === 'repair_started' && 'Repair in Progress... 🔧'}
                {activeJob.status === 'repair_completed' && 'Repair Completed! 🎉'}
                {activeJob.status === 'completed' && 'Job Completed! ✅'}
                {!['pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed', 'completed'].includes(activeJob.status) &&
                  `Status: ${activeJob.status.replace('_', ' ')}`}
              </h3>
              <p className="text-sm font-medium text-muted-foreground">
                {activeJob.vehicle_type && <span className="inline-flex items-center gap-1 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-md text-xs">🚗 {activeJob.vehicle_type}</span>}
              </p>
              {activeJob.issue_description && (
                <p className="text-xs text-muted-foreground max-w-xs mx-auto bg-white/40 dark:bg-black/10 p-1.5 rounded-lg italic line-clamp-2">
                  "{activeJob.issue_description}"
                </p>
              )}
            </div>

            {/* Mechanic Details */}
            {activeJob.mechanic_id && activeJob.status !== 'pending' && (activeJob.mechanic_name || activeJob.mechanic_phone) && (
              <div className="w-full mt-4 p-3 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-lg border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Assigned Mechanic</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={activeJob.mechanic_photo || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {activeJob.mechanic_name?.charAt(0).toUpperCase() || 'M'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm text-foreground">
                      {activeJob.mechanic_name || 'Mechanic'}
                    </p>
                    {activeJob.mechanic_phone && (
                      <a
                        href={`tel:${activeJob.mechanic_phone}`}
                        className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Phone className="h-3 w-3" />
                        {activeJob.mechanic_phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {['on_the_way', 'reached_destination', 'repair_started', 'repair_completed'].includes(activeJob.status) && (
              <p className="text-xs text-green-600 font-bold animate-pulse">
                Track the mechanic's location on the map above
              </p>
            )}

            {activeJob.mechanic_id && (
              <div className="w-full mt-2">
                <ChatButton
                  requestId={activeJob.id}
                  userId={userId}
                  unreadCount={getUnreadCount ? getUnreadCount(activeJob.id) : 0}
                  onOpen={onChatOpen ? () => onChatOpen(activeJob.id) : undefined}
                  onClose={onChatClose}
                  senderType="user"
                  className="w-full h-12 shadow-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackingPanel;

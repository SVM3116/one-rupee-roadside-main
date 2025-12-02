import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MapPin, Navigation, CheckCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
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
}

const TrackingPanel = ({ userId, onTrackingStart, getUnreadCount, onChatOpen }: TrackingPanelProps) => {
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
          data.mechanic_name = mechanicProfile.full_name;
          data.mechanic_phone = mechanicProfile.phone;
          data.mechanic_photo = mechanicProfile.profile_photo;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_the_way':
        return <Navigation className="h-12 w-12 text-green-600 animate-pulse" />;
      case 'accepted':
        return <CheckCircle className="h-12 w-12 text-blue-600" />;
      case 'reached_destination':
        return <MapPin className="h-12 w-12 text-green-600" />;
      case 'repair_started':
      case 'repair_completed':
        return <CheckCircle className="h-12 w-12 text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      default:
        return <MapPin className="h-12 w-12 text-yellow-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Job Status</span>
          {getStatusBadge(activeJob.status)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center text-center space-y-4">
          {getStatusIcon(activeJob.status)}

          <div>
            <h3 className="font-semibold text-lg">
              {activeJob.status === 'pending' && 'Finding a mechanic...'}
              {activeJob.status === 'accepted' && 'Mechanic Accepted Your Request!'}
              {activeJob.status === 'on_the_way' && 'Mechanic is On The Way!'}
              {activeJob.status === 'reached_destination' && 'Mechanic Has Reached Your Location!'}
              {activeJob.status === 'repair_started' && 'Repair in Progress...'}
              {activeJob.status === 'repair_completed' && 'Repair Completed!'}
              {activeJob.status === 'completed' && 'Job Completed!'}
              {!['pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed', 'completed'].includes(activeJob.status) &&
                `Status: ${activeJob.status.replace('_', ' ')}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {activeJob.vehicle_type && `Vehicle: ${activeJob.vehicle_type}`}
            </p>
            {activeJob.issue_description && (
              <p className="text-sm text-muted-foreground">
                Issue: {activeJob.issue_description}
              </p>
            )}
          </div>

          {/* Mechanic Details - Show after accepting */}
          {activeJob.mechanic_id && activeJob.status !== 'pending' && (activeJob.mechanic_name || activeJob.mechanic_phone) && (
            <div className="w-full mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-2">Assigned Mechanic</p>
              <div className="flex items-center gap-3">
                {activeJob.mechanic_photo ? (
                  <img
                    src={activeJob.mechanic_photo}
                    alt={activeJob.mechanic_name || 'Mechanic'}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {activeJob.mechanic_name?.charAt(0).toUpperCase() || 'M'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm text-green-900 dark:text-green-100">
                    {activeJob.mechanic_name || 'Mechanic'}
                  </p>
                  {activeJob.mechanic_phone && (
                    <a
                      href={`tel:${activeJob.mechanic_phone}`}
                      className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
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
            <p className="text-sm text-green-600 font-medium">
              Track the mechanic's location on the map above
            </p>
          )}

          {activeJob.mechanic_id && (
            <div className="mt-4">
              <ChatButton
                requestId={activeJob.id}
                userId={userId}
                unreadCount={getUnreadCount ? getUnreadCount(activeJob.id) : 0}
                onOpen={onChatOpen ? () => onChatOpen(activeJob.id) : undefined}
                senderType="user"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingPanel;

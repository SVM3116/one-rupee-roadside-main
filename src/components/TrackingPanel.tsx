import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MapPin, Navigation, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface JobRequest {
  id: string;
  status: string;
  mechanic_id: string | null;
  issue_description: string | null;
  vehicle_type: string | null;
  created_at: string;
}

interface TrackingPanelProps {
  userId: string;
  onTrackingStart?: (mechanicId: string, jobId: string) => void;
}

const TrackingPanel = ({ userId, onTrackingStart }: TrackingPanelProps) => {
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
      completed: { label: 'Completed', className: 'bg-gray-600' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_the_way':
        return <Navigation className="h-12 w-12 text-green-600 animate-pulse" />;
      case 'accepted':
        return <CheckCircle className="h-12 w-12 text-blue-600" />;
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
              {activeJob.status === 'on_the_way' && 'Help is on the way!'}
              {activeJob.status === 'accepted' && 'Request Accepted'}
              {activeJob.status === 'pending' && 'Finding a mechanic...'}
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

          {activeJob.status === 'on_the_way' && (
            <p className="text-sm text-green-600 font-medium">
              Track the mechanic's location on the map above
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingPanel;

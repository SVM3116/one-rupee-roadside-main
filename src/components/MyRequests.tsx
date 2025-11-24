import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, Navigation, AlertCircle, Star, MapPin } from "lucide-react";
import { toast } from "sonner";
import { RatingDialog } from "./RatingDialog";
import ChatButton from "./ChatButton";
import { SkeletonList } from "./SkeletonCard";

interface JobRequest {
  id: string;
  vehicle_type: string;
  issue_description: string;
  status: string;
  created_at: string;
  mechanic_id: string | null;
  updated_at?: string;
}

interface RequestWithRating extends JobRequest {
  hasRating: boolean;
}

interface MyRequestsProps {
  userId: string;
  getUnreadCount?: (requestId: string) => number;
  onChatOpen?: (requestId: string) => void;
  openChatRequestId?: string | null;
}

const MyRequests = ({ userId, getUnreadCount, onChatOpen, openChatRequestId }: MyRequestsProps) => {
  const [requests, setRequests] = useState<RequestWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithRating | null>(null);

  useEffect(() => {
    fetchRequests();
    const cleanup = setupRealtimeSubscription();
    return () => {
      if (cleanup) cleanup();
    };
  }, [userId]);

  // Periodically check for assigned-but-pending requests and reassign if mechanic doesn't accept
  useEffect(() => {
    const ACCEPT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    const INTERVAL_MS = 10 * 1000; // check every 10s

    const interval = setInterval(async () => {
      try {
        const now = Date.now();
        const pendingAssigned = requests.filter(r => r.status === 'pending' && r.mechanic_id && r.updated_at);

        for (const req of pendingAssigned) {
          const assignedAt = new Date(req.updated_at!).getTime();
          const elapsed = now - assignedAt;
          if (elapsed >= ACCEPT_TIMEOUT_MS) {
            // Attempt reassignment: find next nearest mechanic (similar to RequestAssistanceForm logic)
            try {
              const { data: locations } = await supabase
                .from('mechanic_locations')
                .select('mechanic_id, latitude, longitude');

              if (!locations || locations.length === 0) {
                console.warn('No mechanic locations available for reassignment');
                continue;
              }

              const toRad = (deg: number) => (deg * Math.PI) / 180;
              const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371000;
                const dLat = toRad(lat2 - lat1);
                const dLon = toRad(lon2 - lon1);
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
              };

              // We need the user_location for this request to compute distances
              const { data: jobRow } = await supabase
                .from('job_requests')
                .select('user_location')
                .eq('id', req.id)
                .single();

              const userLoc = jobRow?.user_location;
              if (!userLoc) continue;

              const candidates = (locations || [])
                .map((loc: any) => ({ mechanic_id: loc.mechanic_id, dist: distanceMeters(userLoc.lat, userLoc.lng, Number(loc.latitude), Number(loc.longitude)) }))
                .filter((c: any) => c.mechanic_id !== req.mechanic_id) // exclude current mechanic
                .sort((a: any, b: any) => a.dist - b.dist);

              if (candidates.length === 0) {
                console.warn('No alternate mechanics found for reassignment');
                continue;
              }

              // Pick first candidate (closest)
              const chosen = candidates[0].mechanic_id;

              const { error: assignError } = await supabase
                .from('job_requests')
                .update({ mechanic_id: chosen })
                .eq('id', req.id);

              if (assignError) {
                console.error('Failed to reassign job:', assignError);
              } else {
                toast.success('Mechanic did not accept in time — reassigned to another mechanic');
                // Refresh requests to show updated assignment
                fetchRequests();
              }
            } catch (err) {
              console.error('Error during reassignment:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error checking pending requests:', err);
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [requests]);

  const fetchRequests = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from("job_requests")
        .select("*, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (jobError) throw jobError;

      // Check which completed jobs have ratings
      const completedJobs = jobData?.filter(job => job.status === 'completed') || [];
      const { data: testimonials, error: testimonialsError } = await supabase
        .from("testimonials")
        .select("mechanic_id")
        .eq("user_id", userId)
        .in("mechanic_id", completedJobs.map(job => job.mechanic_id).filter(Boolean));

      if (testimonialsError) console.error("Error fetching testimonials:", testimonialsError);

      const ratedMechanics = new Set(testimonials?.map(t => t.mechanic_id) || []);
      
      const requestsWithRatings = (jobData || []).map(job => ({
        ...job,
        hasRating: job.status === 'completed' && job.mechanic_id ? ratedMechanics.has(job.mechanic_id) : false,
      }));

      setRequests(requestsWithRatings);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load your requests");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    console.log('🔔 Setting up real-time subscription for user:', userId);
    
    const channel = supabase
      .channel(`my-job-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_requests',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📨 Job request update received:', {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
          
          if (payload.eventType === 'INSERT') {
            const newRequest = payload.new as JobRequest;
            console.log('➕ New request inserted:', newRequest.id);
            setRequests(prev => [{ ...newRequest, hasRating: false }, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRequest = payload.new as JobRequest;
            const oldRequest = payload.old as any;
            
            console.log('🔄 Request updated:', {
              id: updatedRequest.id,
              oldStatus: oldRequest?.status,
              newStatus: updatedRequest.status,
              oldMechanicId: oldRequest?.mechanic_id,
              newMechanicId: updatedRequest.mechanic_id,
            });
            
            // Update the request in the list
            setRequests(prev => {
              const updated = prev.map(req => 
                req.id === updatedRequest.id 
                  ? { ...updatedRequest, hasRating: req.hasRating } 
                  : req
              );
              console.log('✅ Updated requests list:', updated);
              return updated;
            });
            
            // Notify user of status changes
            const oldStatus = oldRequest?.status;
            const newStatus = updatedRequest.status;
            
            if (oldStatus !== newStatus) {
              console.log(`📢 Status changed: ${oldStatus} → ${newStatus}`);
              
              const statusMessages: Record<string, string> = {
                'accepted': 'Mechanic has accepted your request!',
                'on_the_way': 'Mechanic is on the way to your location!',
                'reached_destination': 'Mechanic has reached your location!',
                'repair_started': 'Mechanic has started the repair!',
                'repair_completed': 'Repair has been completed!',
                'completed': 'Your request has been completed!',
                'rejected': 'Mechanic rejected your request. Finding another mechanic...',
                'cancelled': 'Your request has been cancelled.',
              };
              
              const message = statusMessages[newStatus];
              if (message) {
                console.log('🔔 Showing toast:', message);
                toast.success(message);
              } else {
                console.log('⚠️ No message for status:', newStatus);
              }
              
              // Refresh if completed to show rating button
              if (newStatus === 'completed') {
                console.log('✅ Job completed, refreshing requests...');
                fetchRequests();
              }
            } else {
              console.log('ℹ️ Status unchanged:', newStatus);
            }
            
            // Also notify when mechanic is first assigned
            if (!oldRequest?.mechanic_id && updatedRequest.mechanic_id) {
              console.log('👤 Mechanic assigned:', updatedRequest.mechanic_id);
              toast.success("A mechanic has been assigned to your request!");
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to job request updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from job request updates');
      supabase.removeChannel(channel);
    };
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pending',
      'accepted': 'Accepted',
      'on_the_way': 'On The Way',
      'reached_destination': 'Reached Destination',
      'repair_started': 'Repair Started',
      'repair_completed': 'Repair Completed',
      'completed': 'Completed',
      'rejected': 'Rejected',
      'cancelled': 'Cancelled',
    };
    return labels[status] || status.replace('_', ' ');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "on_the_way":
        return <Navigation className="h-4 w-4 text-orange-500" />;
      case "reached_destination":
        return <MapPin className="h-4 w-4 text-green-500" />;
      case "repair_started":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "repair_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "accepted":
        return "bg-blue-500";
      case "on_the_way":
        return "bg-orange-500";
      case "reached_destination":
        return "bg-green-500";
      case "repair_started":
        return "bg-yellow-500";
      case "repair_completed":
        return "bg-green-500";
      case "completed":
        return "bg-green-600";
      case "rejected":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>Loading your assistance requests...</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonList count={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl lg:text-2xl">My Requests</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Track the status of your assistance requests
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No requests yet</p>
            <p className="text-sm">Submit a request above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-3 sm:p-4 border rounded-lg space-y-2 sm:space-y-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">
                        {request.vehicle_type}
                      </Badge>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getStatusColor(request.status)} bg-opacity-20`}>
                        {getStatusIcon(request.status)}
                        <span className="text-xs font-medium">
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      {request.mechanic_id && (
                        <ChatButton 
                          requestId={request.id} 
                          userId={userId}
                          unreadCount={getUnreadCount ? getUnreadCount(request.id) : 0}
                          onOpen={onChatOpen ? () => onChatOpen(request.id) : undefined}
                          senderType="user"
                        />
                      )}
                    </div>
                    <p className="text-sm">{request.issue_description}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted: {new Date(request.created_at).toLocaleString()}
                    </p>
                    {request.mechanic_id && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Mechanic assigned
                      </p>
                    )}
                    {request.status === 'pending' && request.mechanic_id && request.updated_at && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                        <span className="text-muted-foreground">Awaiting mechanic acceptance — ETA: {
                          (() => {
                            const ACCEPT_TIMEOUT_MS = 3 * 60 * 1000;
                            const elapsed = Date.now() - new Date(request.updated_at!).getTime();
                            const remaining = Math.max(0, ACCEPT_TIMEOUT_MS - elapsed);
                            const mins = Math.floor(remaining / 60000);
                            const secs = Math.floor((remaining % 60000) / 1000);
                            return `${mins}:${secs.toString().padStart(2, '0')}`;
                          })()
                        }</span>
                      </div>
                    )}
                    {request.status === 'completed' && request.mechanic_id && !request.hasRating && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setSelectedRequest(request);
                          setRatingDialogOpen(true);
                        }}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Rate Mechanic
                      </Button>
                    )}
                    {request.status === 'completed' && request.hasRating && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ✓ Review submitted
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedRequest && (
          <RatingDialog
            open={ratingDialogOpen}
            onOpenChange={setRatingDialogOpen}
            jobRequestId={selectedRequest.id}
            mechanicId={selectedRequest.mechanic_id!}
            userId={userId}
            onRatingSubmitted={fetchRequests}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default MyRequests;

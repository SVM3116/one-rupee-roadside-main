import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Clock, CheckCircle, Loader2, User, Settings, XCircle, ExternalLink, LogOut, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import Map from "@/components/Map";
import LiveLocationTracker from "@/components/LiveLocationTracker";
import MechanicOnlineToggle from "@/components/MechanicOnlineToggle";
import ChatButton from "@/components/ChatButton";
import { SkeletonList } from "@/components/SkeletonCard";
import JobStatusManager from "@/components/JobStatusManager";
import ChatNotificationBadge from "@/components/ChatNotificationBadge";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import api from '@/lib/api';
import { SwipeButton } from "@/components/SwipeButton";

interface Job {
  id: string;
  user_id: string;
  status: string;
  vehicle_type: string;
  issue_description: string;
  user_location: {
    lat: number;
    lng: number;
  };
  created_at: string;
  user_name?: string | null;
  user_phone?: string | null;
}

const MechanicDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const lastJobCountRef = useRef<number>(0);
  const [userRole, setUserRole] = useState<'mechanic' | 'user' | null>('mechanic');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  // Chat notifications
  const {
    getUnreadCount,
    markAsRead,
    setOpenChatRequestId,
    latestNotification,
    clearLatestNotification,
    totalUnreadCount
  } = useChatNotifications(user?.id || null, userRole);

  // Stable callback for marking chat as read
  const handleChatOpen = useCallback((requestId: string) => {
    markAsRead(requestId);
    setOpenChatRequestId(requestId);
    clearLatestNotification();
  }, [markAsRead, setOpenChatRequestId, clearLatestNotification]);

  useEffect(() => {
    checkMechanicAuth();
    // Removed auto-logout on page hide/refresh to prevent blank screens
    // Session persistence is handled by Supabase automatically
  }, []);

  // Auto-start location sharing if mechanic is online on page load/refresh
  useEffect(() => {
    if (!user?.id || isSharing) return;

    const checkAndStartLocationSharing = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) return;

        const token = authSession.access_token;
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const statusRes = await api.get(`/api/mechanic/online-status/${user.id}`, { headers });
        const isOnline = Boolean(statusRes.data?.status?.isOnline);

        if (isOnline) {
          console.log("🟢 [MechanicDashboard] Mechanic is online on page load - auto-starting location sharing");
          await startLocationSharing();
        }
      } catch (statusErr: any) {
        // If 404, mechanic status not set yet (treat as offline - don't start sharing)
        // Other errors: log but don't auto-start
        if (statusErr?.response?.status !== 404) {
          console.warn('[MechanicDashboard] Could not check online status for auto-start:', statusErr);
        }
      }
    };

    // Small delay to ensure component is fully mounted and user is ready
    const timer = setTimeout(() => {
      checkAndStartLocationSharing();
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to avoid re-triggering

  useEffect(() => {
    if (!user?.id) return;

    console.log('🔧 Setting up realtime subscription for mechanic:', user.id);

    // Set up realtime subscription for new job assignments
    // CRITICAL: Listen for ALL UPDATE events and filter client-side to catch assignments
    const channel = supabase
      .channel(`job-assignments-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          // No filter - we need to catch all UPDATEs to detect mechanic_id changes
        },
        (payload) => {
          console.log('📨 Job UPDATE event received:', payload);
          const updatedJob = payload.new as Job;
          const oldJob = payload.old as any;

          // Check if this job is now assigned to this mechanic
          const isAssignedToMe = updatedJob.mechanic_id === user.id;
          const wasAssignedToMe = oldJob?.mechanic_id === user.id;
          const wasJustAssigned = !wasAssignedToMe && isAssignedToMe;

          console.log('🔍 Assignment check:', {
            jobId: updatedJob.id,
            isAssignedToMe,
            wasAssignedToMe,
            wasJustAssigned,
            newMechanicId: updatedJob.mechanic_id,
            oldMechanicId: oldJob?.mechanic_id
          });

          // If job was just assigned to this mechanic, add it to the list
          if (wasJustAssigned) {
            console.log('🆕 NEW JOB ASSIGNED TO MECHANIC:', updatedJob.id);

            // Parse user_location if it's a string
            let userLocation = updatedJob.user_location;
            if (typeof userLocation === 'string') {
              try {
                userLocation = JSON.parse(userLocation);
              } catch (e) {
                console.warn('Failed to parse user_location:', e);
                userLocation = null;
              }
            }

            // Show notification
            toast.success(
              `New job assigned! ${updatedJob.vehicle_type || 'Vehicle'} - ${updatedJob.issue_description || 'No description'}`,
              {
                duration: 5000,
              }
            );

            // Add to jobs list (check if already exists to avoid duplicates)
            setJobs(prevJobs => {
              const exists = prevJobs.some(job => job.id === updatedJob.id);
              if (exists) {
                console.log('Job already in list, updating...');
                // Update existing job
                return prevJobs.map(job =>
                  job.id === updatedJob.id
                    ? {
                      ...updatedJob,
                      user_location: userLocation as { lat: number; lng: number } | null
                    }
                    : job
                );
              } else {
                console.log('Adding new job to list');
                // Add new job at the beginning
                const newJobsList = [
                  {
                    ...updatedJob,
                    user_location: userLocation as { lat: number; lng: number } | null
                  },
                  ...prevJobs
                ];
                // Update ref
                lastJobCountRef.current = newJobsList.length;
                return newJobsList;
              }
            });

            // Refresh jobs list to ensure we have the latest data
            if (user?.id) {
              setTimeout(() => {
                fetchJobs(user.id);
              }, 500);
            }
          } else if (isAssignedToMe) {
            // Job is assigned to this mechanic - update it in the list
            console.log('🔄 Updating existing assigned job:', updatedJob.id);

            // Parse user_location if needed
            let userLocation = updatedJob.user_location;
            if (typeof userLocation === 'string') {
              try {
                userLocation = JSON.parse(userLocation);
              } catch (e) {
                userLocation = null;
              }
            }

            // Update job in list
            setJobs(prevJobs => {
              const exists = prevJobs.some(job => job.id === updatedJob.id);
              if (!exists) {
                // Job not in list but assigned to us - add it
                console.log('Job not in list but assigned to us - adding');
                const newJobsList = [
                  {
                    ...updatedJob,
                    user_location: userLocation as { lat: number; lng: number } | null
                  },
                  ...prevJobs
                ];
                // Update ref
                lastJobCountRef.current = newJobsList.length;
                return newJobsList;
              }
              // Update existing job
              return prevJobs.map(job =>
                job.id === updatedJob.id
                  ? {
                    ...updatedJob,
                    user_location: userLocation as { lat: number; lng: number } | null
                  }
                  : job
              );
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 MechanicDashboard realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to job request updates for mechanic:', user.id);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to job request updates');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Subscription timed out, retrying...');
        }
      });

    // Initialize lastJobCountRef with current jobs count
    lastJobCountRef.current = jobs.length;

    // FALLBACK: Poll for new jobs every 3 seconds as a backup if realtime doesn't work
    // This ensures jobs appear even if realtime subscription fails
    const pollInterval = setInterval(async () => {
      try {
        const { data: currentJobs, error } = await supabase
          .from("job_requests")
          .select("*")
          .eq("mechanic_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && currentJobs) {
          const currentCount = currentJobs.length;
          const lastCount = lastJobCountRef.current;

          // If we have more jobs than before, a new one was assigned
          if (currentCount > lastCount) {
            console.log('🔄 Polling detected new job assignment!', {
              previous: lastCount,
              current: currentCount
            });

            // Use functional update to get latest jobs state
            setJobs(prevJobs => {
              const existingIds = new Set(prevJobs.map(j => j.id));

              // Find the new job(s) that aren't in our list
              const newJobs = currentJobs.filter(newJob => !existingIds.has(newJob.id));

              if (newJobs.length > 0) {
                const formattedNewJobs = newJobs.map(job => {
                  let userLocation = job.user_location;
                  if (typeof userLocation === 'string') {
                    try {
                      userLocation = JSON.parse(userLocation);
                    } catch (e) {
                      userLocation = null;
                    }
                  }
                  return {
                    ...job,
                    user_location: userLocation as { lat: number; lng: number } | null
                  };
                });

                // Show notification for first new job
                if (formattedNewJobs[0]) {
                  toast.success(
                    `New job assigned! ${formattedNewJobs[0].vehicle_type || 'Vehicle'} - ${formattedNewJobs[0].issue_description || 'No description'}`,
                    { duration: 5000 }
                  );
                }

                // Update ref
                lastJobCountRef.current = currentCount;

                // Add new jobs to the list
                return [...formattedNewJobs, ...prevJobs];
              }

              // Update ref even if no new jobs (in case of reordering)
              lastJobCountRef.current = currentCount;
              return prevJobs;
            });
          } else {
            // Update ref even if count didn't increase (could be reordering)
            lastJobCountRef.current = currentCount;
          }
        }
      } catch (pollError) {
        console.error('Error polling for new jobs:', pollError);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      console.log('🔌 Cleaning up realtime subscription and polling for mechanic');
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // Only depend on user.id

  const checkMechanicAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if location is available (mandatory for mechanics)
      if (!navigator.geolocation) {
        toast.error("Location services are required. Please enable location access to receive jobs.");
        return;
      }

      // Check if user is a mechanic
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "mechanic")
        .maybeSingle();

      // If the DB lookup didn't confirm the mechanic role, fall back to auth metadata
      let isMechanic = false;
      if (roles) {
        isMechanic = roles.role === "mechanic";
      } else {
        // Check user metadata as fallback
        const metaRole = (session.user as any)?.user_metadata?.role ?? (session.user as any)?.role ?? null;
        isMechanic = metaRole === "mechanic" || metaRole === "Mechanic" || metaRole === "MECHANIC";
      }

      if (!isMechanic) {
        toast.error("Access denied. Mechanic account required.");
        navigate("/dashboard");
        return;
      }

      setUser(session.user);

      // Fetch profile to get photo and name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, profile_photo")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfilePhoto(profileData.profile_photo || null);
        setProfileName(profileData.full_name || session.user.user_metadata?.full_name || session.user.email || "Mechanic");
      } else {
        setProfileName(session.user.user_metadata?.full_name || session.user.email || "Mechanic");
      }

      fetchJobs(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Stop location sharing if active
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
        setIsSharing(false);
      }

      // Set availability to offline
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({ availability_status: "offline" })
            .eq("id", user.id);
        } catch (error) {
          console.error("Error updating availability status:", error);
        }
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear storage
      localStorage.clear();
      sessionStorage.clear();

      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Error signing out");
    }
  };

  const fetchJobs = async (mechanicId: string) => {
    try {
      // Step 1: Fetch jobs
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("mechanic_id", mechanicId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Step 2: Get unique user IDs
      const userIds = [...new Set((data || []).map(job => job.user_id).filter(Boolean))];

      // Step 3: Fetch user profiles separately
      let userProfiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", userIds);

        if (profileError) {
          console.error("Error fetching user profiles:", profileError);
        } else {
          userProfiles = profiles || [];
        }
      }

      // Step 4: Create a map of user profiles
      const profileMap = new window.Map(userProfiles.map(p => [p.id, p]));

      // Step 5: Format jobs with user data
      const formattedJobs = (data || []).map(job => {
        // Parse user_location if it's a string or ensure it's an object
        let userLocation = job.user_location;
        if (typeof userLocation === 'string') {
          try {
            userLocation = JSON.parse(userLocation);
          } catch (e) {
            // If parsing fails, try to extract from location string
            const locationMatch = job.location?.match(/([\d.]+),\s*([\d.]+)/);
            if (locationMatch) {
              userLocation = {
                lat: parseFloat(locationMatch[1]),
                lng: parseFloat(locationMatch[2])
              };
            } else {
              userLocation = null;
            }
          }
        }

        // Get user profile from map
        const userProfile = profileMap.get(job.user_id);

        return {
          ...job,
          user_location: userLocation as { lat: number; lng: number } | null,
          user_name: userProfile?.full_name || null,
          user_phone: userProfile?.phone || null,
        };
      });

      setJobs(formattedJobs);
      // Update ref with current jobs count
      lastJobCountRef.current = formattedJobs.length;
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    }
  };

  // XState integrated job status management
  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("job_requests")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (error) throw error;

      // Update local state
      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, status: newStatus } : job
      ));

      // Refresh jobs
      if (user?.id) {
        fetchJobs(user.id);
      }
    } catch (error: any) {
      console.error("Error updating job status:", error);
      toast.error(error?.message || "Failed to update job status");
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("job_requests")
        .update({
          status: "accepted",
          mechanic_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (error) throw error;

      // Refresh jobs
      fetchJobs(user.id);
      toast.success("Job accepted successfully");
    } catch (error: any) {
      console.error("Error accepting job:", error);
      toast.error(error?.message || "Failed to accept job");
    }
  };

  const handleRejectJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to reject this job? It will be reassigned to another mechanic.")) {
      return;
    }

    try {
      // Remove mechanic assignment and reset status to pending for reassignment
      const { error } = await supabase
        .from("job_requests")
        .update({
          status: "pending",
          mechanic_id: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (error) throw error;

      // Remove from jobs list since it's no longer assigned to this mechanic
      setJobs(jobs.filter(job => job.id !== jobId));

      if (user?.id) {
        fetchJobs(user.id);
      }

      toast.success("Job rejected. It will be reassigned to another mechanic.");
    } catch (error: any) {
      console.error("Error rejecting job:", error);
      toast.error(error?.message || "Failed to reject job");
    }
  };

  // XState-based status transition handlers
  const handleStatusTransition = async (jobId: string, currentStatus: string, transition: string) => {
    // Validate transition using XState machine logic
    const { canTransition } = await import('@/machines/jobStatusMachine');

    let targetStatus = '';
    switch (transition) {
      case 'ARRIVE':
        targetStatus = currentStatus === 'accepted' ? 'on_the_way' : 'reached_destination';
        break;
      case 'START_REPAIR':
        targetStatus = 'repair_started';
        break;
      case 'FINISH':
        targetStatus = currentStatus === 'repair_started' ? 'repair_completed' : 'completed';
        break;
      default:
        targetStatus = transition.toLowerCase();
    }

    if (!canTransition(currentStatus, targetStatus)) {
      toast.error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
      return;
    }

    await updateJobStatus(jobId, targetStatus);
  };

  const startLocationSharing = async () => {
    // Import geolocation utility
    const { getLocation, watchPosition, isSecureContext } = await import("@/utils/geolocation");

    // Check if we're on HTTP (non-HTTPS) - show info but still try
    if (!isSecureContext()) {
      toast.info("Requesting location access. Please allow when prompted.", {
        duration: 4000,
      });
    }

    // MANDATORY: Get initial GPS location (no IP fallback)
    // Try even on HTTP - many browsers allow it with user permission
    try {
      const location = await getLocation({
        enableHighAccuracy: true,
        timeout: 25000, // Increased timeout
        maximumAge: 30000,
      });

      // Update location immediately
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("mechanic_locations")
        .upsert({
          mechanic_id: user.id,
          latitude: location.lat,
          longitude: location.lng,
          updated_at: now,
        } as any, {
          onConflict: "mechanic_id",
        });

      if (error) throw error;

      setLastLocationAt(now);
      toast.success("Location sharing started (GPS)");
      setIsSharing(true);
    } catch (error: any) {
      console.error("Error getting initial location:", error);
      toast.error(error.userFriendlyMessage || "Failed to get GPS location. Please enable location permissions.");
      if (error.instructions) {
        toast.info(error.instructions, { duration: 6000 });
      }
      return;
    }

    // Now watch for position updates (GPS only)
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    const id = watchPosition(
      async (location) => {
        try {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("mechanic_locations")
            .upsert({
              mechanic_id: user.id,
              latitude: location.lat,
              longitude: location.lng,
              updated_at: now,
            } as any, {
              onConflict: "mechanic_id",
            });

          if (error) throw error;

          setLastLocationAt(now);
        } catch (error) {
          console.error("Error updating location:", error);
          // Don't show toast on every update error, just log it
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        // Only show error if we haven't started sharing yet
        if (!isSharing) {
          toast.error(error.userFriendlyMessage || "Failed to get location");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    if (id !== null) {
      setWatchId(id);
    }
  };

  const stopLocationSharing = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsSharing(false);
      toast.success("Location sharing stopped");
      setLastLocationAt(null);
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6">
          <SkeletonList count={4} />
        </main>
        <Footer />
      </div>
    );
  }

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
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "in_progress":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
              <AvatarImage src={profilePhoto || undefined} alt={profileName} />
              <AvatarFallback>
                {profileName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 sm:flex-none">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">Mechanic Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, {profileName}!
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {user?.id && (
              <MechanicOnlineToggle
                mechanicId={user.id}
                onStatusChange={(isOnline) => {
                  console.log(`[MechanicDashboard] Status changed to: ${isOnline ? 'online' : 'offline'}`);
                }}
                onToggleOnline={async (isOnline) => {
                  // CRITICAL: Auto-start/stop location sharing when toggle changes
                  if (isOnline) {
                    console.log("🟢 [MechanicDashboard] Mechanic went online - auto-starting location sharing");
                    if (!isSharing) {
                      await startLocationSharing();
                    }
                  } else {
                    console.log("🔴 [MechanicDashboard] Mechanic went offline - auto-stopping location sharing");
                    if (isSharing) {
                      stopLocationSharing();
                    }
                  }
                }}
              />
            )}

            <Button
              variant="outline"
              onClick={() => navigate("/mechanic/profile")}
              className="gap-2 text-xs sm:text-sm"
              size="sm"
            >
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Profile Settings</span>
              <span className="sm:hidden">Profile</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={async () => {
                try {
                  const res = await api.get('/api/mechanic/ping');
                  const { time, dbState, mechanicCount } = res.data || {};
                  toast.success(`Backend OK — dbState=${dbState} mechanics=${mechanicCount}`);
                } catch (err) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const e: any = err;
                  console.error('Ping error', e);
                  if (e?.response) {
                    toast.error(`Ping failed: ${e.response.status}`);
                  } else {
                    toast.error('Ping failed: network error');
                  }
                }
              }}
            >
              <span className="hidden sm:inline">Test Backend</span>
              <span className="sm:hidden">Test</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 text-xs sm:text-sm"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{jobs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {jobs.filter(j =>
                  ['accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed'].includes(j.status)
                ).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Location Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={isSharing ? stopLocationSharing : startLocationSharing}
                variant={isSharing ? "destructive" : "default"}
                className="w-full"
              >
                <MapPin className="mr-2 h-4 w-4" />
                {isSharing ? "Stop Sharing" : "Start Sharing"}
              </Button>
              {lastLocationAt && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Last update: {new Date(lastLocationAt).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Job Status - Show active job with swipe button */}
        {(() => {
          const activeJob = jobs.find(j =>
            ['accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed'].includes(j.status)
          );



          const getStatusBadge = (status: string) => {
            const statusConfig = {
              accepted: { label: 'Accepted', className: 'bg-blue-600 animate-pulse shadow-lg shadow-blue-500/50' },
              on_the_way: { label: 'On The Way', className: 'bg-orange-600 animate-pulse shadow-lg shadow-orange-500/50' },
              reached_destination: { label: 'Reached', className: 'bg-purple-600 animate-pulse shadow-lg shadow-purple-500/50' },
              repair_started: { label: 'Repair Started', className: 'bg-yellow-600 animate-pulse shadow-lg shadow-yellow-500/50' },
              repair_completed: { label: 'Repair Completed', className: 'bg-green-600 animate-pulse shadow-lg shadow-green-500/50' },
            };
            const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-600' };
            return (
              <Badge className={`${config.className} px-3 py-1 text-sm font-bold tracking-wide transition-all duration-300 hover:scale-105`}>
                {config.label}
              </Badge>
            );
          };

          const getStatusMessage = (status: string) => {
            switch (status) {
              case 'accepted':
                return 'Job Accepted - Ready to Start! 🚀';
              case 'on_the_way':
                return 'Driving to Customer 🚗💨';
              case 'reached_destination':
                return 'Arrived at Location 📍';
              case 'repair_started':
                return 'Fixing the Vehicle 🔧';
              case 'repair_completed':
                return 'Job Done! Great Work 🎉';
              default:
                return `Status: ${status.replace('_', ' ')}`;
            }
          };

          // Get card background gradient based on status
          const getCardStyle = (status: string) => {
            const styles = {
              accepted: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
              on_the_way: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800',
              reached_destination: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',
              repair_started: 'from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
              repair_completed: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
            };
            return styles[status as keyof typeof styles] || 'from-gray-50 to-gray-100 border-gray-200';
          };

          const getAnimatedIcon = (status: string) => {
            switch (status) {
              case 'accepted':
                return <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 animate-bounce drop-shadow-xl" />;
              case 'on_the_way':
                return <Navigation className="h-10 w-10 sm:h-12 sm:w-12 text-orange-600 animate-pulse drop-shadow-xl" />;
              case 'reached_destination':
                return <MapPin className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600 animate-bounce drop-shadow-xl" />;
              case 'repair_started':
                return <Settings className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-600 animate-spin-slow drop-shadow-xl" />; // Using Settings as Wrench alternative
              case 'repair_completed':
                return <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 animate-bounce drop-shadow-xl" />;
              default:
                return <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-gray-600" />;
            }
          };

          const jobForMap = activeJob || (jobs.length > 0 ? jobs[0] : null);

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="w-full">
                {activeJob ? (
                  <div className="relative group h-full">
                    {/* Animated Glow Effect */}
                    <div className={`absolute -inset-1 bg-gradient-to-r ${getCardStyle(activeJob.status).split(' ')[0].replace('50', '400').replace('100', '600')} rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt`}></div>

                    <Card className={`relative h-full bg-gradient-to-br ${getCardStyle(activeJob.status)} border-2 shadow-xl overflow-hidden flex flex-col`}>
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rotate-45 transform"></div>

                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                            Current Job Status
                          </span>
                          {getStatusBadge(activeJob.status)}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="pt-2 pb-4 px-4">
                        <div className="flex flex-col items-center text-center space-y-3">
                          {/* Animated Icon Container */}
                          <div className="relative p-2 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-sm shadow-inner">
                            {getAnimatedIcon(activeJob.status)}
                          </div>

                          <div className="space-y-1">
                            <h3 className="font-extrabold text-lg sm:text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 animate-in fade-in slide-in-from-bottom-4 duration-700">
                              {getStatusMessage(activeJob.status)}
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

                          {/* Customer Details Card */}
                          {activeJob.status !== 'pending' && (activeJob.user_name || activeJob.user_phone) && (
                            <div className="w-full mt-2 p-2.5 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-lg border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Customer Details</p>
                              <div className="flex items-center justify-between">
                                {activeJob.user_name && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                        {activeJob.user_name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                      <p className="font-bold text-xs sm:text-sm text-foreground">{activeJob.user_name}</p>
                                      <p className="text-[10px] text-muted-foreground">Valued Customer</p>
                                    </div>
                                  </div>
                                )}
                                {activeJob.user_phone && (
                                  <a
                                    href={`tel:${activeJob.user_phone}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full font-semibold text-xs shadow-sm hover:shadow-md transition-all transform hover:scale-105 active:scale-95"
                                  >
                                    <Phone className="h-3 w-3 animate-pulse" />
                                    <span>Call</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Navigate to Customer Button */}
                          {activeJob.user_location && (
                            <div className="w-full mt-1">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const { lat, lng } = activeJob.user_location;
                                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                  window.open(googleMapsUrl, '_blank');
                                }}
                                className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                              >
                                <Navigation className="h-4 w-4 mr-1.5 animate-bounce" />
                                <span className="font-bold text-sm">Navigate to Customer</span>
                                <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
                              </Button>
                            </div>
                          )}

                          {/* Swipe Button */}
                          <div className="w-full transform transition-all duration-300 hover:scale-105">
                            <SwipeButton
                              currentStatus={activeJob.status}
                              onStatusUpdate={(newStatus) => updateJobStatus(activeJob.id, newStatus)}
                            />
                          </div>

                          {activeJob.user_id && user?.id && (
                            <div className="w-full mt-2">
                              <ChatButton
                                requestId={activeJob.id}
                                userId={user.id}
                                unreadCount={getUnreadCount(activeJob.id)}
                                onOpen={() => handleChatOpen(activeJob.id)}
                                senderType="mechanic"
                                className="w-full h-14"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 border-dashed border-2">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Settings className="h-12 w-12 text-primary animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Ready for Work</h3>
                      <p className="text-muted-foreground">Waiting for new job assignments...</p>
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Column: Live Tracking */}
              <div className="w-full h-full min-h-[400px] lg:min-h-0">
                {jobForMap && jobForMap.user_location ? (
                  <div className="h-full rounded-xl overflow-hidden shadow-lg border-2 border-primary/10">
                    <LiveLocationTracker
                      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined}
                      userLocation={jobForMap.user_location}
                      userId={jobForMap.user_id}
                      mechanicId={user?.id}
                      showRoute={true}
                      mode="mechanic"
                    />
                  </div>
                ) : (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Job Locations & Live Tracking</CardTitle>
                      <CardDescription>
                        View customer locations when you have assigned jobs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
                        <div className="text-center">
                          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No active jobs with location data</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div >
          );
        })()}

        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Jobs</CardTitle>
              <CardDescription>
                Manage your assigned repair requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs assigned yet</p>
                  </div>
                ) : (
                  jobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((job) => (
                    <div
                      key={job.id}
                      className="p-3 sm:p-4 border rounded-lg space-y-2 sm:space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {job.vehicle_type || "Unknown Vehicle"}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(job.status)}
                              <span className="text-xs sm:text-sm capitalize">
                                {job.status.replace("_", " ")}
                              </span>
                            </div>
                            {job.user_id && user?.id && (
                              <ChatButton
                                key={job.id}
                                requestId={job.id}
                                userId={user.id}
                                unreadCount={getUnreadCount(job.id)}
                                onOpen={() => handleChatOpen(job.id)}
                                onClose={() => setOpenChatRequestId(null)}
                                senderType="mechanic"
                              />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            {job.issue_description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                          {job.user_location && (
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const { lat, lng } = job.user_location;
                                  // Open Google Maps with user's location
                                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                  window.open(googleMapsUrl, '_blank');
                                }}
                                className="w-full text-xs sm:text-sm"
                              >
                                <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Navigate to Customer</span>
                                <span className="sm:hidden">Navigate</span>
                                <ExternalLink className="h-3 w-3 ml-1 sm:ml-2" />
                              </Button>
                              <p className="text-xs text-muted-foreground mt-1 break-all">
                                Location: {job.user_location.lat.toFixed(4)}, {job.user_location.lng.toFixed(4)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <JobStatusManager
                          jobId={job.id}
                          currentStatus={job.status}
                          mechanicId={job.mechanic_id || user?.id}
                          userId={job.user_id}
                          onStatusChange={(newStatus) => {
                            updateJobStatus(job.id, newStatus);
                          }}
                          onAccept={() => {
                            if (user?.id) {
                              fetchJobs(user.id);
                            }
                          }}
                          onReject={() => {
                            if (user?.id) {
                              fetchJobs(user.id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}

                {jobs.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.ceil(jobs.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(jobs.length / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage === Math.ceil(jobs.length / ITEMS_PER_PAGE)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


        </div>
      </main >

      <Footer />

      {/* Chat Notification Badge - Shows when new messages arrive */}
      {
        latestNotification && (
          <ChatNotificationBadge
            unreadCount={totalUnreadCount}
            lastMessage={latestNotification.message}
            onClick={() => {
              handleChatOpen(latestNotification.requestId);
              setOpenChatRequestId(latestNotification.requestId);
            }}
          />
        )
      }
    </div >
  );
};

export default MechanicDashboard;

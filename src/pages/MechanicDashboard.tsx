import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Clock, CheckCircle, Loader2, User, Settings, XCircle, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import Map from "@/components/Map";
import LiveLocationTracker from "@/components/LiveLocationTracker";
import MechanicOnlineToggle from "@/components/MechanicOnlineToggle";
import api from '@/lib/api';

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

  useEffect(() => {
    checkMechanicAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Set up realtime subscription for new job assignments
    const channel = supabase
      .channel('job-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: `mechanic_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New job assigned:', payload);
          const newJob = payload.new as Job;
          
          // Show notification
          toast.success(
            `New job assigned! ${newJob.vehicle_type || 'Vehicle'} - ${newJob.issue_description}`,
            {
              duration: 5000,
            }
          );

          // Add to jobs list
          setJobs(prevJobs => [
            {
              ...newJob,
              user_location: newJob.user_location as { lat: number; lng: number }
            },
            ...prevJobs
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `mechanic_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Job updated:', payload);
          const updatedJob = payload.new as Job;
          
          // Update job in list
          setJobs(prevJobs =>
            prevJobs.map(job =>
              job.id === updatedJob.id
                ? {
                    ...updatedJob,
                    user_location: updatedJob.user_location as { lat: number; lng: number }
                  }
                : job
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  const fetchJobs = async (mechanicId: string) => {
    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("mechanic_id", mechanicId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
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
        
        return {
          ...job,
          user_location: userLocation as { lat: number; lng: number } | null
        };
      });
      
      setJobs(formattedJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    }
  };

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("job_requests")
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (error) {
        console.error("Status update error details:", error);
        throw error;
      }

      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: status } : job
      ));

      const statusLabels: Record<string, string> = {
        "accepted": "Job accepted",
        "on_the_way": "On the way to customer",
        "reached_destination": "Reached customer location",
        "repair_started": "Repair started",
        "repair_completed": "Repair completed",
        "completed": "Job completed",
      };

      toast.success(statusLabels[status] || "Job status updated successfully");
    } catch (error: any) {
      console.error("Error updating job status:", error);
      const errorMsg = error?.message || "Failed to update job status";
      toast.error(errorMsg);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("job_requests")
        .update({ status: "accepted" })
        .eq("id", jobId);

      if (error) throw error;

      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: "accepted" } : job
      ));

      toast.success("Job accepted successfully");
    } catch (error) {
      console.error("Error accepting job:", error);
      toast.error("Failed to accept job");
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
          mechanic_id: null
        })
        .eq("id", jobId);

      if (error) throw error;

      // Remove from jobs list since it's no longer assigned to this mechanic
      setJobs(jobs.filter(job => job.id !== jobId));

      toast.success("Job rejected. It will be reassigned to another mechanic.");
    } catch (error) {
      console.error("Error rejecting job:", error);
      toast.error("Failed to reject job");
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                {jobs.filter(j => j.status === "in_progress").length}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                  jobs.map((job) => (
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
                        {job.status === "pending" && job.mechanic_id === user.id ? (
                          <div className="flex gap-2 w-full">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptJob(job.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectJob(job.id)}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        ) : job.status === "accepted" ? (
                          // Show status options after accepting
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="on_the_way">On The Way</SelectItem>
                              <SelectItem value="reached_destination">Reached Destination</SelectItem>
                              <SelectItem value="repair_started">Repair Started</SelectItem>
                              <SelectItem value="repair_completed">Repair Completed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : job.status === "on_the_way" ? (
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_the_way">On The Way</SelectItem>
                              <SelectItem value="reached_destination">Reached Destination</SelectItem>
                              <SelectItem value="repair_started">Repair Started</SelectItem>
                              <SelectItem value="repair_completed">Repair Completed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : job.status === "reached_destination" ? (
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reached_destination">Reached Destination</SelectItem>
                              <SelectItem value="repair_started">Repair Started</SelectItem>
                              <SelectItem value="repair_completed">Repair Completed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : job.status === "repair_started" ? (
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="repair_started">Repair Started</SelectItem>
                              <SelectItem value="repair_completed">Repair Completed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : job.status === "repair_completed" ? (
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="repair_completed">Repair Completed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={job.status}>{job.status.replace("_", " ")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {jobs.length > 0 && jobs[0].user_location ? (
            <LiveLocationTracker
              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined}
              userLocation={jobs[0].user_location}
              userId={jobs[0].user_id}
              mechanicId={user?.id}
              showRoute={true}
              mode="mechanic"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Job Locations & Live Tracking</CardTitle>
                <CardDescription>
                  View customer locations when you have assigned jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No active jobs with location data</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MechanicDashboard;

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, User, LogOut, Camera } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Map from "@/components/Map";
import LiveLocationTracker from "@/components/LiveLocationTracker";
import TrackingPanel from "@/components/TrackingPanel";
import RequestAssistanceForm from "@/components/RequestAssistanceForm";
import MyRequests from "@/components/MyRequests";
import LocationRequired from "@/components/LocationRequired";
import OnboardingTour from "@/components/OnboardingTour";
import ChatNotificationBadge from "@/components/ChatNotificationBadge";
import { useChatNotifications } from "@/hooks/useChatNotifications";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trackingMechanicId, setTrackingMechanicId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [locationRequired, setLocationRequired] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  // Chat notifications
  const { 
    getUnreadCount, 
    markAsRead, 
    setOpenChatRequestId, 
    openChatRequestId,
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
    checkUser();
    // Removed auto-logout on page hide/refresh to prevent blank screens
    // Session persistence is handled by Supabase automatically
  }, []);

  // MANDATORY: Start location sharing when user logs in (only for travelers/users)
  useEffect(() => {
    if (!user || !userRole) return;
    if (userRole === "mechanic" || userRole === "admin") return;
    
    // Don't start if already watching
    if (locationWatchId !== null) return;

    const startLocationSharing = async () => {
      const { getLocation, watchPosition, isSecureContext } = await import("@/utils/geolocation");
      
      // Check if we're on HTTP (non-HTTPS) - show info but still try
      if (!isSecureContext()) {
        toast.info("Requesting location access. Please allow when prompted.", {
          duration: 4000,
        });
      }

      // MANDATORY: Get initial GPS location (no fallback)
      // Try even on HTTP - many browsers allow it with user permission
      try {
        const location = await getLocation({
          enableHighAccuracy: true,
          timeout: 25000, // Increased timeout
          maximumAge: 30000,
        });

        setUserLocation({ lat: location.lat, lng: location.lng });
        setLocationRequired(false); // Location granted
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error } = await supabase
          .from("user_locations")
          .upsert({
            user_id: session.user.id,
            latitude: location.lat,
            longitude: location.lng,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id",
          });

        if (!error) {
          setLocationSharing(true);
          toast.success("Location sharing active");
        }
      } catch (error: any) {
        console.error("Initial location failed:", error);
        // Location is REQUIRED - show blocking message
        setLocationRequired(true);
        toast.error(error.userFriendlyMessage || "Location access is required");
        return; // Don't continue without location
      }

      // Now watch for position updates (GPS only)
      if (!navigator.geolocation) {
        setLocationRequired(true);
        toast.error("Geolocation is not supported. Please use a modern browser.");
        return;
      }

      const id = watchPosition(
        async (location) => {
          setUserLocation({ lat: location.lat, lng: location.lng });
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
              .from("user_locations")
              .upsert({
                user_id: session.user.id,
                latitude: location.lat,
                longitude: location.lng,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id",
              });

            if (!error) {
              setLocationSharing(true);
            }
          } catch (error) {
            console.error("Error sharing location:", error);
          }
        },
        (error) => {
          console.error("Geolocation watch error:", error);
          // Show error but don't block - location was already granted
          toast.error(error.userFriendlyMessage || "Location update failed");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000,
        }
      );

      if (id !== null) {
        setLocationWatchId(id);
      }
    };

    startLocationSharing();
    
    return () => {
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        setLocationWatchId(null);
      }
    };
  }, [user, userRole]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Fetch user role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
        
      let resolvedRole = "traveler";
      
      if (roleError || !roleData) {
        // Fallback to auth user metadata when DB lookup fails or is blocked by RLS
        const metaRole = (session.user as any)?.user_metadata?.role ?? (session.user as any)?.role ?? null;
        resolvedRole = metaRole || "traveler";
        // Only log if it's not a 406 (Not Acceptable) which is expected for some RLS scenarios
        if (roleError && (roleError as any).code !== 'PGRST116') {
          console.warn("Error fetching role, using fallback:", roleError);
        }
      } else {
        resolvedRole = roleData?.role || ((session.user as any)?.user_metadata?.role ?? null) || "traveler";
      }
      
      setUserRole(resolvedRole);

      // Fetch user profile to get photo and name (use maybeSingle to handle missing profiles)
      try {
        // First try to select with onboarding_completed, but handle if column doesn't exist
        let { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, profile_photo, onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle();

        // If error suggests column doesn't exist, try without it
        // If profile exists but column doesn't, this is an EXISTING user - mark onboarding as completed
        if (profileError && profileError.message?.includes('onboarding_completed')) {
          const { data: simpleProfile, error: simpleError } = await supabase
            .from("profiles")
            .select("full_name, profile_photo")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (!simpleError && simpleProfile) {
            // Profile exists but onboarding column doesn't - this is an EXISTING user
            // Mark onboarding as completed (true) for existing users
            profileData = { ...simpleProfile, onboarding_completed: true };
            profileError = null;
          }
        }

        if (!profileError && profileData) {
          // Profile exists - this is an existing user
          setProfilePhoto(profileData.profile_photo || null);
          setProfileName(profileData.full_name || session.user.user_metadata?.full_name || session.user.email || "User");
          
          const onboardingStatus = (profileData as any).onboarding_completed;
          
          // If onboarding_completed is NULL (existing user before column was added), mark as completed
          if (onboardingStatus === null || onboardingStatus === undefined) {
            // This is an existing user - update their profile to mark onboarding as completed
            // This prevents the tour from showing on future logins
            supabase
              .from("profiles")
              .update({ onboarding_completed: true })
              .eq("id", session.user.id)
              .then(({ error }) => {
                if (error) {
                  console.warn("Could not update onboarding_completed for existing user:", error.message);
                } else {
                  console.log("✅ Marked existing user onboarding as completed");
                }
              });
            
            setOnboardingCompleted(true);
          } else if (onboardingStatus === false) {
            // Explicitly marked as incomplete - new user, show onboarding
            setOnboardingCompleted(false);
            if (resolvedRole !== "mechanic" && resolvedRole !== "admin") {
              setTimeout(() => setShowOnboarding(true), 1000);
            }
          } else {
            // Explicitly true - already completed
            setOnboardingCompleted(true);
          }
        } else {
          // No profile found - this is a TRULY NEW user (first login)
          setProfileName(session.user.user_metadata?.full_name || session.user.email || "User");
          setOnboardingCompleted(false);
          // Only show onboarding for new users who are travelers/users
          if (resolvedRole !== "mechanic" && resolvedRole !== "admin") {
            setTimeout(() => setShowOnboarding(true), 1000);
          }
        }
      } catch (profileError) {
        console.error("Error fetching profile:", profileError);
        // Continue even if profile fetch fails
        setProfileName(session.user.user_metadata?.full_name || session.user.email || "User");
        // If profile fetch fails, assume existing user (don't show onboarding)
        // Don't show onboarding for error cases - only for confirmed new users
        setOnboardingCompleted(true);
      }

      // Redirect based on role
      if (resolvedRole === "mechanic") {
        setLoading(false);
        navigate("/mechanic");
        return;
      }

      if (resolvedRole === "admin") {
        setLoading(false);
        navigate("/admin");
        return;
      }
      
      // If we get here, user is a traveler/user - show dashboard
      setLoading(false);
    } catch (error) {
      console.error("Error checking user:", error);
      setLoading(false);
      navigate("/auth");
    }
  };

  const handleSignOut = async () => {
    try {
      // Stop location sharing if active
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        setLocationWatchId(null);
        setLocationSharing(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const userType = userRole || "traveler";

  // Safety check - if user is null but not loading, something went wrong
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to continue</p>
          <Button onClick={() => navigate("/auth")} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // MANDATORY: Show location required screen if location not granted (for users/travelers only)
  if (userType === "traveler" && locationRequired && !userLocation) {
    return (
      <LocationRequired
        onLocationGranted={(location) => {
          setUserLocation(location);
          setLocationRequired(false);
          // Trigger location sharing again
          window.location.reload();
        }}
        title="Location Access Required"
        description="GPS location is required to request roadside assistance. Please enable location permissions."
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <OnboardingTour
        run={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          setOnboardingCompleted(true);
        }}
      />
      <Navbar />
      
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">
              {userType === "mechanic" ? "Mechanic Dashboard" : "User Dashboard"}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Welcome back, {user?.user_metadata?.name || "User"}!</p>
          </div>
          <Button variant="outline" onClick={handleSignOut} size="sm" className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profile</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profilePhoto || undefined} alt={profileName} />
                  <AvatarFallback>
                    {profileName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg font-bold">{profileName}</div>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Type</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{userType}</div>
              <p className="text-xs text-muted-foreground">Active account</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {userType === "traveler" ? (
          <div className="space-y-6">
            {/* Location Status */}
            {userLocation && (
              <Card 
                className="p-4 bg-green-50 dark:bg-green-950 border-green-200"
                data-tour="location-permission"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Location Active: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </span>
                </div>
              </Card>
            )}

            {trackingMechanicId ? (
              <div data-tour="live-tracking">
                <LiveLocationTracker
                  apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined}
                  userLocation={userLocation || undefined}
                  mechanicId={trackingMechanicId}
                  showRoute={true}
                  mode="user"
                />
              </div>
            ) : (
              <Card className="p-6" data-tour="live-tracking">
                <h2 className="text-2xl font-bold mb-4">Find Nearby Mechanics</h2>
                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                  <Map 
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    userLocation={userLocation || undefined}
                    showNearbyMechanics={true}
                  />
                ) : (
                  <div className="p-6 text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">Google Maps API key not configured</p>
                    <p className="text-sm text-muted-foreground">
                      Location tracking works without it! Add API key for interactive map.
                    </p>
                  </div>
                )}
              </Card>
            )}

            {user?.id && (
              <>
                <TrackingPanel
                  userId={user.id}
                  onTrackingStart={(mechanicId, jobId) => {
                    setTrackingMechanicId(mechanicId);
                    setActiveJobId(jobId);
                  }}
                  getUnreadCount={getUnreadCount}
                  onChatOpen={handleChatOpen}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div data-tour="request-assistance">
                    <RequestAssistanceForm initialLocation={userLocation} />
                  </div>
                  <div data-tour="my-requests">
                    <MyRequests 
                      userId={user.id}
                      getUnreadCount={getUnreadCount}
                      onChatOpen={handleChatOpen}
                      openChatRequestId={openChatRequestId}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Card className="p-8">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Mechanic Dashboard</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your mechanic features are being set up. You'll be able to receive and manage job requests here.
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                >
                  Go Online
                </Button>
                <Button size="lg" variant="outline">
                  View Requests
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Chat Notification Badge - Shows when new messages arrive */}
        {latestNotification && (
          <ChatNotificationBadge
            unreadCount={totalUnreadCount}
            lastMessage={latestNotification.message}
            onClick={() => {
              handleChatOpen(latestNotification.requestId);
              setOpenChatRequestId(latestNotification.requestId);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;

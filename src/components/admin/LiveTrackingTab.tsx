import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, User, Wrench, Navigation, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

interface MechanicData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  availability_status: string;
  verification_status: string;
  latitude?: number;
  longitude?: number;
  updated_at?: string;
  current_job?: {
    id: string;
    status: string;
    vehicle_type: string;
    user_location: { lat: number; lng: number };
  };
}

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  latitude?: number;
  longitude?: number;
  updated_at?: string;
  active_job?: {
    id: string;
    status: string;
    mechanic_id: string | null;
  };
}

const LiveTrackingTab = () => {
  const [mechanics, setMechanics] = useState<MechanicData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMechanic, setSelectedMechanic] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 15.7765, lng: 74.4664 });
  const [mapZoom, setMapZoom] = useState(12);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
    
    // Update every second for live tracking
    updateIntervalRef.current = setInterval(() => {
      fetchAllData();
    }, 1000);

    // Subscribe to real-time updates
    const mechanicChannel = supabase
      .channel("admin_mechanic_locations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mechanic_locations",
        },
        () => {
          fetchMechanics();
        }
      )
      .subscribe();

    const userChannel = supabase
      .channel("admin_user_locations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_locations",
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel("admin_profiles")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "profiles",
        },
        () => {
          console.log("🔄 [Admin] Profile changed, refreshing mechanics...");
          fetchMechanics();
        }
      )
      .subscribe();

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      supabase.removeChannel(mechanicChannel);
      supabase.removeChannel(userChannel);
      supabase.removeChannel(profileChannel);
    };
  }, []);

  const fetchAllData = async () => {
    await Promise.all([fetchMechanics(), fetchUsers()]);
    setLoading(false);
  };

  const fetchMechanics = async () => {
    try {
      console.log("🔍 [Admin] Fetching mechanics...");
      
      // Get mechanic user IDs from user_roles
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mechanic");

      if (roleError) {
        console.error("❌ [Admin] Error fetching mechanic roles:", roleError);
        console.error("   Error details:", {
          code: roleError.code,
          message: roleError.message,
          details: roleError.details,
          hint: roleError.hint
        });
        
        // Fallback: try to get all profiles and filter by role column
        console.log("⚠️ [Admin] Trying fallback: fetching all profiles with role='mechanic'...");
        const { data: allProfiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, availability_status, verification_status, role")
          .eq("role", "mechanic");
        
        if (profileError) {
          console.error("❌ [Admin] Fallback also failed:", profileError);
          console.log("⚠️ [Admin] Trying final fallback: fetching ALL profiles...");
          
          // Final fallback: get all profiles and check manually
          const { data: allProfilesNoFilter, error: allProfilesError } = await supabase
            .from("profiles")
            .select("id, email, full_name, phone, availability_status, verification_status, role");
          
          if (allProfilesError) {
            console.error("❌ [Admin] Final fallback failed:", allProfilesError);
            toast({
              title: "Error",
              description: "Failed to fetch mechanics. Please check RLS policies and run FIX_ALL_RLS_COMPREHENSIVE.sql",
              variant: "destructive",
            });
            setMechanics([]);
            return;
          }
          
          if (allProfilesNoFilter && allProfilesNoFilter.length > 0) {
            // Filter for mechanics manually
            const mechanicsFromProfiles = allProfilesNoFilter.filter(p => p.role === "mechanic");
            console.log(`✅ [Admin] Final fallback: Found ${mechanicsFromProfiles.length} mechanics from all profiles`);
            if (mechanicsFromProfiles.length > 0) {
              const mechanicIds = mechanicsFromProfiles.map(p => p.id);
              await fetchMechanicData(mechanicIds);
            } else {
              console.warn("⚠️ [Admin] No profiles with role='mechanic' found");
              setMechanics([]);
            }
          } else {
            console.warn("⚠️ [Admin] No profiles found at all");
            setMechanics([]);
          }
          return;
        }
        
        if (allProfiles && allProfiles.length > 0) {
          console.log(`✅ [Admin] Fallback: Found ${allProfiles.length} mechanics from profiles`);
          const mechanicIds = allProfiles.map(p => p.id);
          await fetchMechanicData(mechanicIds);
        } else {
          console.warn("⚠️ [Admin] No mechanics found in profiles either");
          console.warn("   This means either:");
          console.warn("   1. No mechanics have registered");
          console.warn("   2. Mechanics haven't been assigned role='mechanic' in profiles table");
          console.warn("   3. RLS is blocking access to profiles");
          setMechanics([]);
        }
        return;
      }

      if (!roleData || roleData.length === 0) {
        console.warn("⚠️ [Admin] No mechanics found in user_roles");
        console.warn("   This could mean:");
        console.warn("   1. No mechanics have registered yet");
        console.warn("   2. RLS policies are blocking access to user_roles");
        console.warn("   3. Mechanics haven't been assigned the 'mechanic' role");
        setMechanics([]);
        return;
      }

      const mechanicIds = roleData.map(r => r.user_id);
      console.log(`✅ [Admin] Found ${mechanicIds.length} mechanics in user_roles`);
      console.log("📋 Mechanic IDs:", mechanicIds);
      
      await fetchMechanicData(mechanicIds);
    } catch (error) {
      console.error("❌ [Admin] Error fetching mechanics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch mechanics. Check console for details.",
        variant: "destructive",
      });
      setMechanics([]);
    }
  };

  const fetchMechanicData = async (mechanicIds: string[]) => {
    try {
      console.log(`🔍 [Admin] Fetching data for ${mechanicIds.length} mechanics...`);
      
      // Fetch profiles - try with admin role check
      let profiles: any[] = [];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, availability_status, verification_status")
        .in("id", mechanicIds);

      if (profileError) {
        console.error("❌ [Admin] Error fetching profiles:", profileError);
        console.error("   Error details:", {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        // Try without filter as fallback
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, availability_status, verification_status");
        
        if (allProfiles) {
          profiles = allProfiles.filter(p => mechanicIds.includes(p.id));
          console.log(`⚠️ [Admin] Fallback: Found ${profiles.length} profiles (filtered manually)`);
        }
      } else {
        profiles = profileData || [];
        console.log(`✅ [Admin] Found ${profiles.length} profiles`);
      }

      // Fetch ALL mechanic locations (not filtered) - we'll match them to mechanics below
      let locations: any[] = [];
      const { data: locationData, error: locationError } = await supabase
        .from("mechanic_locations")
        .select("mechanic_id, latitude, longitude, updated_at");

      if (locationError) {
        console.error("❌ [Admin] Error fetching locations:", locationError);
        console.error("   Error details:", {
          code: locationError.code,
          message: locationError.message,
          details: locationError.details,
          hint: locationError.hint
        });
      } else {
        locations = locationData || [];
        console.log(`✅ [Admin] Found ${locations.length} mechanic locations (total)`);
      }

      // Match locations to mechanics (will show location only if mechanic has shared it)
      const mechanicLocations = locations.filter(loc => mechanicIds.includes(loc.mechanic_id));

      // Fetch active jobs
      const { data: jobs, error: jobError } = await supabase
        .from("job_requests")
        .select("id, mechanic_id, status, vehicle_type, user_location")
        .in("mechanic_id", mechanicIds)
        .in("status", ["pending", "accepted", "on_the_way", "reached_destination", "repair_started", "repair_completed"]);

      // Combine data - show ALL mechanics regardless of location
      // Location will only show if mechanic is online and has shared location
      const mechanicsData: MechanicData[] = (profiles || []).map(profile => {
        // Only get location if mechanic is online and has shared it
        const location = mechanicLocations.find(l => l.mechanic_id === profile.id);
        const job = jobs?.find(j => j.mechanic_id === profile.id);

        return {
          ...profile,
          // Only show location if mechanic is online and has actively shared it
          latitude: (profile.availability_status === "online" && location) ? Number(location.latitude) : undefined,
          longitude: (profile.availability_status === "online" && location) ? Number(location.longitude) : undefined,
          updated_at: location?.updated_at,
          current_job: job ? {
            id: job.id,
            status: job.status,
            vehicle_type: job.vehicle_type || "Unknown",
            user_location: job.user_location as { lat: number; lng: number }
          } : undefined,
        };
      });

      console.log(`✅ [Admin] Combined ${mechanicsData.length} mechanics with data`);
      const onlineCount = mechanicsData.filter(m => m.availability_status === "online").length;
      const withLocationCount = mechanicsData.filter(m => m.latitude && m.longitude).length;
      console.log(`📊 [Admin] Online mechanics: ${onlineCount}`);
      console.log(`📍 [Admin] Mechanics with location: ${withLocationCount}`);
      
      // Log each mechanic's status
      mechanicsData.forEach(m => {
        console.log(`   - ${m.full_name || m.email}: ${m.availability_status || 'unknown'} status, ${m.latitude && m.longitude ? 'has location' : 'no location'}`);
      });
      
      if (mechanicsData.length === 0) {
        console.warn("⚠️ [Admin] No mechanics data to display!");
        console.warn("   Possible causes:");
        console.warn("   1. No mechanics have registered");
        console.warn("   2. RLS policies are blocking access");
        console.warn("   3. Profiles query returned empty");
      }
      
      setMechanics(mechanicsData);
    } catch (error) {
      console.error("❌ [Admin] Error in fetchMechanicData:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Get user IDs from user_roles (excluding mechanics and admins)
      // Fix: Use .or() instead of .in() for multiple role values
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .or("role.eq.user,role.eq.traveler");
      
      if (roleError) {
        console.error("❌ [Admin] Error fetching user roles:", roleError);
        setUsers([]);
        return;
      }

      if (!roleData || roleData.length === 0) {
        setUsers([]);
        return;
      }

      const userIds = roleData.map(r => r.user_id);

      // Fetch profiles - get ALL user profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .in("id", userIds);

      if (profileError) throw profileError;

      // Fetch ALL locations (not filtered by user_id) - we'll match them below
      const { data: locations, error: locationError } = await supabase
        .from("user_locations")
        .select("user_id, latitude, longitude, updated_at");

      // Fetch active jobs
      const { data: jobs, error: jobError } = await supabase
        .from("job_requests")
        .select("id, user_id, status, mechanic_id")
        .in("user_id", userIds)
        .in("status", ["pending", "accepted", "on_the_way", "reached_destination", "repair_started", "repair_completed"]);

      // Combine data - show ALL users regardless of location
      const usersData: UserData[] = (profiles || []).map(profile => {
        // Only get location if user has shared it (when they're online/active)
        const location = locations?.find(l => l.user_id === profile.id);
        const job = jobs?.find(j => j.user_id === profile.id);

        return {
          ...profile,
          // Only show location if user has actively shared it
          latitude: location ? Number(location.latitude) : undefined,
          longitude: location ? Number(location.longitude) : undefined,
          updated_at: location?.updated_at,
          active_job: job ? {
            id: job.id,
            status: job.status,
            mechanic_id: job.mechanic_id,
          } : undefined,
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-yellow-500";
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "accepted":
      case "on_the_way":
        return "bg-blue-500";
      case "reached_destination":
      case "repair_started":
        return "bg-orange-500";
      case "repair_completed":
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const onlineMechanics = mechanics.filter(m => m.availability_status === "online");
  const mechanicsWithLocation = mechanics.filter(m => m.latitude && m.longitude);
  const usersWithLocation = users.filter(u => u.latitude && u.longitude);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Mechanics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mechanics.length}</div>
            <p className="text-xs text-muted-foreground">
              {mechanics.filter(m => m.verification_status === "approved").length} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Online Mechanics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineMechanics.length}</div>
            <p className="text-xs text-muted-foreground">
              {onlineMechanics.filter(m => m.latitude && m.longitude).length} with location
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {usersWithLocation.length} sharing location, {users.filter(u => u.active_job).length} with active jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mechanics.filter(m => m.current_job).length}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Map and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Location Map</CardTitle>
            <CardDescription>
              Real-time GPS tracking - Updates every second
            </CardDescription>
          </CardHeader>
          <CardContent>
            {apiKey ? (
              <LoadScript googleMapsApiKey={apiKey}>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "600px" }}
                  center={mapCenter}
                  zoom={mapZoom}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: true,
                    fullscreenControl: true,
                  }}
                >
                  {/* Mechanic Markers - Only show when online and location is available */}
                  {mechanics
                    .filter(m => m.availability_status === "online" && m.latitude && m.longitude)
                    .map((mechanic) => (
                    <Marker
                      key={mechanic.id}
                      position={{ lat: mechanic.latitude!, lng: mechanic.longitude! }}
                      icon={{
                        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                        fillColor: "#10b981",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                        scale: 1.5,
                      }}
                      onClick={() => setSelectedMechanic(mechanic.id)}
                    >
                      {selectedMechanic === mechanic.id && (
                        <InfoWindow
                          onCloseClick={() => setSelectedMechanic(null)}
                        >
                          <div className="p-2">
                            <h3 className="font-bold">{mechanic.full_name || mechanic.email}</h3>
                            <p className="text-sm">Status: {mechanic.availability_status}</p>
                            {mechanic.current_job && (
                              <p className="text-sm">Job: {mechanic.current_job.vehicle_type} - {mechanic.current_job.status}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {mechanic.latitude?.toFixed(4)}, {mechanic.longitude?.toFixed(4)}
                            </p>
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  ))}

                  {/* User Markers - Only show when location is shared */}
                  {users
                    .filter(u => u.latitude && u.longitude)
                    .map((user) => (
                    <Marker
                      key={user.id}
                      position={{ lat: user.latitude!, lng: user.longitude! }}
                      icon={{
                        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                        fillColor: user.active_job ? "#f59e0b" : "#3b82f6",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                        scale: 1.2,
                      }}
                    />
                  ))}
                </GoogleMap>
              </LoadScript>
            ) : (
              <div className="h-96 flex items-center justify-center bg-muted rounded-lg">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Google Maps API key not configured</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Add VITE_GOOGLE_MAPS_API_KEY to .env for map visualization
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mechanics List */}
        <Card>
          <CardHeader>
            <CardTitle>Mechanics Status</CardTitle>
            <CardDescription>Real-time updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {mechanics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No mechanics found</p>
              ) : (
                mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (mechanic.latitude && mechanic.longitude) {
                        setMapCenter({ lat: mechanic.latitude, lng: mechanic.longitude });
                        setMapZoom(15);
                        setSelectedMechanic(mechanic.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-medium text-sm truncate">
                            {mechanic.full_name || mechanic.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStatusColor(mechanic.availability_status)} text-white border-0`}
                          >
                            {mechanic.availability_status === "online" ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Online</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Offline</>
                            )}
                          </Badge>
                          {mechanic.current_job && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getJobStatusColor(mechanic.current_job.status)} text-white border-0`}
                            >
                              {mechanic.current_job.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        {mechanic.latitude && mechanic.longitude ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {mechanic.latitude.toFixed(4)}, {mechanic.longitude.toFixed(4)}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 mt-1">No location shared</p>
                        )}
                        {mechanic.current_job && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Job: {mechanic.current_job.vehicle_type}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List - Show ALL users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>All registered users - Location shown when shared</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                No users registered
              </p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      {user.full_name || user.email}
                    </p>
                  </div>
                  {user.active_job && (
                    <Badge variant="outline" className="text-xs mb-2">
                      Active Job: {user.active_job.status}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {user.latitude?.toFixed(4)}, {user.longitude?.toFixed(4)}
                  </p>
                  {user.updated_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated: {new Date(user.updated_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveTrackingTab;


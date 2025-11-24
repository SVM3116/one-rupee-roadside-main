import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, User, Wrench, Navigation, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, LoadScript, Marker, InfoWindow, HeatmapLayer } from "@react-google-maps/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
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
    try {
      await Promise.all([fetchMechanics(), fetchUsers()]);
    } catch (error) {
      console.error("Error fetching all data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMechanics = async () => {
    try {
      // Get ALL mechanics directly from profiles table (regardless of location)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, availability_status, verification_status")
        .eq("role", "mechanic");

      if (profileError) {
        console.error("❌ [Admin] Error fetching mechanics from profiles:", profileError);
        // Try fallback: get all profiles and filter
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, availability_status, verification_status, role");
        
        if (allProfiles) {
          const mechanicsFromProfiles = allProfiles.filter(p => p.role === "mechanic");
          const mechanicIds = mechanicsFromProfiles.map(p => p.id);
          await fetchMechanicData(mechanicIds);
        } else {
          setMechanics([]);
        }
        return;
      }

      if (!profileData || profileData.length === 0) {
        setMechanics([]);
        return;
      }

      const mechanicIds = profileData.map(p => p.id);
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
          // Only show location on map if mechanic is online and has actively shared it
          // But show mechanic in list regardless of location
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
      // Get ALL users directly from profiles table (excluding mechanics and admins)
      // Fetch users with role='user' OR role='traveler' directly from profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role")
        .or("role.eq.user,role.eq.traveler");

      if (profileError) {
        console.error("❌ [Admin] Error fetching users from profiles:", profileError);
        // Fallback: get all profiles and filter
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, role");
        
        if (allProfiles) {
          const usersFromProfiles = allProfiles.filter(p => p.role === "user" || p.role === "traveler");
          const userIds = usersFromProfiles.map(p => p.id);
          
          // Fetch locations and jobs for these users
          const { data: locations } = await supabase
            .from("user_locations")
            .select("user_id, latitude, longitude, updated_at");

          const { data: jobs } = await supabase
            .from("job_requests")
            .select("id, user_id, status, mechanic_id")
            .in("user_id", userIds)
            .in("status", ["pending", "accepted", "on_the_way", "reached_destination", "repair_started", "repair_completed"]);

          const usersData: UserData[] = usersFromProfiles.map(profile => {
            const location = locations?.find(l => l.user_id === profile.id);
            const job = jobs?.find(j => j.user_id === profile.id);

            return {
              ...profile,
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
        } else {
          setUsers([]);
        }
        return;
      }

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      const userIds = profiles.map(p => p.id);

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
      // Location will only show if user has shared it
      const usersData: UserData[] = (profiles || []).map(profile => {
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
      setUsers([]);
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Location Map</CardTitle>
                <CardDescription>
                  Real-time GPS tracking - Updates every second
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {/* Heatmap Controls */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="heatmap-toggle"
                    checked={showHeatmap}
                    onCheckedChange={setShowHeatmap}
                  />
                  <Label htmlFor="heatmap-toggle" className="text-sm cursor-pointer">
                    Show Heatmap
                  </Label>
                </div>
                {showHeatmap && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="online-only"
                        checked={onlineOnly}
                        onCheckedChange={setOnlineOnly}
                      />
                      <Label htmlFor="online-only" className="text-sm cursor-pointer">
                        Online Only
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="verified-only"
                        checked={verifiedOnly}
                        onCheckedChange={setVerifiedOnly}
                      />
                      <Label htmlFor="verified-only" className="text-sm cursor-pointer">
                        Verified Only
                      </Label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {apiKey ? (
              <LoadScript 
                googleMapsApiKey={apiKey}
                libraries={["visualization"]}
              >
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
                  {/* Heatmap Layer */}
                  {showHeatmap && (() => {
                    // Filter mechanics based on heatmap options
                    let filteredMechanics = mechanics.filter(m => m.latitude && m.longitude);
                    
                    if (onlineOnly) {
                      filteredMechanics = filteredMechanics.filter(m => m.availability_status === "online");
                    }
                    
                    if (verifiedOnly) {
                      filteredMechanics = filteredMechanics.filter(m => m.verification_status === "approved");
                    }
                    
                    // Generate heatmap data
                    const heatmapData = filteredMechanics.map(m => ({
                      location: new window.google.maps.LatLng(m.latitude!, m.longitude!),
                      weight: 1
                    }));
                    
                    return heatmapData.length > 0 ? (
                      <HeatmapLayer
                        data={heatmapData}
                        options={{
                          radius: 50,
                          opacity: 0.7,
                          maxIntensity: 10,
                          gradient: [
                            "rgba(0, 255, 255, 0)",
                            "rgba(0, 255, 255, 1)",
                            "rgba(0, 191, 255, 1)",
                            "rgba(0, 127, 255, 1)",
                            "rgba(0, 63, 255, 1)",
                            "rgba(0, 0, 255, 1)",
                            "rgba(0, 0, 223, 1)",
                            "rgba(0, 0, 191, 1)",
                            "rgba(0, 0, 159, 1)",
                            "rgba(0, 0, 127, 1)",
                            "rgba(63, 0, 91, 1)",
                            "rgba(127, 0, 63, 1)",
                            "rgba(191, 0, 31, 1)",
                            "rgba(255, 0, 0, 1)"
                          ]
                        }}
                      />
                    ) : null;
                  })()}
                  
                  {/* Mechanic Markers - Only show when NOT in heatmap mode, or when heatmap is off */}
                  {!showHeatmap && mechanics
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


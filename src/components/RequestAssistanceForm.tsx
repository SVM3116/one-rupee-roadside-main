import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Loader2, AlertCircle, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const requestSchema = z.object({
  vehicleType: z.string().min(1, "Please select a vehicle type").max(50),
  issueDescription: z.string()
    .min(10, "Please provide at least 10 characters describing the issue")
    .max(500, "Description must be less than 500 characters")
    .trim(),
});

interface RequestAssistanceFormProps {
  initialLocation?: { lat: number; lng: number } | null;
}

const RequestAssistanceForm = ({ initialLocation }: RequestAssistanceFormProps = {}) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleType, setVehicleType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Use initial location if provided, or auto-capture if not
  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation);
    } else if (!location && navigator.geolocation) {
      // Auto-capture location when component mounts if no initial location provided
      getCurrentLocation();
    }
  }, [initialLocation]);

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    
    try {
      const { getLocation, isSecureContext } = await import("@/utils/geolocation");
      
      // Check if we're on HTTP (non-HTTPS) - show info but still try
      if (!isSecureContext()) {
        toast.info("Requesting location access. Please allow when prompted.", {
          duration: 4000,
        });
      }

      // MANDATORY: Get GPS location only (no IP fallback)
      // Try even on HTTP - many browsers allow it with user permission
      const location = await getLocation({
        enableHighAccuracy: true,
        timeout: 25000, // Increased timeout
        maximumAge: 30000,
      });

      setLocation({ lat: location.lat, lng: location.lng });
      setLocationLoading(false);
      toast.success("GPS location captured successfully");
    } catch (error: any) {
      console.error("Geolocation error:", error);
      setLocationLoading(false);
      toast.error(error.userFriendlyMessage || "Failed to get GPS location. Please enable location permissions.");
      if (error.instructions) {
        toast.info(error.instructions, { duration: 6000 });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    try {
      requestSchema.parse({ vehicleType, issueDescription });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
        return;
      }
    }

    if (!location) {
      toast.error("Please capture your location first");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to request assistance");
        navigate("/auth");
        return;
      }

      // Upload media files if any
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploadingMedia(true);
        try {
          const uploadPromises = mediaFiles.map(async (file, index) => {
            const fileExt = file.name.split(".").pop();
            const fileName = `${session.user.id}/job_media_${Date.now()}_${index}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from("job-media")
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from("job-media")
              .getPublicUrl(fileName);

            return publicUrl;
          });

          mediaUrls = await Promise.all(uploadPromises);
        } catch (mediaError: any) {
          console.error("Error uploading media:", mediaError);
          toast.error("Failed to upload some media files. Continuing with request...");
        } finally {
          setUploadingMedia(false);
        }
      }

      // Insert the job and return the created row
      // Format location as a string for the location column
      const locationString = `${location.lat}, ${location.lng}`;
      
      const insertData: any = {
        user_id: session.user.id,
        vehicle_type: vehicleType,
        issue_description: issueDescription.trim(),
        location: locationString, // TEXT field - format as "lat, lng"
        user_location: location, // JSONB field - keep as object for queries
        status: "pending",
      };

      // Only add media_urls if we have media files
      if (mediaUrls && mediaUrls.length > 0) {
        insertData.media_urls = mediaUrls;
      }

      const { data: insertedData, error: insertError } = await supabase
        .from("job_requests")
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error("Insert error details:", insertError);
        throw insertError;
      }

      toast.success("Assistance request submitted successfully! Searching for nearby mechanics...");

      // Try to find nearby mechanics using LIVE locations:
      // - Use mechanic_locations table with real-time locations
      // - Filter by max radius (50km - more lenient)
      // - Only consider mechanics who are online
      // - Assign nearest mechanic automatically
      try {
        const MAX_RADIUS_METERS = 50000; // 50 km (more lenient)
        const MAX_LOCATION_AGE_MS = 60 * 60 * 1000; // 1 hour (more lenient)

        // Fetch LIVE mechanic locations
        console.log("🔍 Searching for nearby mechanics...");
        console.log("📍 User location:", location);
        
        // Try multiple approaches to get mechanic locations
        let locations: any[] | null = null;
        let locError: any = null;
        
        // CRITICAL: Fetch ALL mechanic locations first (don't filter by online status yet)
        console.log("🔍 [Request] Step 1: Fetching ALL mechanic locations...");
        const { data: directLocations, error: directError } = await supabase
          .from("mechanic_locations")
          .select("mechanic_id, latitude, longitude, updated_at")
          .order("updated_at", { ascending: false });
        
        if (directError) {
          console.error("❌ [Request] Error fetching mechanic_locations:", directError);
          console.error("   Code:", directError.code);
          console.error("   Message:", directError.message);
          console.error("   Details:", directError.details);
          console.error("   Hint:", directError.hint);
        } else {
          console.log(`✅ [Request] Fetched ${directLocations?.length || 0} mechanic locations from database`);
          if (directLocations && directLocations.length > 0) {
            console.log("📋 [Request] All mechanic IDs with locations:", directLocations.map((l: any) => l.mechanic_id));
            console.log("📋 [Request] All locations:", directLocations.map((l: any) => ({
              mechanic_id: l.mechanic_id,
              lat: Number(l.latitude),
              lng: Number(l.longitude),
              updated_at: l.updated_at
            })));
          }
        }
        
        // Also fetch online mechanics from profiles to cross-reference
        console.log("🔍 [Request] Step 2: Fetching online mechanics from profiles...");
        const { data: onlineMechanics, error: profileError } = await supabase
          .from("profiles")
          .select("id, availability_status, verification_status")
          .eq("availability_status", "online");
        
        if (profileError) {
          console.error("❌ [Request] Error fetching online mechanics from profiles:", profileError);
          console.warn("⚠️ [Request] Will continue with all locations - profile check failed");
        } else {
          console.log(`📊 [Request] Found ${onlineMechanics?.length || 0} online mechanics in profiles`);
          if (onlineMechanics && onlineMechanics.length > 0) {
            console.log("📋 [Request] Online mechanic IDs:", onlineMechanics.map((m: any) => m.id));
          } else {
            console.warn("⚠️ [Request] No mechanics marked as 'online' in profiles");
            console.warn("   This could mean:");
            console.warn("   1. Mechanics haven't toggled online yet");
            console.warn("   2. availability_status is not being updated correctly");
            console.warn("   3. Will still try to assign using all locations");
          }
        }
        
        // USE ALL LOCATIONS - we'll check online status during assignment
        if (!directError && directLocations && directLocations.length > 0) {
          locations = directLocations;
          console.log(`✅ [Request] Using ALL ${directLocations.length} mechanic locations for matching`);
          console.log(`   Will check online status during assignment (more lenient)`);
          
          // Log if there's a mismatch
          if (onlineMechanics && onlineMechanics.length > 0) {
            const onlineMechanicIds = new Set(onlineMechanics.map((m: any) => m.id));
            const matchingLocations = directLocations.filter((loc: any) => onlineMechanicIds.has(loc.mechanic_id));
            console.log(`📊 [Request] ${matchingLocations.length} locations match online mechanics (out of ${directLocations.length} total)`);
            
            if (matchingLocations.length === 0 && directLocations.length > 0) {
              console.warn("⚠️ [Request] WARNING: Found mechanic locations but none match online mechanics!");
              console.warn("   Location mechanic IDs:", directLocations.map((l: any) => l.mechanic_id));
              console.warn("   Online mechanic IDs:", Array.from(onlineMechanicIds));
              console.warn("   ⚠️ Will still try to assign - using ALL locations (very lenient)");
            }
          } else {
            console.warn("⚠️ [Request] No online mechanics found in profiles, but have locations");
            console.warn("   Will try to assign using ALL locations (very lenient matching)");
          }
        } else {
          console.warn("⚠️ Direct query failed, trying view...", directError);
          locError = directError;
          
          // Approach 2: Try using the view (if it exists)
          const { data: viewLocations, error: viewError } = await supabase
            .from("online_mechanic_locations")
            .select("mechanic_id, latitude, longitude, updated_at")
            .order("updated_at", { ascending: false });
          
          if (!viewError && viewLocations) {
            locations = viewLocations;
            console.log("✅ View query successful");
          } else {
            console.warn("⚠️ View query also failed", viewError);
            locError = viewError || directError;
          }
        }

        if (locError) {
          console.error("❌ Error fetching mechanic locations:", locError);
          console.error("❌ Error details:", {
            code: locError.code,
            message: locError.message,
            details: locError.details,
            hint: locError.hint
          });
          
          // If RLS is blocking, try a different approach - check if we can at least see profiles
          console.log("⚠️ Trying alternative approach: checking profiles for online mechanics...");
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, availability_status")
            .eq("availability_status", "online");
          
          if (profileError) {
            console.error("❌ Also failed to check profiles:", profileError);
            toast.error("Failed to search for mechanics. Please check RLS policies or try again.");
          } else {
            console.log(`✅ Found ${profiles?.length || 0} online mechanics in profiles`);
            if (profiles && profiles.length > 0) {
              toast.error("Mechanics are online but location data is not accessible. Please contact admin.");
            } else {
              toast.error("No online mechanics found. An admin will assign a mechanic shortly.");
            }
          }
          return; // Exit early if we can't fetch locations
        } else {
          console.log(`✅ Found ${locations?.length || 0} mechanic locations in database`);
          if (locations && locations.length > 0) {
            console.log("📋 Sample locations:", locations.slice(0, 3).map((loc: any) => ({
              mechanic_id: loc.mechanic_id,
              lat: loc.latitude,
              lng: loc.longitude,
              updated_at: loc.updated_at
            })));
          }
        }

        if (!locations || locations.length === 0) {
          console.warn("⚠️ No mechanic locations found in database");
          console.warn("⚠️ This could mean:");
          console.warn("   1. No mechanics have shared their location yet");
          console.warn("   2. RLS policies are blocking access");
          console.warn("   3. Mechanics haven't gone online yet");
          toast.error("No online mechanics found nearby. An admin will assign a mechanic shortly.");
        } else {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371000; // metres
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };

          // EXTREMELY LENIENT: Accept ALL locations regardless of age
          const now = Date.now();
          const recentLocations = (locations || []).filter((loc: any) => {
            if (!loc.updated_at) {
              console.log(`⚠️ [Request] Mechanic ${loc.mechanic_id} has no updated_at timestamp, including anyway`);
              return true; // Include if no timestamp
            }
            const updatedAt = new Date(loc.updated_at).getTime();
            const age = now - updatedAt;
            const ageMinutes = (age / 1000 / 60).toFixed(1);
            const ageHours = (age / 1000 / 60 / 60).toFixed(1);
            if (age > 24 * 60 * 60 * 1000) {
              console.log(`⚠️ [Request] Mechanic ${loc.mechanic_id} location is ${ageHours} hours old (older than 24h, but including anyway)`);
            } else {
              console.log(`✅ [Request] Mechanic ${loc.mechanic_id} location is ${ageMinutes} minutes old (recent)`);
            }
            return true; // Include ALL locations regardless of age
          });

          console.log(`📊 [Request] Found ${recentLocations.length} mechanics with locations (including all, regardless of age)`);
          console.log(`📍 [Request] User location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
          
          if (recentLocations.length === 0) {
            console.error("❌ [Request] CRITICAL: No mechanic locations found at all!");
            console.error("   This means:");
            console.error("   1. No mechanics have shared their location");
            console.error("   2. RLS policies are blocking access");
            console.error("   3. mechanic_locations table is empty");
            toast.error("No mechanics have shared their location. Please contact admin.");
            return;
          }

          // Compute distances - KEEP RADIUS at 50km as requested
          const MAX_RADIUS_METERS = 50000; // 50 km (as requested)
          const candidates = recentLocations
            .map((loc: any) => {
              const lat = Number(loc.latitude);
              const lng = Number(loc.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                console.warn(`⚠️ Invalid coordinates for mechanic ${loc.mechanic_id}: lat=${lat}, lng=${lng}`);
                return null;
              }
              const dist = distanceMeters(location.lat, location.lng, lat, lng);
              // Handle exact same location (distance = 0 or very small) - ACCEPT ALWAYS
              const isSameLocation = dist < 50; // Less than 50 meters = same location (very lenient)
              const distanceDisplay = isSameLocation 
                ? `SAME LOCATION (${dist.toFixed(1)}m)` 
                : `${(dist / 1000).toFixed(2)}km (${dist.toFixed(0)}m)`;
              console.log(`📍 Mechanic ${loc.mechanic_id}:`);
              console.log(`   Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              console.log(`   User: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
              console.log(`   Distance: ${distanceDisplay}`);
              return { mechanic_id: loc.mechanic_id, dist, lat, lng, updated_at: loc.updated_at, isSameLocation };
            })
            .filter(Boolean)
            .filter((c: any) => {
              // Accept if within 50km OR if same location (distance < 10m) - SAME LOCATION ALWAYS ACCEPTED
              const withinRadius = c.dist <= MAX_RADIUS_METERS || c.isSameLocation;
              if (!withinRadius) {
                console.log(`⚠️ Mechanic ${c.mechanic_id} is ${(c.dist / 1000).toFixed(2)}km away (outside ${MAX_RADIUS_METERS / 1000}km radius)`);
              } else {
                if (c.isSameLocation) {
                  console.log(`✅✅✅ Mechanic ${c.mechanic_id} is at SAME LOCATION (${c.dist.toFixed(1)}m away) - PRIORITY MATCH!`);
                } else {
                  console.log(`✅ Mechanic ${c.mechanic_id} is within range: ${(c.dist / 1000).toFixed(2)}km`);
                }
              }
              return withinRadius;
            })
            // Sort: same location first, then by distance
            .sort((a: any, b: any) => {
              if (a.isSameLocation && !b.isSameLocation) return -1;
              if (!a.isSameLocation && b.isSameLocation) return 1;
              return a.dist - b.dist;
            });

          console.log(`✅ Found ${candidates.length} mechanics within ${MAX_RADIUS_METERS / 1000}km (or at same location)`);
          if (candidates.length > 0) {
            console.log("📋 Candidates (sorted by distance):", candidates.map((c: any) => ({
              mechanic_id: c.mechanic_id,
              distance_km: (c.dist / 1000).toFixed(2),
              distance_m: c.dist.toFixed(0)
            })));
          }

          if (candidates.length === 0) {
            console.error("❌ No mechanics found after filtering. Debug info:");
            console.error("  - Total locations fetched:", locations?.length || 0);
            console.error("  - Recent locations:", recentLocations.length);
            console.error("  - User location:", location);
            console.error("  - All mechanic locations with distances:", recentLocations.map((l: any) => {
              const lat = Number(l.latitude);
              const lng = Number(l.longitude);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                const dist = distanceMeters(location.lat, location.lng, lat, lng);
                return {
                  mechanic_id: l.mechanic_id,
                  lat: lat,
                  lng: lng,
                  distance_km: (dist / 1000).toFixed(2),
                  distance_m: dist.toFixed(0),
                  is_same_location: dist < 10
                };
              }
              return { mechanic_id: l.mechanic_id, error: "Invalid coordinates" };
            }));
            toast.error(`No mechanics within ${MAX_RADIUS_METERS / 1000} km. An admin will assign a mechanic shortly.`);
          } else {
            // AGGRESSIVE MATCHING: If mechanic has a location, assume they're available
            // Only skip if explicitly marked as "offline"
            // This is more lenient to ensure jobs get assigned
            let chosen: string | null = null;
            let checkedCount = 0;
            
            console.log(`🎯 Starting aggressive matching for ${candidates.length} candidates...`);
            
            for (const cand of candidates) {
              checkedCount++;
              const distanceText = cand.dist < 1000 
                ? `${cand.dist.toFixed(0)}m away` 
                : `${(cand.dist / 1000).toFixed(2)}km away`;
              
              console.log(`🔍 [Request] Checking mechanic ${cand.mechanic_id} (${distanceText})...`);
              console.log(`   [Request] Mechanic location: ${cand.lat.toFixed(6)}, ${cand.lng.toFixed(6)}`);
              console.log(`   [Request] User location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
              console.log(`   [Request] Distance: ${cand.dist.toFixed(2)}m (${(cand.dist / 1000).toFixed(3)}km)`);
              console.log(`   [Request] Is same location: ${cand.isSameLocation}`);
              
              // Try to check profile, but don't block if it fails
              let isExplicitlyOffline = false;
              let profileStatus = 'unknown';
              
              try {
                const { data: profile, error: profileError } = await supabase
                  .from("profiles")
                  .select("id, availability_status, verification_status")
                  .eq("id", cand.mechanic_id)
                  .maybeSingle();

                if (profileError) {
                  console.warn(`⚠️ [Request] Could not check profile for mechanic ${cand.mechanic_id}:`, profileError);
                  console.log(`✅ [Request] Assuming mechanic ${cand.mechanic_id} is available (has location, profile check failed)`);
                  profileStatus = 'check_failed';
                } else if (profile) {
                  profileStatus = profile.availability_status || 'null';
                  // Only skip if explicitly marked as "offline"
                  if (profile.availability_status === "offline") {
                    isExplicitlyOffline = true;
                    console.log(`❌ [Request] Mechanic ${cand.mechanic_id} is explicitly offline, skipping...`);
                  } else {
                    // online, null, undefined, or any other value → assume available
                    console.log(`✅ [Request] Mechanic ${cand.mechanic_id} status: ${profileStatus} → assuming available`);
                    if (profile.verification_status !== "approved") {
                      console.warn(`⚠️ [Request] Mechanic ${cand.mechanic_id} is not approved (${profile.verification_status}), but assigning anyway`);
                    }
                  }
                } else {
                  // No profile found → assume available (they have a location)
                  console.log(`✅ [Request] No profile found for mechanic ${cand.mechanic_id}, assuming available (has location)`);
                  profileStatus = 'no_profile';
                }
              } catch (err) {
                console.warn("⚠️ [Request] Error checking mechanic profile:", err);
                // On error, assume available (they have a location)
                console.log(`✅ [Request] Assuming mechanic ${cand.mechanic_id} is available (error checking profile, but has location)`);
                profileStatus = 'error';
              }
              
              // CRITICAL: Assign if not explicitly offline
              // Even if profile check fails, if they have a location, assign them
              if (!isExplicitlyOffline) {
                chosen = cand.mechanic_id;
                console.log(`✅✅✅ [Request] ASSIGNING to mechanic ${cand.mechanic_id}`);
                console.log(`   [Request] Distance: ${distanceText}`);
                console.log(`   [Request] Profile status: ${profileStatus}`);
                console.log(`   [Request] Same location: ${cand.isSameLocation}`);
                break;
              } else {
                console.log(`❌ [Request] Skipping mechanic ${cand.mechanic_id} - explicitly offline`);
              }
            }

            if (chosen) {
              // Assign mechanic_id but keep status as 'pending' so mechanic must accept
              console.log(`🎯 [Request] Attempting to assign job ${insertedData.id} to mechanic ${chosen}...`);
              const { error: assignError } = await supabase
                .from("job_requests")
                .update({ 
                  mechanic_id: chosen,
                  updated_at: new Date().toISOString()
                })
                .eq("id", insertedData.id);

              if (assignError) {
                console.error("❌ [Request] Failed to assign mechanic_id:", assignError);
                console.error("   Error details:", {
                  code: assignError.code,
                  message: assignError.message,
                  details: assignError.details,
                  hint: assignError.hint
                });
                toast.error("Could not assign a mechanic automatically. An admin will assign one soon.");
              } else {
                const assignedMechanic = candidates.find((c: any) => c.mechanic_id === chosen);
                const distanceText = assignedMechanic 
                  ? (assignedMechanic.dist < 1000 
                      ? `${assignedMechanic.dist.toFixed(0)}m away` 
                      : `${(assignedMechanic.dist / 1000).toFixed(2)}km away`)
                  : 'unknown distance';
                const sameLocationText = assignedMechanic?.isSameLocation ? " (SAME LOCATION!)" : "";
                toast.success(`✅ Mechanic assigned! (${distanceText}${sameLocationText}). They will need to accept the job.`);
                console.log(`✅✅✅ [Request] Successfully assigned job ${insertedData.id} to mechanic ${chosen}`);
                console.log(`   [Request] Distance: ${distanceText}`);
                console.log(`   [Request] Same location: ${assignedMechanic?.isSameLocation || false}`);
              }
            } else {
              console.error(`❌ [Request] Checked ${checkedCount} mechanics but none were available`);
              console.error("   [Request] This could mean:");
              console.error("   1. All mechanics are explicitly marked as 'offline'");
              console.error("   2. Profile checks are failing");
              console.error("   3. RLS policies are blocking access");
              console.error("   [Request] Candidates checked:", candidates.map((c: any) => ({
                mechanic_id: c.mechanic_id,
                distance: `${(c.dist / 1000).toFixed(2)}km`,
                same_location: c.isSameLocation
              })));
              toast.error("No available mechanics found nearby. An admin will assign one shortly.");
            }
          }
        }
      } catch (err) {
        console.error("❌ Error finding/assigning mechanic:", err);
        toast.error("Error finding nearby mechanics. An admin will assign one shortly.");
      }
      
      // Reset form
      setVehicleType("");
      setIssueDescription("");
      setLocation(null);
      setMediaFiles([]);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to submit request. Please try again.";
      
      if (error?.code === "PGRST116" || error?.message?.includes("permission denied")) {
        errorMessage = "Permission denied. Please make sure you're logged in and try again.";
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      } else if (error?.error_description) {
        errorMessage = `Error: ${error.error_description}`;
      }
      
      toast.error(errorMessage);
      
      // Log full error for debugging
      console.error("Full error details:", {
        error,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl lg:text-2xl">Request Roadside Assistance</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Fill in the details below and we'll connect you with a nearby mechanic
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="vehicleType" className="text-sm sm:text-base">Vehicle Type *</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger id="vehicleType" className="h-10 sm:h-11">
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issueDescription" className="text-sm sm:text-base">Issue Description *</Label>
            <Textarea
              id="issueDescription"
              placeholder="Describe the problem with your vehicle (minimum 10 characters)"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={4}
              maxLength={500}
              required
              className="text-sm sm:text-base min-h-[100px] sm:min-h-[120px]"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {issueDescription.length}/500 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="media">Upload Photos/Video (Optional)</Label>
            <div className="space-y-2">
              <Input
                id="media"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 5) {
                    toast.error("Maximum 5 files allowed");
                    return;
                  }
                  setMediaFiles(files);
                }}
                className="cursor-pointer"
              />
              {mediaFiles.length > 0 && (
                <div className="space-y-2">
                  {mediaFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50"
                    >
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMediaFiles(mediaFiles.filter((_, i) => i !== index));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload images or videos of the vehicle issue (max 5 files, 10MB each)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Your Location *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={getCurrentLocation}
                disabled={locationLoading}
                className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
              >
                {locationLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                <span className="hidden sm:inline">{location ? "Update Location" : "Capture Location"}</span>
                <span className="sm:hidden">{location ? "Update" : "Capture"}</span>
              </Button>
            </div>
            {location && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-muted p-2 sm:p-3 rounded">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="break-all">
                  Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              </div>
            )}
            {!location && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 p-2 sm:p-3 rounded">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Please capture your location to continue</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 sm:h-12 text-sm sm:text-base font-medium"
            disabled={isSubmitting || uploadingMedia || !location || !vehicleType || !issueDescription}
          >
            {isSubmitting || uploadingMedia ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadingMedia ? "Uploading Media..." : "Submitting Request..."}
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RequestAssistanceForm;


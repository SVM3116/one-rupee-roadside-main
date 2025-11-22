import { useEffect, useState, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { MapPin, Navigation, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import SimpleLocationDisplay from './SimpleLocationDisplay';

const containerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '12px',
};

interface LiveLocationTrackerProps {
  apiKey?: string;
  userLocation?: { lat: number; lng: number };
  mechanicId?: string;
  userId?: string;
  showRoute?: boolean;
  mode?: 'user' | 'mechanic'; // 'user' sees mechanic, 'mechanic' sees user
}

const LiveLocationTracker = ({
  apiKey,
  userLocation: initialUserLocation,
  mechanicId,
  userId,
  showRoute = true,
  mode = 'user'
}: LiveLocationTrackerProps) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(initialUserLocation || null);
  const [mechanicLocation, setMechanicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<{ user?: google.maps.Marker; mechanic?: google.maps.Marker }>({});

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate ETA (estimated time of arrival) in minutes
  const calculateETA = (distanceKm: number): string => {
    // Assuming average speed of 30 km/h in city traffic
    const avgSpeedKmh = 30;
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    
    if (timeMinutes < 1) return 'Less than 1 min';
    if (timeMinutes < 60) return `${timeMinutes} min`;
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Subscribe to user location updates
  useEffect(() => {
    if (!userId || mode !== 'mechanic') return;

    const fetchUserLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('user_locations')
          .select('latitude, longitude, updated_at')
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          const loc = {
            lat: Number(data.latitude),
            lng: Number(data.longitude)
          };
          setUserLocation(loc);
          setIsLive(true);
        }
      } catch (err) {
        console.error('Error fetching user location:', err);
      }
    };

    fetchUserLocation();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`user-location-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            const loc = {
              lat: Number(newData.latitude),
              lng: Number(newData.longitude)
            };
            setUserLocation(loc);
            setIsLive(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, mode]);

  // Subscribe to mechanic location updates
  useEffect(() => {
    if (!mechanicId || mode !== 'user') return;

    const fetchMechanicLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('mechanic_locations')
          .select('latitude, longitude, updated_at')
          .eq('mechanic_id', mechanicId)
          .single();

        if (!error && data) {
          const loc = {
            lat: Number(data.latitude),
            lng: Number(data.longitude)
          };
          setMechanicLocation(loc);
          setIsLive(true);
        }
      } catch (err) {
        console.error('Error fetching mechanic location:', err);
      }
    };

    fetchMechanicLocation();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`mechanic-location-${mechanicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_locations',
          filter: `mechanic_id=eq.${mechanicId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            const loc = {
              lat: Number(newData.latitude),
              lng: Number(newData.longitude)
            };
            setMechanicLocation(loc);
            setIsLive(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mechanicId, mode]);

  // Update distance and ETA when locations change
  useEffect(() => {
    if (userLocation && mechanicLocation) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        mechanicLocation.lat,
        mechanicLocation.lng
      );
      setDistance(dist);
      setEta(calculateETA(dist));
    }
  }, [userLocation, mechanicLocation]);

  // Center map on both locations
  useEffect(() => {
    if (mapRef.current && userLocation && mechanicLocation && typeof google !== 'undefined' && google.maps) {
      try {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        bounds.extend(new google.maps.LatLng(mechanicLocation.lat, mechanicLocation.lng));
        mapRef.current.fitBounds(bounds);
      } catch (error) {
        console.error("Error centering map:", error);
      }
    }
  }, [userLocation, mechanicLocation]);

  // If no API key, show simple location display instead
  if (!apiKey) {
    try {
      return (
        <SimpleLocationDisplay
          userLocation={userLocation || undefined}
          mechanicId={mechanicId}
          userId={userId}
          mode={mode}
        />
      );
    } catch (error) {
      console.error("Error rendering SimpleLocationDisplay:", error);
      return (
        <Card className="p-6">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Location tracking is active</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add Google Maps API key for interactive map view
            </p>
          </div>
        </Card>
      );
    }
  }

  const center = userLocation || mechanicLocation || { lat: 28.6139, lng: 77.2090 };
  const routePath = userLocation && mechanicLocation && showRoute
    ? [userLocation, mechanicLocation]
    : [];

  return (
    <Card className="p-4">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <div>
            <h3 className="font-semibold text-lg">Live Tracking</h3>
            <p className="text-xs text-muted-foreground">
              {isLive ? 'Real-time location updates active' : 'Waiting for location...'}
            </p>
          </div>
        </div>
        {distance !== null && (
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-2">
              <Navigation className="h-3 w-3" />
              {distance.toFixed(2)} km
            </Badge>
            {eta && (
              <Badge variant="outline" className="gap-2">
                <Clock className="h-3 w-3" />
                {eta}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border-2 border-primary/20">
        <LoadScript googleMapsApiKey={apiKey}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={13}
            onLoad={(map) => {
              if (map) {
                mapRef.current = map;
              }
            }}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            }}
          >
            {/* User Location Marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  url: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="20" cy="20" r="18" fill="#3B82F6" opacity="0.3"/>
                      <circle cx="20" cy="20" r="12" fill="#3B82F6" opacity="0.5"/>
                      <circle cx="20" cy="20" r="6" fill="#2563EB"/>
                    </svg>
                  `),
                  scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(40, 40) : undefined,
                  anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(20, 20) : undefined
                }}
                title="Your Location"
                animation={typeof google !== 'undefined' && google.maps ? google.maps.Animation.DROP : undefined}
              />
            )}

            {/* Mechanic Location Marker */}
            {mechanicLocation && (
              <Marker
                position={mechanicLocation}
                icon={{
                  url: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="25" cy="25" r="22" fill="#10B981" opacity="0.2"/>
                      <circle cx="25" cy="25" r="16" fill="#10B981" opacity="0.4"/>
                      <circle cx="25" cy="25" r="10" fill="#059669"/>
                      <circle cx="25" cy="25" r="4" fill="#FFFFFF"/>
                    </svg>
                  `),
                  scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(50, 50) : undefined,
                  anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(25, 25) : undefined
                }}
                title={`Mechanic Location${distance ? ` • ${distance.toFixed(2)} km away • ETA: ${eta}` : ''}`}
                animation={typeof google !== 'undefined' && google.maps ? google.maps.Animation.BOUNCE : undefined}
              />
            )}

            {/* Route Line */}
            {routePath.length === 2 && typeof google !== 'undefined' && google.maps && (
              <Polyline
                path={routePath}
                options={{
                  strokeColor: '#10B981',
                  strokeOpacity: 0.8,
                  strokeWeight: 5,
                  icons: [{
                    icon: {
                      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 4,
                      strokeColor: '#10B981'
                    },
                    offset: '50%',
                    repeat: '100px'
                  }]
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>

        {/* Live Indicator Overlay */}
        {isLive && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-green-200">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-700">Live</span>
            </div>
          </div>
        )}
      </div>

      {/* Location Status Cards */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {userLocation && (
          <Card className="p-3 bg-blue-50 dark:bg-blue-950 border-blue-200">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">User Location</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </Card>
        )}
        {mechanicLocation && (
          <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs font-medium text-green-900 dark:text-green-100">Mechanic Location</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {mechanicLocation.lat.toFixed(4)}, {mechanicLocation.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
};

export default LiveLocationTracker;


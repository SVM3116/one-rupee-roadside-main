import { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';

const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px',
};

interface MechanicLocation {
  id: string;
  mechanic_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

interface MapProps {
  apiKey?: string;
  trackingMechanicId?: string;
  showRoute?: boolean;
  userLocation?: { lat: number; lng: number };
  showNearbyMechanics?: boolean;
}

const Map = ({ apiKey: providedApiKey, trackingMechanicId, showRoute = false, userLocation, showNearbyMechanics = true }: MapProps) => {
  const [currentLocation, setCurrentLocation] = useState(userLocation || { lat: 28.6139, lng: 77.2090 });
  const [apiKey, setApiKey] = useState(providedApiKey || '');
  const [mechanicLocation, setMechanicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyMechanics, setNearbyMechanics] = useState<Array<{ id: string; lat: number; lng: number; name?: string }>>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // Helper to safely get google.maps.Animation
  const getAnimation = (type: 'DROP' | 'BOUNCE') => {
    if (!isMapLoaded) return undefined;
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        return (window as any).google.maps.Animation[type];
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  };

  // Update current location if userLocation prop changes
  useEffect(() => {
    if (userLocation) {
      setCurrentLocation(userLocation);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, [userLocation]);

  // Fetch nearby online mechanics
  useEffect(() => {
    if (!showNearbyMechanics || !currentLocation || trackingMechanicId) return;

    const fetchNearbyMechanics = async () => {
      try {
        const { data: locations, error } = await supabase
          .from('mechanic_locations')
          .select('mechanic_id, latitude, longitude, updated_at')
          .order('updated_at', { ascending: false });

        if (error) throw error;

        // Filter mechanics who are online and within reasonable distance
        const mechanics = (locations || []).map((loc: any) => ({
          id: loc.mechanic_id,
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        })).filter((m: any) => 
          Number.isFinite(m.lat) && Number.isFinite(m.lng)
        );

        setNearbyMechanics(mechanics);
      } catch (error) {
        console.error('Error fetching nearby mechanics:', error);
      }
    };

    fetchNearbyMechanics();
    const interval = setInterval(fetchNearbyMechanics, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [currentLocation, showNearbyMechanics, trackingMechanicId]);

  useEffect(() => {
    if (!trackingMechanicId) return;

    const fetchMechanicLocation = async () => {
      const { data } = await supabase
        .from('mechanic_locations')
        .select('*')
        .eq('mechanic_id', trackingMechanicId)
        .single();

      if (data) {
        setMechanicLocation({
          lat: Number(data.latitude),
          lng: Number(data.longitude),
        });
      }
    };

    fetchMechanicLocation();

    const channel = supabase
      .channel('mechanic-location-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_locations',
          filter: `mechanic_id=eq.${trackingMechanicId}`,
        },
        (payload) => {
          console.log('Location update received:', payload);
          const newData = payload.new as MechanicLocation;
          setMechanicLocation({
            lat: Number(newData.latitude),
            lng: Number(newData.longitude),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackingMechanicId]);

  if (!apiKey) {
    return (
      <div className="p-6 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Google Maps Setup Required</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          To use the map feature, please enter your Google Maps API key below.
          Get your key from the{' '}
          <a
            href="https://console.cloud.google.com/google/maps-apis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Cloud Console
          </a>
          .
        </p>
        <div className="space-y-2">
          <Label htmlFor="apiKey">Google Maps API Key</Label>
          <Input
            id="apiKey"
            type="text"
            placeholder="Enter your Google Maps API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>
    );
  }

  const routePath = mechanicLocation && showRoute
    ? [mechanicLocation, currentLocation]
    : [];

  return (
    <div className="relative">
      {trackingMechanicId && mechanicLocation && (
        <Badge className="absolute top-4 left-4 z-10 bg-green-600 text-white">
          Mechanic is on the way
        </Badge>
      )}
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mechanicLocation || currentLocation}
          zoom={13}
          onLoad={() => setIsMapLoaded(true)}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* User's current location */}
          <Marker
            position={currentLocation}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            }}
            title="Your Location"
            animation={getAnimation('DROP')}
          />

          {!trackingMechanicId && showNearbyMechanics && nearbyMechanics.map((mechanic) => (
            <Marker
              key={mechanic.id}
              position={{ lat: mechanic.lat, lng: mechanic.lng }}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
              }}
              title="Available Mechanic"
            />
          ))}

          {mechanicLocation && (
            <Marker
              position={mechanicLocation}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
              }}
              title="Mechanic Location"
              animation={getAnimation('BOUNCE')}
            />
          )}

          {routePath.length > 0 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: '#FF6600',
                strokeOpacity: 0.8,
                strokeWeight: 4,
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default Map;

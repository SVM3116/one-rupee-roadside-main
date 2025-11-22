import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface SimpleLocationDisplayProps {
  userLocation?: { lat: number; lng: number };
  mechanicId?: string;
  userId?: string;
  mode?: 'user' | 'mechanic';
}

const SimpleLocationDisplay = ({
  userLocation: initialUserLocation,
  mechanicId,
  userId,
  mode = 'user'
}: SimpleLocationDisplayProps) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(initialUserLocation || null);
  const [mechanicLocation, setMechanicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

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

  // Calculate ETA
  const calculateETA = (distanceKm: number): string => {
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

  // Update distance and ETA
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

  const openGoogleMaps = () => {
    if (mode === 'user' && mechanicLocation) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${mechanicLocation.lat},${mechanicLocation.lng}`, '_blank');
    } else if (mode === 'mechanic' && userLocation) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${userLocation.lat},${userLocation.lng}`, '_blank');
    }
  };

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

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {userLocation && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">User Location</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
        {mechanicLocation && (
          <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Navigation className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Mechanic Location</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {mechanicLocation.lat.toFixed(6)}, {mechanicLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Navigate Button */}
      {((mode === 'user' && mechanicLocation) || (mode === 'mechanic' && userLocation)) && (
        <Button onClick={openGoogleMaps} className="w-full" variant="outline">
          <Navigation className="h-4 w-4 mr-2" />
          Open in Google Maps
        </Button>
      )}

      {/* Info Message */}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          💡 <strong>Tip:</strong> Add Google Maps API key to enable interactive map view. 
          Location tracking works without it!
        </p>
      </div>
    </Card>
  );
};

export default SimpleLocationDisplay;


// ETA calculation utilities using Google Maps Distance Matrix API

interface ETAResult {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  status: string;
}

/**
 * Calculate ETA using Google Maps Distance Matrix API
 */
export async function calculateETA(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey: string
): Promise<ETAResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${origin.lat},${origin.lng}` +
      `&destinations=${destination.lat},${destination.lng}` +
      `&units=metric` +
      `&mode=driving` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      return {
        distance: element.distance,
        duration: element.duration,
        status: element.status,
      };
    }

    return null;
  } catch (error) {
    console.error('Error calculating ETA:', error);
    return null;
  }
}

/**
 * Format duration from seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'Less than 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format distance from meters to human-readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}


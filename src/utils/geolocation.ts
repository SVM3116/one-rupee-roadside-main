/**
 * GPS-Only Geolocation Utility
 * Requires exact GPS location - no IP fallback
 * Location is mandatory for all users
 */

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'gps';
}

export interface GeolocationError {
  code: number;
  message: string;
  userFriendlyMessage: string;
  instructions?: string;
}

/**
 * Get user location - GPS ONLY (mandatory)
 * No IP fallback - exact GPS location required
 */
export const getLocation = async (
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  } = {}
): Promise<LocationResult> => {
  const {
    enableHighAccuracy = true,
    timeout = 20000, // Increased timeout for better success rate
    maximumAge = 30000, // Accept location up to 30 seconds old
  } = options;

  if (!navigator.geolocation) {
    throw {
      code: 0,
      message: 'Geolocation not supported',
      userFriendlyMessage: 'Your browser does not support location services.',
      instructions: 'Please use a modern browser (Chrome, Firefox, Safari, or Edge) with location support.',
    } as GeolocationError;
  }

  return await new Promise<LocationResult>((resolve, reject) => {
    // Try with high accuracy first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'gps',
        });
      },
      (error) => {
        console.error('GPS geolocation failed:', error);
        
        // If permission denied and on HTTP, provide specific instructions
        if (error.code === error.PERMISSION_DENIED && !isSecureContext()) {
          reject({
            code: error.code,
            message: error.message,
            userFriendlyMessage: 'Location permission is required. Please allow location access when prompted.',
            instructions: 'On HTTP: Click "Allow" when your browser asks for location permission. If no prompt appears, go to browser settings → Site Settings → Location → Allow, then refresh the page.',
          } as GeolocationError);
        } else {
          reject({
            code: error.code,
            message: error.message,
            userFriendlyMessage: getErrorMessage(error),
            instructions: getInstructions(error),
          } as GeolocationError);
        }
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  });
};

/**
 * Get user-friendly error message
 */
export const getErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access is required. Please allow location permissions to continue.';
    case error.POSITION_UNAVAILABLE:
      return 'GPS location unavailable. Please ensure your device GPS is enabled and try again.';
    case error.TIMEOUT:
      return 'Location request timed out. Please ensure GPS is enabled and try again.';
    default:
      return 'Unable to get your GPS location. Location is required to use this service.';
  }
};

/**
 * Get detailed instructions based on error
 */
export const getInstructions = (error: GeolocationPositionError): string => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isHTTP = !isSecureContext();
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      if (isHTTP) {
        if (isMobile) {
          return 'On HTTP (Mobile): 1) Allow location when browser prompts, 2) Or go to Settings → Site Settings → Location → Allow, 3) Then refresh the page.';
        } else {
          return 'On HTTP (Desktop): 1) Click "Allow" when browser asks for location, 2) Or click the location icon in address bar → Allow, 3) Then refresh the page.';
        }
      } else {
        if (isMobile) {
          return 'On mobile: Go to Settings → Site Settings → Location → Allow. Then refresh the page.';
        } else {
          return 'Click the location icon in your browser address bar and select "Allow". Then refresh the page.';
        }
      }
    case error.POSITION_UNAVAILABLE:
      return 'Enable GPS on your device: Settings → Location Services → Enable. Then refresh the page.';
    case error.TIMEOUT:
      return 'Ensure you are outdoors or near a window for better GPS signal. Then try again.';
    default:
      if (isHTTP) {
        return 'On HTTP: Allow location when prompted, or enable in browser settings → Site Settings → Location → Allow, then refresh.';
      }
      return 'Please enable location services in your device settings and browser, then refresh the page.';
  }
};

/**
 * Check if geolocation is available
 */
export const isGeolocationAvailable = (): boolean => {
  return 'geolocation' in navigator;
};

/**
 * Check if we're on HTTPS or localhost (required for geolocation)
 */
export const isSecureContext = (): boolean => {
  return window.isSecureContext || 
         window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

/**
 * Request location permission explicitly
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (!navigator.geolocation) {
    return false;
  }

  try {
    // Try to get location - this will trigger permission prompt
    await getLocation({ timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Watch position with better error handling
 */
export const watchPosition = (
  onSuccess: (location: LocationResult) => void,
  onError: (error: GeolocationError) => void,
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  } = {}
): number | null => {
  if (!navigator.geolocation) {
    onError({
      code: 0,
      message: 'Geolocation not supported',
      userFriendlyMessage: 'Your browser does not support location services.',
    });
    return null;
  }

  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 10000,
  } = options;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'gps',
      });
    },
    (error) => {
      onError({
        code: error.code,
        message: error.message,
        userFriendlyMessage: getErrorMessage(error),
      });
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }
  );

  return watchId;
};


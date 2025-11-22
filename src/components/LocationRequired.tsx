import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { getLocation, getErrorMessage, getInstructions, isSecureContext } from "@/utils/geolocation";

interface LocationRequiredProps {
  onLocationGranted: (location: { lat: number; lng: number }) => void;
  title?: string;
  description?: string;
}

const LocationRequired = ({ 
  onLocationGranted, 
  title = "Location Access Required",
  description = "GPS location is required to use this service. Please enable location permissions."
}: LocationRequiredProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    setIsSecure(isSecureContext());
    // Auto-request location on mount (will try even on HTTP)
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      handleRequestLocation();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleRequestLocation = async () => {
    setIsRequesting(true);
    setError(null);
    setInstructions(null);

    try {
      // Try to get location even on HTTP - don't block early
      // Many browsers allow geolocation on HTTP if user grants permission
      const location = await getLocation({
        enableHighAccuracy: true,
        timeout: 25000, // Increased timeout for better success
        maximumAge: 30000,
      });

      // Success!
      onLocationGranted({ lat: location.lat, lng: location.lng });
      toast.success("Location access granted!");
      setIsRequesting(false);
    } catch (err: any) {
      console.error("Location error:", err);
      setError(err.userFriendlyMessage || "Failed to get location");
      
      // Get instructions from error or generate from error code
      if (err.instructions) {
        setInstructions(err.instructions);
      } else if (err.code !== undefined) {
        // Create a mock error object for getInstructions
        const mockError = {
          code: err.code,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError;
        setInstructions(getInstructions(mockError));
      } else {
        // Provide helpful instructions based on context
        if (!isSecure) {
          setInstructions("On HTTP: Some browsers may block location. Try: 1) Allow location when prompted, 2) Use HTTPS, or 3) Enable location in browser settings → Site Settings → Location → Allow");
        } else {
          setInstructions("Please enable location services in your device settings and browser, then refresh the page.");
        }
      }
      toast.error(err.userFriendlyMessage || "Location access is required");
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            <MapPin className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSecure && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    HTTP Connection Detected
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Location may work on HTTP if you allow permissions. For best results, use HTTPS or localhost. Click the button below to request location access.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {error}
                  </p>
                  {instructions && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                      {instructions}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleRequestLocation}
              disabled={isRequesting}
              className="w-full"
              size="lg"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Requesting Location...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Enable Location Access
                </>
              )}
            </Button>

            <div className="text-xs text-center text-muted-foreground space-y-1">
              <p>• Location is required for all users</p>
              <p>• We use GPS for exact location (not approximate)</p>
              <p>• Your location is only used for service matching</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center space-y-1">
              <strong>How to enable location:</strong>
              <br />
              {typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? (
                <>
                  <span className="block">1. Click "Enable Location Access" above</span>
                  <span className="block">2. Allow when browser prompts</span>
                  <span className="block">3. Or: Settings → Site Settings → Location → Allow</span>
                </>
              ) : (
                <>
                  <span className="block">1. Click "Enable Location Access" above</span>
                  <span className="block">2. Click "Allow" when browser asks</span>
                  <span className="block">3. Or: Click location icon in address bar → Allow</span>
                </>
              )}
              {!isSecure && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Note: On HTTP, you may need to manually allow location in browser settings.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationRequired;


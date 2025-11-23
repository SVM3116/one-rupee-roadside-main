import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import carImage from "@/assets/car.png";
import "./LoadingScreen.css";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // Total duration in milliseconds
}

const LoadingScreen = ({ onComplete, duration = 4000 }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start fade out near the end
    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
    }, duration - 300);

    // Complete callback
    const completeTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`loading-screen ${!isVisible ? "fade-out" : ""}`}>
      <div className="loading-container">
        {/* Real Car Image - Centered */}
        <div className="car-image-container">
          <img 
            src={carImage} 
            alt="Car" 
            className="car-image"
          />
        </div>

        {/* Brand Text - Below the car */}
        <div className="brand-text-below">
          <h1 className="brand-name-below">ONE RUPEE RAPIDFIX</h1>
          <p className="brand-tagline-below">WHEN ROADS STOP YOU, WE DON'T.</p>
        </div>
      </div>
    </div>
  );
};

// Hook to show loading screen on route changes
export const useLoadingScreen = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return isLoading;
};

export default LoadingScreen;


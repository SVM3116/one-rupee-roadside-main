import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import carImage from "@/assets/car.png";
import logoImage from "@/assets/logo.png";
import "./LoadingScreen.css";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // Total duration in milliseconds
}

const LoadingScreen = ({ onComplete, duration = 2000 }: LoadingScreenProps) => {
  const [phase, setPhase] = useState<'car-moving' | 'car-fading' | 'logo-appearing' | 'name-appearing' | 'tagline-appearing' | 'complete'>('car-moving');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Phase 1: Car moves from left to center (0-1s)
    const carMoveTimer = setTimeout(() => {
      setPhase('car-fading');
    }, 1000);

    // Phase 2: Car fades out (1-1.5s)
    const carFadeTimer = setTimeout(() => {
      setPhase('logo-appearing');
    }, 1500);

    // Phase 3: Logo appears (1.5-1.7s)
    const logoTimer = setTimeout(() => {
      setPhase('name-appearing');
    }, 1700);

    // Phase 4: Name appears (1.7-1.85s)
    const nameTimer = setTimeout(() => {
      setPhase('tagline-appearing');
    }, 1850);

    // Phase 5: Complete and fade out (2s)
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => {
      clearTimeout(carMoveTimer);
      clearTimeout(carFadeTimer);
      clearTimeout(logoTimer);
      clearTimeout(nameTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`loading-screen ${phase === 'complete' ? "fade-out" : ""}`}>
      <div className="loading-container">
        {/* Car Image - Moves from left to center, then fades out */}
        <div className={`car-image-container ${phase !== 'car-moving' ? 'car-fade-out' : ''}`}>
          <img 
            src={carImage} 
            alt="Car" 
            className="car-image"
          />
        </div>

        {/* Logo - Appears after car disappears */}
        <div className={`logo-container ${phase === 'logo-appearing' || phase === 'name-appearing' || phase === 'tagline-appearing' || phase === 'complete' ? 'logo-fade-in' : 'logo-hidden'}`}>
          <img 
            src={logoImage} 
            alt="Logo" 
            className="logo-image"
          />
        </div>

        {/* Brand Name - Appears after logo */}
        <div className={`brand-text-below ${phase === 'name-appearing' || phase === 'tagline-appearing' || phase === 'complete' ? 'name-fade-in' : 'name-hidden'}`}>
          <h1 className="brand-name-below">ONE RUPEE RAPIDFIX</h1>
        </div>

        {/* Tagline - Appears last */}
        <div className={`brand-tagline-container ${phase === 'tagline-appearing' || phase === 'complete' ? 'tagline-fade-in' : 'tagline-hidden'}`}>
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
    }, 2000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return isLoading;
};

export default LoadingScreen;


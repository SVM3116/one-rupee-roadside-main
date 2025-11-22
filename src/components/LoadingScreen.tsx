import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import logoImage from "@/assets/logo1.png";
import "./LoadingScreen.css";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // Total duration in milliseconds
}

const LoadingScreen = ({ onComplete, duration = 4000 }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    // Show logo after car reaches center (at 50% of duration)
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, duration * 0.5);

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
      clearTimeout(logoTimer);
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
        {/* 3D Car */}
        <div className="car-container">
          <div className="car-3d">
            {/* Car Body */}
            <div className="car-body">
              <div className="car-top"></div>
              <div className="car-front"></div>
              <div className="car-back"></div>
              <div className="car-left"></div>
              <div className="car-right"></div>
            </div>
            
            {/* Car Windows */}
            <div className="car-windshield"></div>
            <div className="car-rear-window"></div>
            
            {/* Car Wheels */}
            <div className="wheel wheel-front-left"></div>
            <div className="wheel wheel-front-right"></div>
            <div className="wheel wheel-rear-left"></div>
            <div className="wheel wheel-rear-right"></div>
            
            {/* Car Details */}
            <div className="car-headlight car-headlight-left"></div>
            <div className="car-headlight car-headlight-right"></div>
            <div className="car-grille"></div>
          </div>
          
          {/* Motion Blur / Dust Trail */}
          <div className="motion-blur"></div>
        </div>

        {/* Brand Text - Moves with car */}
        <div className="brand-text-container">
          <h1 className="brand-name">ONE RUPEE RAPIDFIX</h1>
          <p className="brand-tagline">WHEN ROADS STOP YOU, WE DON'T.</p>
        </div>

        {/* Logo - Appears when car reaches center */}
        <div className={`logo-container ${showLogo ? "show" : ""}`}>
          <div className="logo-wrapper">
            <img 
              src={logoImage} 
              alt="ONE RUPEE RAPIDFIX Logo" 
              className="logo-image"
            />
            <div className="logo-glow"></div>
          </div>
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


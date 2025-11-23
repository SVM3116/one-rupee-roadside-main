import { useState, useEffect, useRef } from "react";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  letterDelay?: number;
  loopDelay?: number;
  isGradient?: boolean; // Explicitly mark if this is gradient text
}

const AnimatedText = ({ 
  text, 
  className = "", 
  delay = 0,
  letterDelay = 100,
  loopDelay = 1500,
  isGradient = false
}: AnimatedTextProps) => {
  const [displayedLetters, setDisplayedLetters] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Initial delay before starting animation
    if (delay === 0) {
      // Start immediately if no delay
      setIsAnimating(true);
      setDisplayedLetters(0);
    } else {
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(true);
        setDisplayedLetters(0);
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  useEffect(() => {
    if (!isAnimating) return;

    if (displayedLetters < text.length) {
      // Animate letters appearing one by one
      timeoutRef.current = setTimeout(() => {
        setDisplayedLetters((prev) => prev + 1);
      }, letterDelay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // All letters displayed, wait then reset for loop
      timeoutRef.current = setTimeout(() => {
        setDisplayedLetters(0);
        setIsAnimating(false);
        // Restart animation after a brief pause
        setTimeout(() => {
          setIsAnimating(true);
        }, 100);
      }, loopDelay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [displayedLetters, text.length, isAnimating, letterDelay, loopDelay]);

  const hasGradient = isGradient || className.includes('bg-clip-text') || className.includes('text-transparent');
  
  if (hasGradient) {
    // For gradient text: render all letters, use max-width to reveal progressively
    // Apply gradient to each letter span so bg-clip-text works correctly
    return (
      <span 
        style={{ 
          display: 'inline-block',
        }}
      >
        {text.split("").map((letter, index) => {
          const isVisible = index < displayedLetters;
          const isSpace = letter === " ";
          
          return (
            <span
              key={`${text}-${index}-${displayedLetters}`}
              className={`inline-block transition-all duration-200 overflow-hidden align-top ${className}`}
              style={{
                maxWidth: isVisible ? (isSpace ? '0.5rem' : '2ch') : '0',
                transform: isVisible ? 'translateY(0)' : 'translateY(1rem)',
                whiteSpace: 'nowrap',
                opacity: 1, // Always visible for gradient
              }}
            >
              {isSpace ? "\u00A0" : letter}
            </span>
          );
        })}
      </span>
    );
  }
  
  // For regular text: animate letters individually
  return (
    <span 
      className={className || ""} 
      style={{ 
        display: 'inline-block',
      }}
    >
      {text.split("").map((letter, index) => {
        const isVisible = index < displayedLetters;
        const isSpace = letter === " ";
        
        return (
          <span
            key={`${text}-${index}-${displayedLetters}`}
            className={`inline-block transition-all duration-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            } ${isSpace ? "w-2" : ""}`}
          >
            {isSpace ? "\u00A0" : letter}
          </span>
        );
      })}
    </span>
  );
};

export default AnimatedText;


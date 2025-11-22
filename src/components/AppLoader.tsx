import { useEffect, useState } from "react";
import LoadingScreen from "./LoadingScreen";

interface AppLoaderProps {
  children: React.ReactNode;
}

const AppLoader = ({ children }: AppLoaderProps) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Show loading screen on initial page load
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {isInitialLoad && (
        <LoadingScreen
          duration={4000}
          onComplete={() => setIsInitialLoad(false)}
        />
      )}
      {!isInitialLoad && children}
    </>
  );
};

export default AppLoader;


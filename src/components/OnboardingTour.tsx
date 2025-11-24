import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingTourProps {
  run: boolean;
  onComplete: () => void;
}

const OnboardingTour = ({ run, onComplete }: OnboardingTourProps) => {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    // Define tour steps
    const tourSteps: Step[] = [
      {
        target: "body",
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Welcome to ONE RUPEE RAPIDFIX! 👋</h3>
            <p>This quick tour will help you get started. Let's explore the key features.</p>
          </div>
        ),
        placement: "center",
        disableBeacon: true,
      },
      {
        target: '[data-tour="request-assistance"]',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Request Assistance 🚗</h3>
            <p>Click here to request roadside assistance. Fill in your vehicle type and issue description, then submit your request.</p>
          </div>
        ),
        placement: "auto",
      },
      {
        target: '[data-tour="location-permission"]',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Location Permission 📍</h3>
            <p>Allow location access when prompted. Your location is used to find nearby mechanics and enable live tracking.</p>
          </div>
        ),
        placement: "auto",
      },
      {
        target: '[data-tour="live-tracking"]',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Live Tracking 📱</h3>
            <p>Once a mechanic is assigned, you can see their real-time location on the map as they approach your location.</p>
          </div>
        ),
        placement: "auto",
      },
      {
        target: '[data-tour="my-requests"]',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">My Requests 📋</h3>
            <p>View all your past and current service requests here. You can see status updates and chat with mechanics.</p>
          </div>
        ),
        placement: "auto",
      },
      {
        target: '[data-tour="ratings"]',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Ratings & Reviews ⭐</h3>
            <p>After service completion, rate and review your mechanic to help others make informed decisions.</p>
          </div>
        ),
        placement: "auto",
      },
    ];

    setSteps(tourSteps);
  }, []);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Mark onboarding as completed in user profile
      // This ensures the tour won't show again for this user
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // First, ensure the user has a profile
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", session.user.id)
            .maybeSingle();

          if (existingProfile) {
            // Update onboarding_completed to true
            const { error } = await supabase
              .from("profiles")
              .update({ onboarding_completed: true })
              .eq("id", session.user.id);
            
            if (error) {
              console.warn("Could not update onboarding_completed:", error.message);
            } else {
              console.log("✅ Onboarding marked as completed for user");
            }
          } else {
            // Create profile with onboarding_completed = true
            const { error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || '',
                onboarding_completed: true
              });
            
            if (insertError) {
              console.warn("Could not create profile with onboarding status:", insertError.message);
            }
          }
        }
      } catch (error) {
        // Silently handle - onboarding column might not exist
        console.warn("Error saving onboarding status:", error);
      }

      onComplete();
    }
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#10b981",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "8px",
          padding: "20px",
        },
        buttonNext: {
          backgroundColor: "#10b981",
          borderRadius: "6px",
          padding: "8px 16px",
        },
        buttonBack: {
          color: "#6b7280",
          marginRight: "10px",
        },
        buttonSkip: {
          color: "#6b7280",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Got it!",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
};

export default OnboardingTour;


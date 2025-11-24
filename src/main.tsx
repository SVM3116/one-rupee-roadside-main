import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, requestNotificationPermission } from "./utils/notifications";
import { supabase } from "@/integrations/supabase/client";

// Register service worker and request notification permissions
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await registerServiceWorker();
      await requestNotificationPermission();
    } catch (error) {
      console.error('Failed to initialize service worker:', error);
    }
  });
}

// Auto sign-out when tab is closed or browser cache is cleared
// Note: sessionStorage automatically clears when tab closes (but persists on refresh)
// So we DON'T manually clear it - that would cause unwanted sign-out on refresh

// Detect when browser cache/cookies are cleared using storage event
// This fires when storage is cleared in any tab/window
window.addEventListener('storage', async (e) => {
  // If storage was cleared (e.key is null means all storage was cleared)
  if (e.key === null || (e.key && e.oldValue && !e.newValue)) {
    // Storage was cleared - sign out
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
        // Clear any remaining storage
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch (error) {
      console.error('Error during storage clear sign-out:', error);
    }
  }
});

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error("Root element not found! Make sure index.html has a <div id='root'></div>");
}

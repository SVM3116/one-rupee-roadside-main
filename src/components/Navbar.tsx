import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMechanic, setIsMechanic] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
    });

    return () => subscription.unsubscribe();
  };

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    // If there are rows in the user_roles table, use those
    if (roleData && roleData.length > 0) {
      setIsAdmin(roleData.some((r: any) => r.role === "admin"));
      setIsMechanic(roleData.some((r: any) => r.role === "mechanic"));
      return;
    }

    // Fallback to auth user metadata if user_roles has no entry or is restricted by RLS
    const metaRole = (session.user as any)?.user_metadata?.role ?? (session.user as any)?.role ?? null;
    if (metaRole) {
      setIsAdmin(metaRole === "admin");
      setIsMechanic(metaRole === "mechanic");
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center">
            <Logo size="sm" showText={true} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/services" className="text-foreground hover:text-primary transition-colors">
              Services
            </Link>
            <Link to="/about" className="text-foreground hover:text-primary transition-colors">
              About
            </Link>
            <Link to="/contact" className="text-foreground hover:text-primary transition-colors">
              Contact
            </Link>
            {isMechanic && (
              <Link to="/mechanic" className="text-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {userId && <NotificationBell userId={userId} />}
            {!userId ? (
              <>
                <Link to="/auth">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium">
                    Traveller Login
                  </Button>
                </Link>
                <Link to="/auth?role=mechanic">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium">
                    🔧 Mechanic Login
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
                    Sign Up
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/profile">
                <Button variant="ghost">Profile</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4 border-t">
            <Link
              to="/"
              className="block py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/services"
              className="block py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              to="/about"
              className="block py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="block py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="block py-2 text-foreground hover:text-primary transition-colors flex items-center gap-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <div className="flex flex-col space-y-2 pt-4">
              <Link to="/auth">
                <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium">
                  Traveller Login
                </Button>
              </Link>
              <Link to="/auth?role=mechanic">
                <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium">
                  🔧 Mechanic Login
                </Button>
              </Link>
              <Link to="/auth">
                <Button className="w-full bg-gradient-to-r from-primary to-accent">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

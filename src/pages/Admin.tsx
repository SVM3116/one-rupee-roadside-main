import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import UsersTab from "@/components/admin/UsersTab";
import MechanicsTab from "@/components/admin/MechanicsTab";
import JobRequestsTab from "@/components/admin/JobRequestsTab";
import LiveTrackingTab from "@/components/admin/LiveTrackingTab";
import { Loader2 } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has admin role
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error || !roles) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 lg:py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">Admin Dashboard</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Manage users, mechanics, and job requests
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs defaultValue="live" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="live" className="text-xs sm:text-sm py-2 sm:py-3">Live Tracking</TabsTrigger>
                <TabsTrigger value="users" className="text-xs sm:text-sm py-2 sm:py-3">Users</TabsTrigger>
                <TabsTrigger value="mechanics" className="text-xs sm:text-sm py-2 sm:py-3">Mechanics</TabsTrigger>
                <TabsTrigger value="jobs" className="text-xs sm:text-sm py-2 sm:py-3">Job Requests</TabsTrigger>
              </TabsList>
              
              <TabsContent value="live">
                <LiveTrackingTab />
              </TabsContent>
              
              <TabsContent value="users">
                <UsersTab />
              </TabsContent>
              
              <TabsContent value="mechanics">
                <MechanicsTab />
              </TabsContent>
              
              <TabsContent value="jobs">
                <JobRequestsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;

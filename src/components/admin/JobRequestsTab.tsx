import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck } from "lucide-react";

interface JobRequest {
  id: string;
  user_id: string;
  mechanic_id: string | null;
  issue_description: string | null;
  vehicle_type: string | null;
  status: string;
  created_at: string;
  user_location: any;
}

interface Mechanic {
  id: string;
  email: string;
  full_name: string | null;
  availability_status: string;
}

const JobRequestsTab = () => {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
    fetchMechanics();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel("admin_job_requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching job requests:", error);
      toast({
        title: "Error",
        description: "Failed to fetch job requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMechanics = async () => {
    try {
      // Get mechanics by checking user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mechanic");

      if (roleError) {
        console.error("Error fetching mechanic roles:", roleError);
        // Fallback: try profiles directly
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, full_name, availability_status, verification_status")
          .eq("verification_status", "approved");

        if (profileError) throw profileError;
        setMechanics(profileData || []);
        return;
      }

      const mechanicUserIds = roleData?.map(r => r.user_id) || [];

      if (mechanicUserIds.length === 0) {
        setMechanics([]);
        return;
      }

      // Fetch profiles for these mechanics (don't filter by verification_status - show all)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, availability_status, verification_status")
        .in("id", mechanicUserIds);

      if (profileError) {
        console.error("❌ Error fetching profiles:", profileError);
        // Try without filtering
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, email, full_name, availability_status, verification_status");
        
        if (allProfiles) {
          // Filter manually
          const filtered = allProfiles.filter(p => mechanicUserIds.includes(p.id));
          setMechanics(filtered);
          console.log(`✅ Found ${filtered.length} mechanics (fallback query)`);
          return;
        }
        throw profileError;
      }
      
      console.log(`✅ Found ${profileData?.length || 0} mechanics`);
      console.log(`📊 Online mechanics: ${profileData?.filter(m => m.availability_status === "online").length || 0}`);
      console.log(`📊 Approved mechanics: ${profileData?.filter(m => m.verification_status === "approved").length || 0}`);
      
      setMechanics(profileData || []);
    } catch (error) {
      console.error("Error fetching mechanics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch mechanics",
        variant: "destructive",
      });
    }
  };

  const handleAssignMechanic = async (jobId: string, mechanicId: string) => {
    setAssigning(jobId);
    try {
      const { error } = await supabase
        .from("job_requests")
        .update({ 
          mechanic_id: mechanicId,
          status: "accepted"
        })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mechanic assigned successfully",
      });
      
      fetchJobs();
    } catch (error) {
      console.error("Error assigning mechanic:", error);
      toast({
        title: "Error",
        description: "Failed to assign mechanic",
        variant: "destructive",
      });
    } finally {
      setAssigning(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      accepted: "default",
      on_the_way: "default",
      completed: "default",
      cancelled: "destructive",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request ID</TableHead>
            <TableHead>Vehicle Type</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mechanic</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No job requests found
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">
                  {job.id.slice(0, 8)}...
                </TableCell>
                <TableCell>{job.vehicle_type || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {job.issue_description || "—"}
                </TableCell>
                <TableCell>{getStatusBadge(job.status)}</TableCell>
                <TableCell>
                  {job.mechanic_id ? (
                    <Badge variant="outline">Assigned</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(job.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {job.status === "pending" && !job.mechanic_id ? (
                    <Select
                      disabled={assigning === job.id}
                      onValueChange={(value) => handleAssignMechanic(job.id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Assign mechanic..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mechanics.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Loading mechanics...
                          </SelectItem>
                        ) : mechanics.filter(m => m.availability_status === "online" && m.verification_status === "approved").length === 0 ? (
                          <SelectItem value="none" disabled>
                            No online mechanics available
                          </SelectItem>
                        ) : (
                          <>
                            {mechanics
                              .filter(m => m.availability_status === "online" && m.verification_status === "approved")
                              .map((mechanic) => (
                                <SelectItem key={mechanic.id} value={mechanic.id}>
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-green-500" />
                                    <span>{mechanic.full_name || mechanic.email}</span>
                                    <Badge variant="outline" className="text-xs">Online</Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            {/* Also show offline but approved mechanics */}
                            {mechanics
                              .filter(m => m.availability_status !== "online" && m.verification_status === "approved")
                              .map((mechanic) => (
                                <SelectItem key={mechanic.id} value={mechanic.id}>
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-gray-500" />
                                    <span>{mechanic.full_name || mechanic.email}</span>
                                    <Badge variant="outline" className="text-xs text-gray-500">Offline</Badge>
                                  </div>
                                </SelectItem>
                              ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default JobRequestsTab;

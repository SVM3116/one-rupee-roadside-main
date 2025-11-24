import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, Download, Filter, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

const SkeletonTable = ({ rows = 5, cols = 7 }: { rows?: number; cols?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-2">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-12 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

interface JobRequest {
  id: string;
  user_id: string;
  mechanic_id: string | null;
  issue_description: string | null;
  vehicle_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  user_location: any;
}

interface Mechanic {
  id: string;
  email: string;
  full_name: string | null;
  availability_status: string;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

const JobRequestsTab = () => {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobRequest[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    user_id: 'all',
    mechanic_id: 'all',
    start_date: '',
    end_date: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
    fetchMechanics();
    fetchUsers();
    
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

  const applyFilters = useCallback(() => {
    try {
      if (!Array.isArray(jobs)) {
        setFilteredJobs([]);
        return;
      }

      let filtered = [...jobs];

      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(job => job.status === filters.status);
      }
      if (filters.user_id && filters.user_id !== 'all') {
        filtered = filtered.filter(job => job.user_id === filters.user_id);
      }
      if (filters.mechanic_id && filters.mechanic_id !== 'all') {
        filtered = filtered.filter(job => job.mechanic_id === filters.mechanic_id);
      }
      if (filters.start_date) {
        filtered = filtered.filter(job => new Date(job.created_at) >= new Date(filters.start_date));
      }
      if (filters.end_date) {
        filtered = filtered.filter(job => new Date(job.created_at) <= new Date(filters.end_date));
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(job => 
          job.id.toLowerCase().includes(searchLower) ||
          job.vehicle_type?.toLowerCase().includes(searchLower) ||
          job.issue_description?.toLowerCase().includes(searchLower)
        );
      }

      setFilteredJobs(filtered);
    } catch (error) {
      console.error("Error applying filters:", error);
      setFilteredJobs(jobs || []);
    }
  }, [jobs, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
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
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mechanic");

      if (!roleData || roleData.length === 0) {
        setMechanics([]);
        return;
      }

      const mechanicUserIds = roleData.map(r => r.user_id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email, full_name, availability_status, verification_status")
        .in("id", mechanicUserIds);

      setMechanics(profileData || []);
    } catch (error) {
      console.error("Error fetching mechanics:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch user IDs from user_roles table (both "user" and "traveler" roles)
      const { data: userRoleData, error: userError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "user");
      
      let userIds: string[] = [];
      
      if (!userError && userRoleData) {
        userIds = userRoleData.map(r => r.user_id);
      }
      
      // Try to fetch travelers, but don't fail if the role doesn't exist
      const { data: travelerRoleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "traveler");
      
      if (travelerRoleData && travelerRoleData.length > 0) {
        userIds = [...userIds, ...travelerRoleData.map(r => r.user_id)];
      }

      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch profiles for those user IDs
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (error) {
        console.error("Error fetching user profiles:", error);
        setUsers([]);
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const handleAssignMechanic = async (jobId: string, mechanicId: string) => {
    setAssigning(jobId);
    try {
      const { error } = await supabase
        .from("job_requests")
        .update({ 
          mechanic_id: mechanicId,
          status: "accepted",
          updated_at: new Date().toISOString()
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

  const exportToCSV = () => {
    const headers = ['ID', 'Vehicle Type', 'Issue', 'Status', 'User ID', 'Mechanic ID', 'Created At', 'Updated At'];
    const safeJobs = Array.isArray(filteredJobs) ? filteredJobs : [];
    const rows = safeJobs.map(job => [
      job.id,
      job.vehicle_type || '',
      job.issue_description || '',
      job.status,
      job.user_id,
      job.mechanic_id || '',
      new Date(job.created_at).toLocaleString(),
      new Date(job.updated_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `job_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${safeJobs.length} job requests to CSV`,
    });
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      user_id: 'all',
      mechanic_id: 'all',
      start_date: '',
      end_date: '',
      search: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      accepted: "default",
      on_the_way: "default",
      in_progress: "default",
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
    return <SkeletonTable rows={5} cols={7} />;
  }

  // Ensure all arrays are initialized
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeFilteredJobs = Array.isArray(filteredJobs) ? filteredJobs : [];
  const safeMechanics = Array.isArray(mechanics) ? mechanics : [];
  const safeUsers = Array.isArray(users) ? users : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Job Requests</h3>
          <p className="text-sm text-muted-foreground">
            {safeFilteredJobs.length} of {safeJobs.length} requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                setShowFilters(!showFilters);
              } catch (error) {
                console.error("Error toggling filters:", error);
              }
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={safeFilteredJobs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="w-full border rounded-lg bg-card p-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold">Filter Job Requests</h4>
              <p className="text-sm text-muted-foreground">
                Filter by status, user, mechanic, or date range
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  setShowFilters(false);
                } catch (error) {
                  console.error("Error closing filters:", error);
                }
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-filter">Search</Label>
              <Input
                id="search-filter"
                placeholder="Search by ID, vehicle, issue..."
                value={filters.search || ''}
                onChange={(e) => {
                  try {
                    setFilters({ ...filters, search: e.target.value });
                  } catch (error) {
                    console.error("Error updating search filter:", error);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select 
                value={filters.status || 'all'} 
                onValueChange={(value) => {
                  try {
                    setFilters({ ...filters, status: value });
                  } catch (error) {
                    console.error("Error updating status filter:", error);
                  }
                }}
              >
                <SelectTrigger id="status-filter" className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="on_the_way">On The Way</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-filter">User</Label>
              <Select 
                value={filters.user_id || 'all'} 
                onValueChange={(value) => {
                  try {
                    setFilters({ ...filters, user_id: value });
                  } catch (error) {
                    console.error("Error updating user filter:", error);
                  }
                }}
              >
                <SelectTrigger id="user-filter" className="w-full">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {safeUsers.length > 0 ? (
                    safeUsers.map((user) => {
                      if (!user || !user.id) return null;
                      return (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email || user.id}
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="none" disabled>No users available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mechanic-filter">Mechanic</Label>
              <Select 
                value={filters.mechanic_id || 'all'} 
                onValueChange={(value) => {
                  try {
                    setFilters({ ...filters, mechanic_id: value });
                  } catch (error) {
                    console.error("Error updating mechanic filter:", error);
                  }
                }}
              >
                <SelectTrigger id="mechanic-filter" className="w-full">
                  <SelectValue placeholder="All mechanics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mechanics</SelectItem>
                  {safeMechanics.length > 0 ? (
                    safeMechanics.map((mechanic) => {
                      if (!mechanic || !mechanic.id) return null;
                      return (
                        <SelectItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.full_name || mechanic.email || mechanic.id}
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="none" disabled>No mechanics available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => {
                  try {
                    setFilters({ ...filters, start_date: e.target.value });
                  } catch (error) {
                    console.error("Error updating start date filter:", error);
                  }
                }}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">End Date</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => {
                  try {
                    setFilters({ ...filters, end_date: e.target.value });
                  } catch (error) {
                    console.error("Error updating end date filter:", error);
                  }
                }}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request ID</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Mechanic</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeFilteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No job requests found
                </TableCell>
              </TableRow>
            ) : (
              safeFilteredJobs.map((job) => {
                if (!job || !job.id) return null;
                const user = safeUsers.find(u => u && u.id === job.user_id);
                const mechanic = safeMechanics.find(m => m && m.id === job.mechanic_id);
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{job.vehicle_type || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {job.issue_description || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-sm">
                      {user ? (user.full_name || user.email) : job.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {mechanic ? (
                        <Badge variant="outline">{mechanic.full_name || mechanic.email}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {/* Only show manual assignment if job is pending and not yet assigned by system */}
                      {job.status === "pending" && !job.mechanic_id ? (
                        <Select
                          disabled={assigning === job.id}
                          onValueChange={(value) => handleAssignMechanic(job.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Assign online mechanic..." />
                          </SelectTrigger>
                          <SelectContent>
                            {safeMechanics.length === 0 ? (
                              <SelectItem value="none" disabled>
                                Loading mechanics...
                              </SelectItem>
                            ) : safeMechanics.filter(m => m && m.availability_status === "online" && m.verification_status === "approved").length === 0 ? (
                              <SelectItem value="none" disabled>
                                No online mechanics available
                              </SelectItem>
                            ) : (
                              <>
                                {safeMechanics
                                  .filter(m => m && m.availability_status === "online" && m.verification_status === "approved")
                                  .map((mechanic) => {
                                    if (!mechanic || !mechanic.id) return null;
                                    return (
                                      <SelectItem key={mechanic.id} value={mechanic.id}>
                                        <div className="flex items-center gap-2">
                                          <UserCheck className="h-4 w-4 text-green-500" />
                                          <span>{mechanic.full_name || mechanic.email}</span>
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Online</Badge>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : job.status === "pending" && job.mechanic_id ? (
                        <div className="text-sm text-muted-foreground">
                          <Badge variant="secondary">Auto-assigned</Badge>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default JobRequestsTab;

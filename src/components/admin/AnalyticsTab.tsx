import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, MapPin } from "lucide-react";
import { GoogleMap, LoadScript, HeatmapLayer } from "@react-google-maps/api";

interface AnalyticsData {
  dailyRequests: { date: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  onlineMechanics: number;
  offlineMechanics: number;
  activeLocations: { location: string; count: number }[];
  averageResponseTime: number;
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  breakdownLocations: { lat: number; lng: number; weight: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AnalyticsTab = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }

      // Fetch all job requests
      const { data: jobs, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (jobsError) throw jobsError;

      // Fetch mechanics
      const { data: mechanics } = await supabase
        .from('profiles')
        .select('availability_status')
        .eq('role', 'mechanic');

      // Calculate daily requests
      const dailyMap = new Map<string, number>();
      (jobs || []).forEach(job => {
        const date = new Date(job.created_at).toISOString().split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });

      const dailyRequests = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate status breakdown
      const statusMap = new Map<string, number>();
      (jobs || []).forEach(job => {
        statusMap.set(job.status, (statusMap.get(job.status) || 0) + 1);
      });

      const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
        status: status.replace('_', ' '),
        count,
      }));

      // Calculate online/offline mechanics
      const onlineMechanics = mechanics?.filter(m => m.availability_status === 'online').length || 0;
      const offlineMechanics = (mechanics?.length || 0) - onlineMechanics;

      // Calculate active locations (simplified - group by approximate coordinates)
      const locationMap = new Map<string, number>();
      const breakdownLocationsMap = new Map<string, { lat: number; lng: number; count: number }>();
      
      (jobs || []).forEach(job => {
        if (job.user_location && job.user_location.lat && job.user_location.lng) {
          // For active locations list - round to 2 decimal places for grouping
          const lat = Math.round(job.user_location.lat * 100) / 100;
          const lng = Math.round(job.user_location.lng * 100) / 100;
          const key = `${lat},${lng}`;
          locationMap.set(key, (locationMap.get(key) || 0) + 1);
          
          // For heatmap - use exact coordinates with weight
          const exactKey = `${job.user_location.lat},${job.user_location.lng}`;
          if (breakdownLocationsMap.has(exactKey)) {
            const existing = breakdownLocationsMap.get(exactKey)!;
            existing.count += 1;
          } else {
            breakdownLocationsMap.set(exactKey, {
              lat: job.user_location.lat,
              lng: job.user_location.lng,
              count: 1
            });
          }
        }
      });

      const activeLocations = Array.from(locationMap.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Convert breakdown locations to heatmap data format
      const breakdownLocations = Array.from(breakdownLocationsMap.values()).map(loc => ({
        lat: loc.lat,
        lng: loc.lng,
        weight: loc.count
      }));

      // Calculate average response time (time from creation to accepted)
      const completedJobs = (jobs || []).filter(job => job.status === 'completed' && job.mechanic_id);
      let totalResponseTime = 0;
      let responseCount = 0;

      // Get all jobs with status changes from testimonials/requests
      // Simplified: calculate from creation to completion
      completedJobs.forEach(job => {
        const created = new Date(job.created_at).getTime();
        const updated = job.updated_at ? new Date(job.updated_at).getTime() : created;
        const responseTime = (updated - created) / (1000 * 60); // minutes
        totalResponseTime += responseTime;
        responseCount++;
      });

      const averageResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

      setAnalytics({
        dailyRequests,
        statusBreakdown,
        onlineMechanics,
        offlineMechanics,
        activeLocations,
        averageResponseTime,
        totalRequests: jobs?.length || 0,
        completedRequests: jobs?.filter(j => j.status === 'completed').length || 0,
        pendingRequests: jobs?.filter(j => j.status === 'pending').length || 0,
        breakdownLocations,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center py-8 text-muted-foreground">No analytics data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
          <p className="text-sm text-muted-foreground">System statistics and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalRequests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.completedRequests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{analytics.pendingRequests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageResponseTime} min</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Requests Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Requests</CardTitle>
            <CardDescription>Number of requests per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.dailyRequests}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Distribution of request statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Online/Offline Mechanics */}
        <Card>
          <CardHeader>
            <CardTitle>Mechanic Availability</CardTitle>
            <CardDescription>Online vs Offline mechanics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Online', count: analytics.onlineMechanics },
                { name: 'Offline', count: analytics.offlineMechanics },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Active Locations</CardTitle>
            <CardDescription>Most frequent breakdown locations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.activeLocations}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="location" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown Heatmap</CardTitle>
          <CardDescription>
            Visualize all breakdown locations on a heatmap. Red areas indicate high-density breakdown zones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
            <LoadScript 
              googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
              libraries={["visualization"]}
            >
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "600px" }}
                center={analytics.breakdownLocations.length > 0 ? {
                  lat: analytics.breakdownLocations[0]?.lat || 15.7765,
                  lng: analytics.breakdownLocations[0]?.lng || 74.4664
                } : { lat: 15.7765, lng: 74.4664 }}
                zoom={12}
                onLoad={(map) => {
                  // Google Maps is now loaded - check if window.google.maps exists
                  if (map && typeof window !== 'undefined' && window.google && window.google.maps) {
                    setIsGoogleMapsLoaded(true);
                  }
                }}
                options={{
                  streetViewControl: false,
                  mapTypeControl: true,
                  fullscreenControl: true,
                }}
              >
                {(() => {
                  // Only render heatmap if Google Maps is loaded and we have locations
                  if (!isGoogleMapsLoaded || analytics.breakdownLocations.length === 0) {
                    return null;
                  }
                  
                  // Double-check that window.google.maps exists
                  if (typeof window === 'undefined' || !window.google || !window.google.maps || !window.google.maps.LatLng) {
                    return null;
                  }
                  
                  try {
                    const heatmapData = analytics.breakdownLocations.map(loc => ({
                      location: new window.google.maps.LatLng(loc.lat, loc.lng),
                      weight: loc.weight || 1
                    }));
                    
                    const maxIntensity = analytics.breakdownLocations.length > 0 
                      ? Math.max(...analytics.breakdownLocations.map(l => l.weight || 1))
                      : 1;
                    
                    return (
                      <HeatmapLayer
                        data={heatmapData}
                        options={{
                          radius: 50,
                          opacity: 0.8,
                          maxIntensity: maxIntensity,
                          gradient: [
                            "rgba(0, 255, 255, 0)",
                            "rgba(0, 255, 255, 1)",
                            "rgba(0, 191, 255, 1)",
                            "rgba(0, 127, 255, 1)",
                            "rgba(0, 63, 255, 1)",
                            "rgba(0, 0, 255, 1)",
                            "rgba(0, 0, 223, 1)",
                            "rgba(0, 0, 191, 1)",
                            "rgba(0, 0, 159, 1)",
                            "rgba(0, 0, 127, 1)",
                            "rgba(63, 0, 91, 1)",
                            "rgba(127, 0, 63, 1)",
                            "rgba(191, 0, 31, 1)",
                            "rgba(255, 0, 0, 1)"
                          ]
                        }}
                      />
                    );
                  } catch (error) {
                    console.error('Error creating heatmap data:', error);
                    return null;
                  }
                })()}
              </GoogleMap>
            </LoadScript>
          ) : (
            <div className="h-96 flex items-center justify-center bg-muted rounded-lg">
              <div className="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Google Maps API key not configured</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add VITE_GOOGLE_MAPS_API_KEY to .env for heatmap visualization
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;


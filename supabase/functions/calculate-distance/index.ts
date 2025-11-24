import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat1, lng1, lat2, lng2 } = await req.json();

    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: lat1, lng1, lat2, lng2' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Haversine formula to calculate distance
    const R = 6371000; // Earth's radius in meters
    const toRad = (degrees: number) => degrees * (Math.PI / 180);

    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLng = toRad(Number(lng2) - Number(lng1));

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    const distanceKm = distanceMeters / 1000;
    const distanceMiles = distanceKm * 0.621371;

    return new Response(
      JSON.stringify({
        success: true,
        distance_meters: Math.round(distanceMeters * 100) / 100,
        distance_km: Math.round(distanceKm * 100) / 100,
        distance_miles: Math.round(distanceMiles * 100) / 100,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});


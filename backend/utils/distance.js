/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Find nearest mechanics within radius
 * @param {Array} mechanics - Array of mechanic objects with location
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {number} maxRadiusMeters - Maximum radius in meters (default 10km)
 * @returns {Array} Sorted array of mechanics by distance
 */
function findNearestMechanics(mechanics, userLat, userLng, maxRadiusMeters = 10000) {
  return mechanics
    .map(mechanic => {
      if (!mechanic.currentLocation || !mechanic.currentLocation.lat || !mechanic.currentLocation.lng) {
        return null;
      }
      const distance = calculateDistance(
        userLat,
        userLng,
        mechanic.currentLocation.lat,
        mechanic.currentLocation.lng
      );
      return {
        ...mechanic.toObject(),
        distance,
      };
    })
    .filter(mechanic => mechanic !== null && mechanic.distance <= maxRadiusMeters)
    .sort((a, b) => a.distance - b.distance);
}

module.exports = {
  calculateDistance,
  findNearestMechanics,
  toRad,
};


const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export type GeoCheckResult = { ok: true } | { ok: false; reason: "too_far" };

export function checkWithinSchoolRadius(
  lat: number,
  lng: number,
  school: { latitude: number; longitude: number; radiusMeters: number },
): GeoCheckResult {
  const distance = haversineMeters(lat, lng, school.latitude, school.longitude);
  return distance <= school.radiusMeters ? { ok: true } : { ok: false, reason: "too_far" };
}

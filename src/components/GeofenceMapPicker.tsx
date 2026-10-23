import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface GeofenceMapPickerProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** Called when the pin is dragged or the map is tapped */
  onChange: (latitude: number, longitude: number) => void;
  /** When provided, renders the radius slider under the map */
  onRadiusChange?: (radiusMeters: number) => void;
  height?: number;
}

/** Marker: simple accurate center dot with a white ring (no bundled images needed) */
const createSchoolIcon = () =>
  L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#C62828;border:3px solid #ffffff;border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const zoomForRadius = (radius: number): number => {
  if (radius <= 60) return 18;
  if (radius <= 150) return 17;
  if (radius <= 400) return 16;
  if (radius <= 1000) return 15;
  return 14;
};

/**
 * Interactive OpenStreetMap view for setting the school geofence:
 * drag the red pin (or tap the map) to move the school center, drag the
 * slider to resize the attendance radius. Free - no API key required.
 */
export const GeofenceMapPicker: React.FC<GeofenceMapPickerProps> = ({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  onRadiusChange,
  height = 260,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const schedule = (fn: () => void, delay = 450) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  };

  const fitToCircle = (map: L.Map, circle: L.Circle) => {
    try {
      map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18, animate: false });
    } catch {
      /* bounds not ready yet */
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  /**
   * Geocodes a typed address/place into coordinates using Nominatim
   * (OpenStreetMap) - free, no API key, no billing. Policy:1 request per
   * user action, which this manual search satisfies.
   */
  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || isSearching) return;
    setIsSearching(true);
    setSearchStatus(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;

      if (!Array.isArray(rows) || rows.length === 0) {
        setSearchStatus({
          kind: 'error',
          message: 'No match found. Try a fuller address, e.g. "Dansoman, Accra" or the school name.',
        });
        return;
      }

      const hit = rows[0];
      const lat = Number(Number(hit.lat).toFixed(6));
      const lng = Number(Number(hit.lon).toFixed(6));
      onChangeRef.current(lat, lng);
      setSearchStatus({ kind: 'ok', message: `Matched: ${hit.display_name}` });

      // Re-frame the view around the matched location once the pin has moved
      setTimeout(() => {
        const map = mapRef.current;
        const circle = circleRef.current;
        if (map && circle) fitToCircle(map, circle);
      }, 650);
    } catch {
      setSearchStatus({ kind: 'error', message: 'Search failed — check your internet connection and try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize the map exactly once (safe under StrictMode double-mount)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([latitude, longitude], zoomForRadius(radiusMeters));

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { icon: createSchoolIcon(), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
    });

    const circle = L.circle([latitude, longitude], {
      radius: radiusMeters,
      color: '#C62828',
      weight: 2,
      fillColor: '#C62828',
      fillOpacity: 0.12,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Fit the geofence into view once laid out; keep in sync when the
    // container is resized or revealed (e.g. tab switches)
    schedule(() => fitToCircle(map, circle), 150);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Intentionally once: later coordinate/radius changes sync via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external coordinate changes (typed inputs, "Use Device GPS" button)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const current = marker.getLatLng();
    if (Math.abs(current.lat - latitude) > 1e-7 || Math.abs(current.lng - longitude) > 1e-7) {
      const target = L.latLng(latitude, longitude);
      marker.setLatLng(target);
      circle.setLatLng(target);
      // Debounced so typing digits doesn't make the map jump around
      schedule(() => map.panTo(target, { animate: false }));
    }
  }, [latitude, longitude]);

  // Follow external radius changes (number input or slider)
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return;

    if (Math.abs(circle.getRadius() - radiusMeters) > 0.5) {
      circle.setRadius(radiusMeters);
      schedule(() => fitToCircle(map, circle), 500);
    }
  }, [radiusMeters]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const sliderValue = Math.min(2000, Math.max(20, Math.round(radiusMeters)));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder='Type an address or place — e.g. "Dansoman, Accra"'
            aria-label="Search location by address or place name"
            className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-8 pr-3 text-xs text-[#202124] focus:ring-2 focus:ring-[#C62828]"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || searchQuery.trim().length === 0}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#C62828] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#8E1B1B] disabled:opacity-50"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Finding...</span>
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              <span>Find</span>
            </>
          )}
        </button>
      </div>

      {searchStatus && (
        <p
          role="status"
          className={`break-words text-[11px] leading-snug line-clamp-2 ${
            searchStatus.kind === 'ok' ? 'font-medium text-emerald-700' : 'font-semibold text-[#B91C1C]'
          }`}
        >
          {searchStatus.message}
        </p>
      )}

      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-gray-100"
        style={{ height }}
        aria-label="School geofence map"
      />

      {onRadiusChange && (
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-bold text-[#202124]">
            Radius: {radiusMeters}m
          </span>
          <input
            type="range"
            min={20}
            max={2000}
            step={5}
            value={sliderValue}
            onChange={(e) => onRadiusChange(parseInt(e.target.value, 10) || 100)}
            className="flex-1 accent-[#C62828]"
            aria-label="Geofence radius in meters"
          />
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[#667085]">
        Drag the <span className="font-bold text-[#C62828]">red pin</span> or tap anywhere on the map to set the
        school center — the red circle shows where attendance is accepted. Address search &amp; map ©
        OpenStreetMap (Nominatim).
      </p>
    </div>
  );
};

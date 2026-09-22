import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LayerItem } from '../traits/registerLayerManagerTrait';

// Leaflet resolves its default marker icons relative to the stylesheet, which a
// bundler breaks. Point them at the copies Vite emits from the installed
// `leaflet` package so the icons ship with the build (no CDN at runtime).
const MARKER_ICON_URL = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const MARKER_ICON_RETINA_URL = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const MARKER_SHADOW_URL = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: MARKER_ICON_RETINA_URL,
  iconUrl: MARKER_ICON_URL,
  shadowUrl: MARKER_SHADOW_URL,
});

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Visual indicator emoji used per layer type in the badge strip. */
const LAYER_ICON: Record<string, string> = {
  points:     '📍',
  geojson:    '🗺️',
  choropleth: '🎨',
  heatmap:    '🔥',
};

interface MapComponentProps {
  title?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  /** Configured map layers (populated by the layer-manager trait). */
  layers?: LayerItem[];
}

/**
 * MapComponent — GrapesJS editor preview widget.
 *
 * Renders a real Leaflet/OpenStreetMap tile layer centred on the configured
 * coordinates.  When layers are configured, the component shows a badge strip
 * listing each layer's name, type, and bound data source.  Live data fetching
 * only happens in the generated React app (MapBlock.tsx), not here.
 *
 * Leaflet is driven imperatively (no React wrapper) so that centre/zoom trait
 * edits re-centre the existing map instead of needing a full remount.
 */
export const MapComponent: React.FC<MapComponentProps> = ({
  title = 'Location Map',
  latitude = 49.6116,
  longitude = 6.1319,
  zoom = 12,
  layers = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const popupText =
    layers.length > 0
      ? `${layers.length} layer${layers.length === 1 ? '' : 's'} configured`
      : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  // Build the map once; the effects below keep it in sync with the traits.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { scrollWheelZoom: false, zoomControl: true }).setView(
      [latitude, longitude],
      zoom,
    );
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    // Static preview marker at the configured centre.
    markerRef.current = L.marker([latitude, longitude]).addTo(map).bindPopup(popupText);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately empty deps: centre, zoom and popup are applied by the effects
    // below, so the map itself is created once and never torn down on an edit.
  }, []);

  // Re-centre when the centre/zoom traits change.
  useEffect(() => {
    mapRef.current?.setView([latitude, longitude], zoom);
    markerRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude, zoom]);

  // Keep the preview marker's popup in step with the current configuration.
  useEffect(() => {
    markerRef.current?.setPopupContent(popupText);
  }, [popupText]);

  return (
    <div
      className="map-container"
      style={{
        padding: '0',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      {title && (
        <h3
          style={{
            margin: '0',
            padding: '10px 12px',
            color: '#333',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            background: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
          }}
        >
          {title}
        </h3>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '300px' }} />

      {/* Per-layer badge strip — visible once layers are configured. */}
      {layers.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            background: '#e8f4f8',
            fontSize: '12px',
            color: '#2980b9',
            fontFamily: 'Arial, sans-serif',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {layers.map((layer, idx) => (
            <span
              key={idx}
              title={`type: ${layer.type}${layer.dataSource ? ` | source: ${layer.dataSource}` : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#d6eaf8',
                border: '1px solid #aed6f1',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{LAYER_ICON[layer.type] ?? '📍'}</span>
              <strong>{layer.name || `Layer ${idx + 1}`}</strong>
              {layer.dataSource && (
                <span style={{ opacity: 0.7 }}>← {layer.dataSource}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

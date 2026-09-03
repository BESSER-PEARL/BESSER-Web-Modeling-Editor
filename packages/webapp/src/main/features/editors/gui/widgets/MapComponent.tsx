import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayerItem } from '../traits/registerLayerManagerTrait';

// Fix Leaflet's default marker icon — Vite asset handling breaks the built-in URL
// resolution, so we point it at the CDN copies explicitly.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
 */
export const MapComponent: React.FC<MapComponentProps> = ({
  title = 'Location Map',
  latitude = 49.6116,
  longitude = 6.1319,
  zoom = 12,
  layers = [],
}) => {
  const center: [number, number] = [latitude, longitude];

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

      <div style={{ width: '100%', height: '300px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={false}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Static preview marker at the configured centre. */}
          <Marker position={center}>
            <Popup>
              {layers.length > 0
                ? `${layers.length} layer${layers.length === 1 ? '' : 's'} configured`
                : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

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

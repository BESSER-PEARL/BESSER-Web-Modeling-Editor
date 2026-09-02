import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon — Vite asset handling breaks the built-in URL
// resolution, so we point it at the CDN copies explicitly.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  title?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  /** ID of the bound domain class (used in the editor preview label). */
  'data-source'?: string;
  'latitude-field'?: string;
  'longitude-field'?: string;
  'marker-label-field'?: string;
}

/**
 * MapComponent — GrapesJS editor preview widget.
 *
 * Renders a real Leaflet/OpenStreetMap tile layer centred on the configured
 * coordinates.  When a data-source class is bound the component shows a badge
 * indicating which class and field names will drive the markers at runtime
 * (the live fetch only happens in the generated React app, not in the editor).
 */
export const MapComponent: React.FC<MapComponentProps> = ({
  title = 'Location Map',
  latitude = 49.6116,
  longitude = 6.1319,
  zoom = 12,
  'data-source': dataSource,
  'latitude-field': latitudeField,
  'longitude-field': longitudeField,
  'marker-label-field': markerLabelField,
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
          {/* Show a static preview marker at the configured centre. */}
          <Marker position={center}>
            <Popup>
              {dataSource
                ? `Markers from: ${dataSource}`
                : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {dataSource && (
        <div
          style={{
            padding: '6px 12px',
            background: '#e8f4f8',
            fontSize: '12px',
            color: '#2980b9',
            fontFamily: 'Arial, sans-serif',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span>📍 Bound to: <strong>{dataSource}</strong></span>
          {latitudeField && <span>lat: <code>{latitudeField}</code></span>}
          {longitudeField && <span>lng: <code>{longitudeField}</code></span>}
          {markerLabelField && <span>label: <code>{markerLabelField}</code></span>}
        </div>
      )}
    </div>
  );
};

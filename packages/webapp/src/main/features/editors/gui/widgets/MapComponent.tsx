import React from 'react';

interface MapComponentProps {
  title?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  title = 'Location Map',
  latitude = 40.7128,
  longitude = -74.0060,
  zoom = 12,
}) => {
  // Using OpenStreetMap embed (no API key required)
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.05},${latitude - 0.05},${longitude + 0.05},${latitude + 0.05}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div
      className="map-container"
      style={{
        padding: '20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <h3 style={{ margin: '0 0 15px 0', color: '#333', fontFamily: 'Arial, sans-serif' }}>
        {title}
      </h3>
      <div style={{ width: '100%', height: '300px', borderRadius: '4px', overflow: 'hidden' }}>
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={mapUrl}
          style={{ border: '1px solid #ddd' }}
        />
      </div>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          📍 Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </p>
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#3498db', textDecoration: 'none' }}
        >
          View Larger Map
        </a>
      </div>
    </div>
  );
};

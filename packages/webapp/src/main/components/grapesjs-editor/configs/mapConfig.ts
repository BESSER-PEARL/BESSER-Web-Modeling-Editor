import { MapComponent } from '../widgets/MapComponent';

export interface MapConfig {
  id: string;
  label: string;
  component: React.FC<any>;
  defaultTitle: string;
  defaultLatitude: number;
  defaultLongitude: number;
  icon: string;
  traits: Array<{
    type: string;
    label: string;
    name: string;
    value: any;
    changeProp: number;
  }>;
}

// Map configuration
export const mapConfig: MapConfig = {
  id: 'map',
  label: 'Map',
  component: MapComponent,
  defaultTitle: 'Location Map',
  defaultLatitude: 49.6116,
  defaultLongitude: 6.1319,
  icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z"/></svg>',
  traits: [
    { type: 'text', label: 'Title', name: 'map-title', value: 'Location Map', changeProp: 1 },
    { type: 'number', label: 'Latitude', name: 'map-latitude', value: 49.6116, changeProp: 1 },
    { type: 'number', label: 'Longitude', name: 'map-longitude', value: 6.1319, changeProp: 1 },
    { type: 'number', label: 'Zoom', name: 'map-zoom', value: 12, changeProp: 1 },
  ],
};

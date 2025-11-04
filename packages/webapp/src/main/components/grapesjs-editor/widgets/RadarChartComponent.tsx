import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RadarChartComponentProps {
  color?: string;
  title?: string;
  data?: Array<{ subject: string; A: number; fullMark: number }>;
  showGrid?: boolean;
  showTooltip?: boolean;
  showRadiusAxis?: boolean;
}

const defaultData = [
  { subject: 'Performance', A: 85, fullMark: 100 },
  { subject: 'Quality', A: 75, fullMark: 100 },
  { subject: 'Security', A: 90, fullMark: 100 },
  { subject: 'Usability', A: 80, fullMark: 100 },
  { subject: 'Scalability', A: 70, fullMark: 100 },
  { subject: 'Reliability', A: 88, fullMark: 100 },
];

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({
  color = '#8884d8',
  title = 'Radar Chart Title',
  data = defaultData,
  showGrid = true,
  showTooltip = true,
  showRadiusAxis = true,
}) => {
  return (
    <div
      className="radar-chart-container"
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
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          {showGrid && <PolarGrid stroke="#e0e0e0" />}
          <PolarAngleAxis dataKey="subject" stroke="#666" />
          {showRadiusAxis && <PolarRadiusAxis stroke="#666" />}
          <Radar
            name="Score"
            dataKey="A"
            stroke={color}
            fill={color}
            fillOpacity={0.6}
          />
          {showTooltip && <Tooltip />}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          <span style={{ color: color, fontWeight: 'bold' }}>▲</span> Performance across different metrics
        </p>
      </div>
    </div>
  );
};

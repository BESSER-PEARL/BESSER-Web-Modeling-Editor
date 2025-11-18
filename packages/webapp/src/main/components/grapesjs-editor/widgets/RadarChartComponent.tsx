import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SeriesItem {
  name: string;
  color?: string;
  data: Array<{ subject?: string; name?: string; value: number; fullMark?: number }>;
}

interface RadarChartComponentProps {
  series?: SeriesItem[];
  title?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showRadiusAxis?: boolean;
}

const defaultSeries: SeriesItem[] = [
  { name: 'Series 1', color: '#8884d8', data: [
    { subject: 'Category A', value: 85, fullMark: 100 },
    { subject: 'Category B', value: 75, fullMark: 100 },
    { subject: 'Category C', value: 90, fullMark: 100 },
    { subject: 'Category D', value: 80, fullMark: 100 },
    { subject: 'Category E', value: 70, fullMark: 100 },
    { subject: 'Category F', value: 88, fullMark: 100 },
  ]},
];

// Merge all subjects/names for the axis
function mergeRadarData(series: SeriesItem[]) {
  // Accept both 'subject' and 'name' as the axis key
  const allSubjects = Array.from(new Set(series.flatMap(s => s.data.map(d => d.subject ?? d.name))));
  return allSubjects.map(subject => {
    const entry: any = { subject };
    series.forEach(s => {
      const found = s.data.find(d => (d.subject ?? d.name) === subject);
      entry[s.name] = found ? found.value : 0;
      if (found && found.fullMark !== undefined) entry.fullMark = found.fullMark;
    });
    return entry;
  });
}

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({
  series = defaultSeries,
  title = 'Radar Chart Title',
  showGrid = true,
  showTooltip = true,
  showRadiusAxis = true,
}) => {
  const mergedData = mergeRadarData(series);
  const isEmpty = !series || series.length === 0 || mergedData.length === 0;
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
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '120px 0', color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={mergedData}>
            {showGrid && <PolarGrid stroke="#e0e0e0" />}
            <PolarAngleAxis dataKey="subject" stroke="#666" />
            {showRadiusAxis && <PolarRadiusAxis stroke="#666" />}
            {series.map((s, idx) => (
              <Radar
                key={s.name || idx}
                name={s.name}
                dataKey={s.name}
                stroke={s.color || '#8884d8'}
                fill={s.color || '#8884d8'}
                fillOpacity={0.6}
              />
            ))}
            {showTooltip && <Tooltip />}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      )}
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          {series.map((s, idx) => (
            <span key={s.name || idx} style={{ color: s.color || '#8884d8', fontWeight: 'bold', marginRight: 10 }}>
              {s.name}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
};

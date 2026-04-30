import React, { useEffect, useMemo, useState } from 'react';

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
  const [Recharts, setRecharts] = useState<typeof import('recharts') | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('recharts').then((mod) => {
      if (!cancelled) setRecharts(mod);
    });
    return () => { cancelled = true; };
  }, []);

  // Memoize expensive radar data merge to avoid recomputation on every render
  const mergedData = useMemo(() => mergeRadarData(series), [series]);
  const isEmpty = !series || series.length === 0 || mergedData.length === 0;

  if (!Recharts) {
    return (
      <div style={{ width: '100%', height: 400, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' }}>
        Loading chart...
      </div>
    );
  }

  const { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } = Recharts;

  return (
    <div style={{ width: '100%', height: 400, marginBottom: 20 }}>
      {title && <h3 style={{ textAlign: 'center', marginBottom: 10 }}>{title}</h3>}
      {isEmpty ? (
        <div style={{ textAlign: 'center', paddingTop: 160, color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
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
                fillOpacity={0.5}
              />
            ))}
            {showTooltip && <Tooltip />}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

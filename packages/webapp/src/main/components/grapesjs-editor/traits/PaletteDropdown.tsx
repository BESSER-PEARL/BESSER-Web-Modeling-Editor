import React, { useState, useRef, useEffect } from 'react';

interface PaletteDropdownProps {
  palettes: string[][];
  value: number;
  onChange: (paletteIndex: number) => void;
}

export const PaletteDropdown: React.FC<PaletteDropdownProps> = ({ palettes, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', width: 180 }}>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '6px 10px',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          minHeight: 32,
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          {palettes[value].map((color, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                background: color,
                borderRadius: 3,
                border: '1px solid #eee',
              }}
            />
          ))}
        </div>
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 14 }}>▼</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            width: '100%',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 1000,
            padding: 4,
          }}
        >
          {palettes.map((palette, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '4px 6px',
                cursor: 'pointer',
                background: idx === value ? '#f0f0f0' : 'transparent',
                borderRadius: 3,
                marginBottom: 2,
              }}
              onClick={() => {
                onChange(idx);
                setOpen(false);
              }}
            >
              {palette.map((color, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: 18,
                    height: 18,
                    background: color,
                    borderRadius: 3,
                    border: '1px solid #eee',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

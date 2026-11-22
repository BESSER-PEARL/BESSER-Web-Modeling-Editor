import { describe, expect, it, vi } from 'vitest';
import { parseSeries, setSeriesEndpoint, SeriesItem } from '../traits/registerSeriesManagerTrait';
import { isValidEndpoint, normalizeEndpoint } from '../configs/endpoint';

// react-toastify is pulled in transitively via diagram-helpers; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

describe('parseSeries', () => {
  it('keeps a series endpoint and converts the old camelCase keys', () => {
    const raw = JSON.stringify([
      { name: 'Stats', 'data-source': 'cls-Sale', 'data-endpoint': '/stats/sales', data: [] },
      { name: 'Old', dataSource: 'cls-Sale', labelField: 'a', dataField: 'b', data: [] },
    ]);
    const series = parseSeries(raw);
    expect(series[0]['data-endpoint']).toBe('/stats/sales');
    expect(series[1]).toMatchObject({ 'data-source': 'cls-Sale', 'label-field': 'a', 'data-field': 'b' });
    expect(series[1]).not.toHaveProperty('dataSource');
  });

  it('yields an empty list for anything but a JSON array', () => {
    expect(parseSeries(undefined)).toEqual([]);
    expect(parseSeries('[{"name":')).toEqual([]);
    expect(parseSeries('{"name":"x"}')).toEqual([]);
  });
});

describe('setSeriesEndpoint', () => {
  const series = (): SeriesItem => ({ name: 'S', data: [] });

  it('stores a valid endpoint, a path getting its leading slash', () => {
    const item = series();
    expect(setSeriesEndpoint(item, ' stats/sales?year=2025 ')).toBe(true);
    expect(item['data-endpoint']).toBe('/stats/sales?year=2025');
    expect(setSeriesEndpoint(item, 'https://stats.example.org/v1')).toBe(true);
    expect(item['data-endpoint']).toBe('https://stats.example.org/v1');
  });

  it('clears the endpoint when the field is emptied', () => {
    const item = { ...series(), 'data-endpoint': '/stats/sales' };
    expect(setSeriesEndpoint(item, '   ')).toBe(true);
    expect(item).not.toHaveProperty('data-endpoint');
  });

  it('keeps the last valid endpoint when the typed one is invalid', () => {
    const item = { ...series(), 'data-endpoint': '/stats/sales' };
    expect(setSeriesEndpoint(item, '/stats/sales 2025')).toBe(false);
    expect(setSeriesEndpoint(item, '//evil.example.org/x')).toBe(false);
    expect(item['data-endpoint']).toBe('/stats/sales');
  });
});

describe('isValidEndpoint', () => {
  it('accepts what BESSER accepts, and no endpoint at all', () => {
    for (const value of ['', '/', '/stats/sales?by=region', 'stats/sales', 'HTTPS://h.example/x']) {
      expect(isValidEndpoint(value), value).toBe(true);
    }
  });

  it('refuses spaces, another host, a missing host and invisible characters', () => {
    for (const value of ['/a b', '//h.example/x', 'http://', 'https:///x', '/a\u200bb', '/a\u0007b']) {
      expect(isValidEndpoint(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('normalises like the backend import', () => {
    expect(normalizeEndpoint('  stats/x ')).toBe('/stats/x');
    expect(normalizeEndpoint('https://h/x')).toBe('https://h/x');
    expect(normalizeEndpoint(undefined)).toBe('');
  });
});

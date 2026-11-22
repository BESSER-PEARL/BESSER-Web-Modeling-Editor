import { describe, expect, it, vi } from 'vitest';
import { getChartConfigs } from '../configs/chartConfigs';
import { getMetricCardConfig } from '../configs/metricCardConfigs';

// react-toastify is pulled in transitively via localStorageQuota; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

// The values BESSER's GUI processor (DataAggregation.parse) and the generated
// app's aggregate() both accept; '' leaves the widget unaggregated.
const BACKEND_AGGREGATIONS = ['', 'sum', 'avg', 'count', 'min', 'max', 'median', 'first', 'last'];

const aggregationTrait = (traits: { name: string }[]) => traits.find((t) => t.name === 'aggregation') as any;

describe('aggregation traits', () => {
  it('lets a line chart aggregate its series, with none by default', () => {
    const line = getChartConfigs().find((c) => c.id === 'line-chart')!;
    const trait = aggregationTrait(line.traits);
    expect(trait).toBeDefined();
    expect(trait.value).toBe('');
    expect(trait.options.map((o: { value: string }) => o.value)).toEqual(BACKEND_AGGREGATIONS);
  });

  it('lets a metric card aggregate, defaulting to none so a card without a field counts records', () => {
    const trait = aggregationTrait(getMetricCardConfig().traits);
    expect(trait).toBeDefined();
    expect(trait.value).toBe('');
    expect(trait.options.map((o: { value: string }) => o.value)).toEqual(BACKEND_AGGREGATIONS);
  });
});

const endpointTrait = (traits: { name: string }[]) => traits.find((t) => t.name === 'data-endpoint') as any;

describe('endpoint traits', () => {
  it('lets a metric card read from an endpoint, none by default, with a hint', () => {
    const trait = endpointTrait(getMetricCardConfig().traits);
    expect(trait).toMatchObject({ type: 'text', value: '' });
    expect(trait.placeholder).toBeTruthy();
  });

  it('lets a chart with its own data source read from an endpoint', () => {
    const configs = getChartConfigs();
    for (const id of ['line-chart', 'bar-chart', 'radar-chart']) {
      const config = configs.find((c) => c.id === id)!;
      expect(endpointTrait(config.traits), id).toMatchObject({ type: 'text', value: '' });
      expect(config.traits.findIndex((t) => t.name === 'data-endpoint'))
        .toBeGreaterThan(config.traits.findIndex((t) => t.name === 'data-source'));
    }
  });

  it('gives no endpoint to a chart without a chart-level data source (its series have one)', () => {
    const configs = getChartConfigs();
    for (const id of ['pie-chart', 'radial-bar-chart']) {
      expect(endpointTrait(configs.find((c) => c.id === id)!.traits), id).toBeUndefined();
    }
  });
});

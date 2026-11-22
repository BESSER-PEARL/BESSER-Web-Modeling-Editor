import { describe, expect, it, vi } from 'vitest';
import { parseLayers, LayerItem } from '../traits/registerLayerManagerTrait';

// react-toastify is pulled in transitively via diagram-helpers; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

describe('parseLayers', () => {
  it('round-trips the layer list the trait serialises into `map-layers`', () => {
    const layers: LayerItem[] = [
      {
        name: 'Stores',
        type: 'points',
        dataSource: 'Store',
        latitudeField: 'lat',
        longitudeField: 'lng',
        labelField: 'name',
      },
      {
        name: 'Regions',
        type: 'choropleth',
        dataSource: 'Region',
        geojsonField: 'boundary',
        valueField: 'population',
      },
      { name: 'Density', type: 'heatmap', dataSource: 'Reading', weightField: 'value' },
    ];

    expect(parseLayers(JSON.stringify(layers))).toEqual(layers);
  });

  it('keeps an empty list empty', () => {
    expect(parseLayers('[]')).toEqual([]);
  });

  it('yields an empty list for a malformed JSON string', () => {
    expect(parseLayers('[{"name":"Stores",')).toEqual([]);
    expect(parseLayers('not json at all')).toEqual([]);
  });

  it('yields an empty list for a JSON payload that is not an array', () => {
    expect(parseLayers('{"name":"Stores"}')).toEqual([]);
  });

  it('yields an empty list when the attribute is unset or not a string', () => {
    expect(parseLayers(undefined)).toEqual([]);
    expect(parseLayers('')).toEqual([]);
    expect(parseLayers([{ name: 'Stores', type: 'points' }])).toEqual([]);
  });
});

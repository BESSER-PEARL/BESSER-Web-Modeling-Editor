import { ModelState } from '../components/store/model-state';

/**
 * Memoizes a derived slice of the element map for a connected component.
 * The slice is recomputed only when `state.elements` or the key derived from
 * the own props changes, so unrelated store updates (hover, selection) neither
 * re-run the derivation nor hand the component fresh arrays that defeat
 * react-redux's shallow prop comparison. Create one per component instance
 * (inside a mapStateToProps factory).
 */
export function memoizeOnElements<OwnProps, Slice>(
  compute: (elements: ModelState['elements'], ownProps: OwnProps) => Slice,
  key: (ownProps: OwnProps) => string,
): (elements: ModelState['elements'], ownProps: OwnProps) => Slice {
  let cache: { elements: ModelState['elements']; key: string; slice: Slice } | null = null;
  return (elements, ownProps) => {
    const currentKey = key(ownProps);
    if (cache && cache.elements === elements && cache.key === currentKey) return cache.slice;
    cache = { elements, key: currentKey, slice: compute(elements, ownProps) };
    return cache.slice;
  };
}

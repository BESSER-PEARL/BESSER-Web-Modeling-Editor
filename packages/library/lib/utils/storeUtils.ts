export const deepEqual = <T>(a: T, b: T): boolean => {
  // Node/edge lists: React Flow keeps unchanged items by reference, so only
  // the changed ones are serialized (a drag step no longer stringifies the
  // whole diagram twice). Same result as comparing the full JSON.
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a === b) return true
    if (a.length !== b.length) return false
    return a.every(
      (item, i) =>
        item === b[i] || JSON.stringify(item) === JSON.stringify(b[i])
    )
  }
  return JSON.stringify(a) === JSON.stringify(b)
}

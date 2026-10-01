// Vite CJS/ESM interop shim for plotly.js-dist-min.
// BAF-UI does: import("plotly.js-dist-min").then(e => e.newPlot(...))
// Vite wraps the CJS module as { default: Plotly }, so e.newPlot is undefined.
// Use the subpath import to bypass the alias (alias only matches the bare specifier).
import Plotly from 'plotly.js-dist-min/plotly.min.js';
export default Plotly;
export const newPlot = (...args) => Plotly.newPlot(...args);
export const purge = (...args) => Plotly.purge(...args);

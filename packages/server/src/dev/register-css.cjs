// Dev-mode (tsx) stand-in for webpack's style-loader: the library imports
// .css files, which Node cannot parse. Inject them into the jsdom document
// instead, so the SVG export's palette snapshot sees the same CSS variables
// as the production bundle. `document` is set by `global-jsdom/register`,
// which svg-export-resource.ts imports before the library.
const fs = require('fs');

require.extensions['.css'] = (module, filename) => {
  const style = document.createElement('style');
  style.textContent = fs.readFileSync(filename, 'utf8');
  document.head.appendChild(style);
};

declare module '*.svg' {
  const content: any;
  export default content;
}

// cytoscape-fcose ships no type declarations; it is a plain Cytoscape extension.
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape';
  const fcose: Ext;
  export default fcose;
}

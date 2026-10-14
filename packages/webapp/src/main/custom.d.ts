declare module '*.svg' {
  const content: any;
  export default content;
}

// cytoscape-fcose ships no type declarations.
declare module 'cytoscape-fcose';

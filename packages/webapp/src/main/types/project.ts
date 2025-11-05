import { UMLDiagramType, UMLModel } from '@besser/wme';

// Supported diagram types in projects
export type SupportedDiagramType = 'ClassDiagram' | 'ObjectDiagram' | 'StateMachineDiagram' | 'AgentDiagram' | 'GUINoCodeDiagram';

// GrapesJS project data structure
export interface GrapesJSProjectData {
  pages: any[];
  styles: any[];
  assets: any[];
  symbols: any[];
  version: string;
}

// Diagram structure within a project
export interface ProjectDiagram {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData;
  lastUpdate: string;
  description?: string;
}

export type ProjectDiagramModel = UMLModel | GrapesJSProjectData;

// New centralized project structure
export interface BesserProject {
  id: string;
  type: 'Project';
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  currentDiagramType: SupportedDiagramType; // Which diagram is currently active
  diagrams: {
    ClassDiagram: ProjectDiagram;
    ObjectDiagram: ProjectDiagram;
    StateMachineDiagram: ProjectDiagram;
    AgentDiagram: ProjectDiagram;
    GUINoCodeDiagram: ProjectDiagram;
  };
  settings: {
    defaultDiagramType: SupportedDiagramType;
    autoSave: boolean;
    collaborationEnabled: boolean;
  };
}

// Helper to convert UMLDiagramType to SupportedDiagramType
export const toSupportedDiagramType = (type: UMLDiagramType): SupportedDiagramType => {
  switch (type) {
    case UMLDiagramType.ClassDiagram:
      return 'ClassDiagram';
    case UMLDiagramType.ObjectDiagram:
      return 'ObjectDiagram';
    case UMLDiagramType.StateMachineDiagram:
      return 'StateMachineDiagram';
    case UMLDiagramType.AgentDiagram:
      return 'AgentDiagram';
    default:
      return 'ClassDiagram'; // fallback
  }
};

// Helper to convert SupportedDiagramType to UMLDiagramType
export const toUMLDiagramType = (type: SupportedDiagramType): UMLDiagramType | null => {
  switch (type) {
    case 'ClassDiagram':
      return UMLDiagramType.ClassDiagram;
    case 'ObjectDiagram':
      return UMLDiagramType.ObjectDiagram;
    case 'StateMachineDiagram':
      return UMLDiagramType.StateMachineDiagram;
    case 'AgentDiagram':
      return UMLDiagramType.AgentDiagram;
    case 'GUINoCodeDiagram':
      return null; // GUINoCodeDiagram doesn't have a UML diagram type
    default:
      return null;
  }
};

// Default diagram factory
export const createEmptyDiagram = (title: string, type: UMLDiagramType | null): ProjectDiagram => {
  // For GUI/No-Code diagram
  if (type === null) {
    // ========================================
    // 🎨 DEFAULT PAGE CONTENT
    // ========================================
    // This HTML will be the default content when a new project is created
    const defaultPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BESSER Generated Page</title>
  <style>
* { box-sizing: border-box; } body {margin: 0;}.gjs-row{display:table;padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;width:100%;}.gjs-cell{width:8%;display:table-cell;height:75px;}#i5jh{background:linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important;color:white;padding:15px 30px;display:flex;justify-content:space-between;align-items:center;font-family:Arial, sans-serif;}#io07{font-size:24px;font-weight:bold;}#inp2m{display:flex;gap:30px;}#ibtww{color:white;text-decoration:none;}#ild7j{color:white;text-decoration:none;}#ibczy{color:white;text-decoration:none;}#iyzy5{color:white;text-decoration:none;}#ictst{background:linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important;color:white;padding:40px 20px;margin-top:60px;font-family:Arial, sans-serif;}#i8uhg{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:30px;}#i3p8x{margin-top:0;}#i9x6g{opacity:0.8;line-height:1.6;}#iybmm{margin-top:0;}#im0xi{list-style:none;padding:0;opacity:0.8;}#ichrl{margin:8px 0;}#i0wq2{color:white;text-decoration:none;}#ixtnt{margin:8px 0;}#i2f1j{color:white;text-decoration:none;}#irxsn{margin:8px 0;}#inu9a{color:white;text-decoration:none;}#igd5a{margin-top:0;}#itmu2{opacity:0.8;}#iph4d{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);opacity:0.7;}#i8fz6{width:100%;min-height:400px;}#id9ne{width:100%;min-height:400px;}#iy0gc{width:100%;min-height:400px;}#ig59l{width:100%;min-height:400px;}#i72zk{width:100%;min-height:400px;}#i4f21{width:100%;min-height:400px;}@media (max-width: 768px){.gjs-cell{width:100%;display:block;}}
  </style>
</head>
<body>
<body id="i9vb"><nav id="i5jh"><div id="io07">BESSER</div><div id="inp2m"><a href="/" id="ibtww">Home</a><a href="/about" id="ild7j">About</a></div></nav><div class="gjs-row" id="iiqx6"><div class="gjs-cell" id="ifczf"><div chart-color="#4CAF50" chart-title="Line Chart Title" data-source="" label-field="" data-field="" line-width="2" show-grid show-legend show-tooltip curve-type="monotone" animate class="line-chart-component" id="i72zk"></div></div><div class="gjs-cell" id="iz1hy"><div chart-title="Pie Chart Title" data-source="" label-field="" data-field="" show-legend legend-position="bottom" show-labels label-position="inside" padding-angle="0" class="pie-chart-component" id="i8fz6"></div></div><div class="gjs-cell"><div chart-color="#8884d8" chart-title="Radar Chart Title" data-source="" label-field="" data-field="" show-grid show-tooltip show-radius-axis class="radar-chart-component" id="id9ne"></div></div></div><div class="gjs-row" id="is6fi"><div class="gjs-cell" id="i2lt6"><div chart-color="#3498db" chart-title="Bar Chart Title" data-source="" label-field="" data-field="" bar-width="30" orientation="vertical" show-grid show-legend class="bar-chart-component" id="iy0gc"></div></div><div class="gjs-cell" id="igud3"><div chart-title="Radial Bar Chart Title" data-source="" label-field="" data-field="" start-angle="90" end-angle="450" class="radial-bar-chart-component" id="ig59l"></div></div><div class="gjs-cell"><div chart-color="#4CAF50" chart-title="Line Chart Title" data-source="" label-field="" data-field="" line-width="2" show-grid show-legend show-tooltip curve-type="monotone" animate class="line-chart-component" id="i4f21"></div></div></div><footer id="ictst"><div id="i8uhg"><div><h4 id="i3p8x">About BESSER</h4><p id="i9x6g">BESSER is a low-code platform for building smarter software faster. Empower your development with our dashboard generator and modeling tools.</p></div><div><h4 id="iybmm">Quick Links</h4><ul id="im0xi"><li id="ichrl"><a href="#" id="i0wq2">Dashboard Generator</a></li><li id="ixtnt"><a href="#" id="i2f1j">API Reference</a></li><li id="irxsn"><a href="#" id="inu9a">Support</a></li></ul></div><div><h4 id="igd5a">Contact</h4><p id="itmu2">Email: info@besser-pearl.org<br/>Phone: (123) 456-7890</p></div></div><div id="iph4d">
          © 2025 BESSER. All rights reserved.
        </div></footer></body>
  <script>
    console.log('Page loaded successfully');
  </script>
</body>
</html>`;

    const defaultAboutHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
* { box-sizing: border-box; } body {margin: 0;}*{box-sizing:border-box;}body{margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;}.gjs-row{display:table;padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;width:100%;}#i5jh-2{background-color:rgba(0, 0, 0, 0) !important;background-position-x:0% !important;background-position-y:0% !important;background-repeat:repeat !important;background-attachment:scroll !important;background-image:linear-gradient(135deg, rgb(75, 60, 130) 0%, rgb(90, 61, 145) 100%) !important;background-size:auto !important;background-origin:padding-box !important;background-clip:border-box !important;color:white;padding-top:15px;padding-right:30px;padding-bottom:15px;padding-left:30px;display:flex;justify-content:space-between;align-items:center;font-family:Arial, sans-serif;}#io07-2{font-size:24px;font-weight:bold;}#inp2m-2{display:flex;row-gap:30px;column-gap:30px;}#ibtww-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#ild7j-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#ibczy-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#iyzy5-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#ictst-2{background-color:rgba(0, 0, 0, 0) !important;background-position-x:0% !important;background-position-y:0% !important;background-repeat:repeat !important;background-attachment:scroll !important;background-image:linear-gradient(135deg, rgb(75, 60, 130) 0%, rgb(90, 61, 145) 100%) !important;background-size:auto !important;background-origin:padding-box !important;background-clip:border-box !important;color:white;padding-top:40px;padding-right:20px;padding-bottom:40px;padding-left:20px;margin-top:60px;font-family:Arial, sans-serif;}#i8uhg-2{max-width:1200px;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:auto;display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));row-gap:30px;column-gap:30px;}#i3p8x-2{margin-top:0px;}#i9x6g-2{opacity:0.8;line-height:1.6;}#iybmm-2{margin-top:0px;}#im0xi-2{list-style-position:outside;list-style-image:none;list-style-type:none;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;opacity:0.8;}#ichrl-2{margin-top:8px;margin-right:0px;margin-bottom:8px;margin-left:0px;}#i0wq2-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#ixtnt-2{margin-top:8px;margin-right:0px;margin-bottom:8px;margin-left:0px;}#i2f1j-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#irxsn-2{margin-top:8px;margin-right:0px;margin-bottom:8px;margin-left:0px;}#inu9a-2{color:white;text-decoration-color:currentcolor;text-decoration-line:none;text-decoration-style:solid;text-decoration-thickness:auto;}#igd5a-2{margin-top:0px;}#itmu2-2{opacity:0.8;}#iph4d-2{text-align:center;margin-top:30px;padding-top:20px;border-top-width:1px;border-top-style:solid;border-top-color:rgba(255, 255, 255, 0.1);opacity:0.7;}#ihhucw{background:linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important;padding:80px 20px;text-align:center;color:white;font-family:Arial, sans-serif;}#izn0d4{max-width:800px;margin:0 auto;}#iarech{font-size:42px;margin-bottom:20px;font-weight:bold;}#iznkht{font-size:20px;margin-bottom:40px;opacity:0.95;}#i45e9h{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;}#i6qufd{background:white;color:#4b3c82;border:none;padding:18px 40px;font-size:18px;border-radius:50px;cursor:pointer;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:transform 0.2s;}#ih7y3i{background:transparent;color:white;border:2px solid white;padding:18px 40px;font-size:18px;border-radius:50px;cursor:pointer;font-weight:bold;transition:all 0.2s;}#i94ykd{padding:60px 20px;}#imjpfb{max-width:1200px;margin:0 auto;}#ixhdf8{text-align:center;font-size:36px;margin-bottom:50px;color:#333;}#ifzwsk{display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:40px;}#ilfh9s{text-align:center;padding:30px;}#iwznrk{width:80px;height:80px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;color:white;}#it8x1g{color:#333;margin:20px 0 15px;}#iccbeg{color:#666;line-height:1.6;}#ixjufm{text-align:center;padding:30px;}#i7pg38{width:80px;height:80px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;color:white;}#it7eyx{color:#333;margin:20px 0 15px;}#izcgig{color:#666;line-height:1.6;}#ie4pxe{text-align:center;padding:30px;}#ih9198{width:80px;height:80px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;color:white;}#ii2qto{color:#333;margin:20px 0 15px;}#itzqqe{color:#666;line-height:1.6;}
  </style>
</head>
<body>
<body id="i4ltb"><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><nav id="i5jh-2"><div id="io07-2">BESSER</div><div id="inp2m-2"><a href="/" id="ibtww-2">Home</a><a href="/about" id="ild7j-2">About</a></div></nav><section id="ihhucw"><div id="izn0d4"><h2 id="iarech">Build Smarter Dashboards Faster with BESSER</h2><p id="iznkht">Create interactive dashboards effortlessly and streamline your workflow with BESSER's low-code platform.</p><div id="i45e9h"><button id="i6qufd">Try Dashboard Generator</button><button id="ih7y3i">Explore Features</button></div></div></section><section id="i94ykd"><div id="imjpfb"><h2 id="ixhdf8">Our Features</h2><div id="ifzwsk"><!-- Feature 1 --><div id="ilfh9s"><div id="iwznrk">🚀</div><h3 id="it8x1g">Fast Performance</h3><p id="iccbeg">Lightning-fast loading times and smooth interactions for the best user experience.</p></div><!-- Feature 2 --><div id="ixjufm"><div id="i7pg38">🔒</div><h3 id="it7eyx">Secure & Safe</h3><p id="izcgig">Enterprise-grade security to protect your data and ensure privacy.</p></div><!-- Feature 3 --><div id="ie4pxe"><div id="ih9198">📱</div><h3 id="ii2qto">Responsive Design</h3><p id="itzqqe">Works perfectly on all devices - desktop, tablet, and mobile.</p></div></div></div></section><footer id="ictst-2"><div id="i8uhg-2"><div><h4 id="i3p8x-2">About BESSER</h4><p id="i9x6g-2">BESSER is a low-code platform for building smarter software faster. Empower your development with our dashboard generator and modeling tools.</p></div><div><h4 id="iybmm-2">Quick Links</h4><ul id="im0xi-2"><li id="ichrl-2"><a href="#" id="i0wq2-2">Dashboard Generator</a></li><li id="ixtnt-2"><a href="#" id="i2f1j-2">API Reference</a></li><li id="irxsn-2"><a href="#" id="inu9a-2">Support</a></li></ul></div><div id="iberth"><h4 id="igd5a-2">Contact</h4><p id="itmu2-2">Email: info@besser-pearl.org<br/>Phone: (123) 456-7890</p></div></div><div id="iph4d-2">
          © 2025 BESSER. All rights reserved.
        </div></footer><div id="iiqx6-2" class="gjs-row"></div><div id="is6fi-2" class="gjs-row"></div></body>
  <script>
    console.log('Page loaded successfully');
  </script>
</body>
</html>`;
    
    return {
      id: crypto.randomUUID(),
      title,
      model: {
        pages: [
          {
            name: 'Home',
            styles: '',
            component: defaultPageHTML, // Now includes default content
          }, {
            name: 'About',
            styles: '',
            component: defaultAboutHTML, // Now includes default content
          },
        ],
        styles: [],
        assets: [],
        symbols: [],
        version: '0.21.13',
      },
      lastUpdate: new Date().toISOString(),
    };
  }
  
  // For UML diagrams
  return {
    id: crypto.randomUUID(),
    title,
    model: {
      version: '3.0.0' as const,
      type,
      size: { width: 1400, height: 740 },
      elements: {},
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    },
    lastUpdate: new Date().toISOString(),
  };
};

// Default project factory
export const createDefaultProject = (
  name: string, 
  description: string, 
  owner: string
): BesserProject => {
  const projectId = crypto.randomUUID();
  
  return {
    id: projectId,
    type: 'Project',
    name,
    description,
    owner,
    createdAt: new Date().toISOString(),
    currentDiagramType: 'ClassDiagram',
    diagrams: {
      ClassDiagram: createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram),
      ObjectDiagram: createEmptyDiagram('Object Diagram', UMLDiagramType.ObjectDiagram),
      StateMachineDiagram: createEmptyDiagram('State Machine Diagram', UMLDiagramType.StateMachineDiagram),
      AgentDiagram: createEmptyDiagram('Agent Diagram', UMLDiagramType.AgentDiagram),
      GUINoCodeDiagram: createEmptyDiagram('GUI Diagram', null),
    },
    settings: {
      defaultDiagramType: 'ClassDiagram',
      autoSave: true,
      collaborationEnabled: false,
    },
  };
};

// Type guards
export const isProject = (obj: any): obj is BesserProject => {
  return obj && 
         typeof obj === 'object' && 
         obj.type === 'Project' && 
         obj.diagrams && 
         typeof obj.diagrams === 'object' &&
         obj.currentDiagramType &&
         obj.diagrams.ClassDiagram &&
         obj.diagrams.ObjectDiagram &&
         obj.diagrams.StateMachineDiagram &&
         obj.diagrams.AgentDiagram &&
         obj.diagrams.GUINoCodeDiagram;
};

export const isUMLModel = (model: unknown): model is UMLModel => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as Partial<UMLModel>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.elements === 'object' &&
    typeof candidate.relationships === 'object'
  );
};

export const isGrapesJSProjectData = (model: unknown): model is GrapesJSProjectData => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as any;
  // More lenient check - only require at least one of the expected properties to exist
  return (
    candidate.pages !== undefined ||
    candidate.styles !== undefined ||
    candidate.assets !== undefined ||
    candidate.symbols !== undefined ||
    candidate.version !== undefined
  );
};

// Normalize any data to valid GrapesJS format
export const normalizeToGrapesJSProjectData = (data: unknown): GrapesJSProjectData => {
  const candidate = (data && typeof data === 'object') ? data as any : {};
  
  return {
    pages: Array.isArray(candidate.pages) ? candidate.pages : [],
    styles: Array.isArray(candidate.styles) ? candidate.styles : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    symbols: Array.isArray(candidate.symbols) ? candidate.symbols : [],
    version: typeof candidate.version === 'string' ? candidate.version : '0.21.13'
  };
};

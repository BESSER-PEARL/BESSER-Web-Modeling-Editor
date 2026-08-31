import type { Editor } from 'grapesjs';

/**
 * Layout palette — every block is authored in the ds-* design language (the
 * same component classes the modeling agent generates with), so anything a
 * user drags in belongs to their page instead of arriving in a foreign skin.
 * The class definitions come from the project's own styles[] (agent-themed)
 * or from the injected baseline (designSystem.ts) on manual projects.
 *
 * Block markup mirrors the agent's proven exemplar shapes
 * (modeling-agent gui_design_system.block_exemplars): full-width bands
 * (ds-hero / ds-nav / ds-footer) span the page; content sits in ds-section >
 * ds-card; grids via ds-grid-2 / ds-grid-3 (responsive at 768px).
 */
export function setupLayoutBlocks(editor: Editor) {
  const bm = editor.BlockManager;
  const domc = editor.DomComponents;
  try {
    const defaultType = domc.getType('default');
    const defaultModel = defaultType?.model;
    const defaultView = defaultType?.view;

    if (defaultModel && defaultView) {
      domc.addType('analytics-dashboard', {
        model: defaultModel.extend(
          {
            defaults: {
              ...defaultModel.prototype.defaults,
              name: 'Analytics Dashboard',
              stylable: ['background', 'background-color', 'padding', 'color'],
              droppable: true,
            },
          },
          {
            isComponent(el: HTMLElement) {
              const type = el?.getAttribute?.('data-gjs-type');
              if (type === 'analytics-dashboard') return true;
              const cls = el?.getAttribute?.('class') || '';
              return cls.split(' ').includes('dashboard-container');
            },
          }
        ),
        view: defaultView,
      });
    }
  } catch (error) {
    console.warn('[LayoutBlocks] Unable to register analytics-dashboard type; using default wrapper.', error);
  }

  // ---- Structure ----------------------------------------------------------

  bm.add('section', {
    label: `Section`,
    category: `Layout`,
    content: `
      <section class="ds-section">
        <div class="ds-container">
          <h2 class="ds-heading">Section title</h2>
          <p>Add your content here.</p>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="6" width="20" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });

  bm.add('card', {
    label: `Card`,
    category: `Layout`,
    content: `
      <div class="ds-card">
        <h3 class="ds-heading">Card title</h3>
        <p>This is a card. Put text, media or widgets inside it.</p>
        <a class="ds-btn ds-btn-primary" href="#">Learn more</a>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>',
  });

  bm.add('grid-2col', {
    label: `2 Columns`,
    category: `Layout`,
    content: `
      <section class="ds-section">
        <div class="ds-grid-2">
          <div class="ds-card">
            <h3 class="ds-heading">Left</h3>
            <p>Column content.</p>
          </div>
          <div class="ds-card">
            <h3 class="ds-heading">Right</h3>
            <p>Column content.</p>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="5" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });

  bm.add('grid-3col', {
    label: `3 Columns`,
    category: `Layout`,
    content: `
      <section class="ds-section">
        <div class="ds-grid-3">
          <div class="ds-card">
            <h3 class="ds-heading">First</h3>
            <p>Column content.</p>
          </div>
          <div class="ds-card">
            <h3 class="ds-heading">Second</h3>
            <p>Column content.</p>
          </div>
          <div class="ds-card">
            <h3 class="ds-heading">Third</h3>
            <p>Column content.</p>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="5" width="5.5" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="9.2" y="5" width="5.5" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="16.5" y="5" width="5.5" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  });

  bm.add('divider', {
    label: `Divider`,
    category: `Layout`,
    content: `<hr style="border: none; border-top: 1px solid var(--ds-border, #e2e8f0); margin: 2rem 0;">`,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/></svg>',
  });

  // ---- Page bands ---------------------------------------------------------

  bm.add('navbar', {
    label: `Navigation Bar`,
    category: `Layout`,
    content: `
      <nav class="ds-nav">
        <strong>Your App</strong>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <a class="ds-btn" href="#">Home</a>
          <a class="ds-btn" href="#">About</a>
          <a class="ds-btn ds-btn-primary" href="#">Sign in</a>
        </div>
      </nav>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="4" rx="1" fill="currentColor"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="1.5"/></svg>',
  });

  bm.add('hero-section', {
    label: `Hero`,
    category: `Layout`,
    content: `
      <section class="ds-hero">
        <div class="ds-container">
          <h1 class="ds-heading">A clear, confident headline</h1>
          <p>One sentence that explains what this page offers.</p>
          <a class="ds-btn ds-btn-primary" href="#">Get started</a>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="9" x2="18" y2="9" stroke="currentColor" stroke-width="2"/><line x1="6" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="15.5" width="5" height="2.5" rx="1.25" fill="currentColor"/></svg>',
  });

  bm.add('cta-banner', {
    label: `Call to Action`,
    category: `Layout`,
    content: `
      <section class="ds-hero" style="text-align: center;">
        <div class="ds-container">
          <h2 class="ds-heading">Ready to get started?</h2>
          <p>Join today — it only takes a minute.</p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <a class="ds-btn ds-btn-primary" href="#">Get started</a>
            <a class="ds-btn" href="#">Learn more</a>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/><path d="M8 12 L11 15 L16 10" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });

  bm.add('footer', {
    label: `Footer`,
    category: `Layout`,
    content: `
      <footer class="ds-footer">
        <div class="ds-container">
          <p>&copy; Your Company. All rights reserved.</p>
        </div>
      </footer>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="16" width="20" height="6" rx="1" fill="currentColor"/><rect x="2" y="2" width="20" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });

  // ---- Data & messaging ---------------------------------------------------

  bm.add('kpi-row', {
    label: `KPI Row`,
    category: `Layout`,
    content: `
      <section class="ds-section">
        <div class="ds-grid-3">
          <div class="ds-kpi">
            <span class="ds-kpi-value">1,204</span>
            <span class="ds-kpi-label">Total items</span>
          </div>
          <div class="ds-kpi">
            <span class="ds-kpi-value">312</span>
            <span class="ds-kpi-label">Active</span>
          </div>
          <div class="ds-kpi">
            <span class="ds-kpi-value">18</span>
            <span class="ds-kpi-label">Pending</span>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M2 20 L7 12 L12 16 L22 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="16" r="2" fill="currentColor"/><circle cx="22" cy="4" r="2" fill="currentColor"/></svg>',
  });

  bm.add('notice', {
    label: `Notice`,
    category: `Layout`,
    content: `
      <div class="ds-notice">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Something worth telling your users about.</span>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="8" width="20" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="5" y1="8" x2="5" y2="16" stroke="currentColor" stroke-width="2.5"/></svg>',
  });

  bm.add('feature-grid', {
    label: `Feature Grid`,
    category: `Layout`,
    content: `
      <section class="ds-section">
        <div class="ds-container">
          <h2 class="ds-heading" style="text-align: center;">What you get</h2>
          <div class="ds-grid-3">
            <div class="ds-card">
              <span class="ds-badge">Fast</span>
              <h3 class="ds-heading">Quick to start</h3>
              <p>Everything works out of the box, no setup needed.</p>
            </div>
            <div class="ds-card">
              <span class="ds-badge">Secure</span>
              <h3 class="ds-heading">Safe by default</h3>
              <p>Your data stays protected with sensible defaults.</p>
            </div>
            <div class="ds-card">
              <span class="ds-badge">Flexible</span>
              <h3 class="ds-heading">Fits your flow</h3>
              <p>Adapt every screen to the way your team works.</p>
            </div>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });

  // ---- Templates ----------------------------------------------------------

  bm.add('analytics-dashboard', {
    label: `Analytics Dashboard`,
    category: `Templates`,
    content: `
      <div data-gjs-type="analytics-dashboard" data-gjs-highlightable="true" class="ds-page" style="padding: 1.5rem;">
        <div class="ds-container">
          <h1 class="ds-heading">Analytics Dashboard</h1>
          <p>Real-time insights and metrics</p>
          <div class="ds-grid-3" style="margin-bottom: 1.5rem;">
            <div data-gjs-type="metric-card"></div>
            <div data-gjs-type="metric-card"></div>
            <div data-gjs-type="metric-card"></div>
          </div>
          <div class="ds-grid-2">
            <div class="ds-card">
              <h3 class="ds-heading">Trend</h3>
              <div style="min-height: 300px; display: flex; align-items: center; justify-content: center; color: var(--ds-muted, #64748b);">Drop a Line Chart here</div>
            </div>
            <div class="ds-card">
              <h3 class="ds-heading">Distribution</h3>
              <div style="min-height: 300px; display: flex; align-items: center; justify-content: center; color: var(--ds-muted, #64748b);">Drop a Pie Chart here</div>
            </div>
          </div>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="3" width="20" height="5" rx="1" fill="currentColor" opacity="0.3"/><rect x="2" y="10" width="9" height="11" rx="1" fill="currentColor"/><rect x="13" y="10" width="9" height="11" rx="1" fill="currentColor"/></svg>',
  });

  bm.add('kpi-dashboard', {
    label: `KPI Dashboard`,
    category: `Templates`,
    content: `
      <div class="ds-page" style="padding: 2.5rem 1rem;">
        <div class="ds-container">
          <h1 class="ds-heading" style="text-align: center;">Key Performance Indicators</h1>
          <p style="text-align: center;">Track your most important metrics at a glance</p>
          <div class="ds-grid-3">
            <div data-gjs-type="metric-card" data-gjs-metric-title="Total Revenue" data-gjs-format="currency"></div>
            <div data-gjs-type="metric-card" data-gjs-metric-title="Active Users" data-gjs-format="number"></div>
            <div data-gjs-type="metric-card" data-gjs-metric-title="System Uptime" data-gjs-format="percentage"></div>
          </div>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="4" width="6" height="6" rx="1" fill="currentColor"/><rect x="3" y="13" width="6" height="6" rx="1" fill="currentColor"/><rect x="12" y="4" width="9" height="15" rx="1" fill="currentColor" opacity="0.5"/></svg>',
  });
}

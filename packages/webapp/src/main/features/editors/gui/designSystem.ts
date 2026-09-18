/**
 * BESSER design-system baseline — the ds-* component stylesheet, DEFAULT theme.
 *
 * GENERATED from the modeling agent's design system
 * (modeling-agent/src/diagram_handlers/types/gui_design_system.py,
 * stylesheet_rules('default')) so palette blocks, agent-generated pages and
 * manually built pages all share ONE design language. If the agent's tokens
 * change, regenerate this CSS from that module rather than editing it here.
 *
 * Agent-generated GUI models already carry their own (possibly domain-themed)
 * ds-* rules in styles[]; ensureDesignSystemStyles only injects this baseline
 * when a project has no ds-* rules yet (blank/manual projects), so it never
 * fights an agent theme.
 */
import type { Editor } from 'grapesjs';

export const DS_BASELINE_CSS = `
* { box-sizing: border-box; }
:root { --ds-primary: #2563eb; --ds-secondary: #475569; --ds-accent: #0ea5e9; --ds-surface: #ffffff; --ds-background: #f8fafc; --ds-text: #0f172a; --ds-muted: #64748b; --ds-border: #e2e8f0; --ds-radius: 8px; --ds-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); --ds-space-md: 1rem; --ds-space-lg: 1.5rem; --ds-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; --ds-font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.ds-page { margin: 0; background-color: #f8fafc; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 1rem; font-weight: 400; line-height: 1.6; min-height: 100vh; }
.ds-container { max-width: 1200px; margin: 0 auto; padding-left: 1rem; padding-right: 1rem; width: 100%; }
.ds-section { padding-top: 4rem; padding-bottom: 4rem; padding-left: 1rem; padding-right: 1rem; }
.ds-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 0.5rem; padding-bottom: 0.5rem; padding-left: 1rem; padding-right: 1rem; background-color: #ffffff; border-bottom: 1px solid #e2e8f0; }
.ds-hero { background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%); color: #ffffff; padding-top: 4rem; padding-bottom: 4rem; padding-left: 1rem; padding-right: 1rem; text-align: left; }
.ds-hero .ds-heading { color: #ffffff; }
.ds-heading { margin: 0 0 0.5rem 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 1.875rem; font-weight: 650; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; }
.ds-hero h1.ds-heading, .ds-hero .ds-heading { font-size: 2.75rem; font-weight: 750; letter-spacing: -0.03em; line-height: 1.08; max-width: 22ch; }
.ds-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06); transition: box-shadow .2s ease, transform .2s ease; }
.ds-card:hover { box-shadow: 0 2px 4px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.1); transform: translateY(-1px); }
.ds-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
.ds-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; }
@media (max-width: 768px) { .ds-grid-2 { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .ds-grid-3 { grid-template-columns: 1fr; } }
.ds-kpi { display: flex; flex-direction: column; gap: 0.25rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06); transition: box-shadow .2s ease, transform .2s ease; }
.ds-kpi:hover { box-shadow: 0 2px 4px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.1); transform: translateY(-1px); }
.ds-kpi-value { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 2.75rem; font-weight: 700; line-height: 1.05; letter-spacing: -0.02em; color: #2563eb; }
.ds-kpi-label { font-size: 0.875rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; }
.ds-table-wrap { overflow-x: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; }
.ds-table { width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 1rem; color: #0f172a; }
.ds-table th { text-align: left; padding: 0.75rem 1rem; background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.02em; text-transform: uppercase; color: #64748b; }
.ds-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
.ds-table tbody tr:last-child td { border-bottom: none; }
.ds-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.625rem 1.25rem; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 1rem; font-weight: 600; text-decoration: none; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, filter .15s ease, transform .15s ease; }
.ds-btn:hover { border-color: #64748b; background-color: #f8fafc; }
.ds-btn-primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
.ds-btn-primary:hover { filter: brightness(1.08); background-color: transparent; transform: translateY(-1px); }
.ds-notice { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background-color: rgba(14, 165, 233, 0.12); border-left: 4px solid #0ea5e9; border-radius: 8px; color: #0f172a; font-size: 1rem; }
.ds-badge { display: inline-block; padding: 0.125rem 0.5rem; background-color: rgba(14, 165, 233, 0.12); border-radius: 999px; color: #0ea5e9; font-size: 0.875rem; font-weight: 600; }
.ds-field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
.ds-label { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
.ds-input { width: 100%; padding: 0.5rem 0.75rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 1rem; }
.ds-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
.ds-footer { background-color: #475569; color: #ffffff; padding: 2.5rem 1rem; font-size: 0.875rem; }
`;

/** True when the project already defines ds-* component rules. */
export function hasDesignSystemStyles(editor: Editor): boolean {
  try {
    return (editor.getCss() || '').includes('.ds-card');
  } catch {
    return false;
  }
}

/**
 * Inject the baseline ds-* stylesheet into projects that lack one, so palette
 * blocks render designed instead of unstyled. Rules land in the CssComposer
 * and persist through the normal storage path like any user-authored style.
 */
export function ensureDesignSystemStyles(editor: Editor): void {
  try {
    if (hasDesignSystemStyles(editor)) return;
    editor.Css.addRules(DS_BASELINE_CSS);
    console.log('[DesignSystem] Baseline ds-* stylesheet injected');
  } catch (error) {
    console.warn('[DesignSystem] Could not inject baseline stylesheet:', error);
  }
}

import type { Component, Page } from 'grapesjs';

/**
 * Reads the links between the pages of a GUI (no-code) diagram, the way the
 * BESSER GUI processor turns them into navigation:
 *   - a button whose action is `navigate` targets a page by id
 *     (`target-screen`, optionally `page:`-prefixed), or else by page name;
 *   - an `<a href="/route">` targets the page whose route matches. The
 *     generated app routes a page at `/` + its lowercased name (spaces as
 *     hyphens), ignoring any custom route set in the Pages panel, and treats
 *     the first page as the start page; `/` is the start page.
 * Links inside a nav, header or footer band are the app shell, repeated on
 * every page, so they are reported apart from in-page links.
 */

export interface NavPage {
  id: string;
  name: string;
  route: string;
  isStart: boolean;
  /** Fewest clicks from the start page; null when no link reaches it. */
  depth: number | null;
}

export interface NavLink {
  fromPageId: string;
  /** Target page id; null when the target does not exist. */
  toPageId: string | null;
  /** What the link points at as written (route, page id or page name). */
  target: string;
  label: string;
  kind: 'link' | 'button';
  /** Inside the app's nav bar, header or footer. */
  inShell: boolean;
  componentId: string;
}

export interface NavigationGraph {
  pages: NavPage[];
  links: NavLink[];
}

const SHELL_CLASSES = ['ds-nav', 'assistant-nav-header', 'ds-footer', 'assistant-footer'];
const SHELL_TAGS = ['nav', 'header', 'footer'];
/** Component types and tag the GUI processor parses as buttons (processor.py button parser). */
const BUTTON_TYPES = ['button', 'action-button'];

const isShell = (comp: Component): boolean => {
  const tag = String(comp.get('tagName') || '').toLowerCase();
  return SHELL_TAGS.includes(tag) || comp.getClasses().some((c: string) => SHELL_CLASSES.includes(c));
};

/** `/` + lowercased name, spaces as hyphens: the route the GUI processor gives a page. */
export const routeFromName = (name: string): string => '/' + name.toLowerCase().split(' ').join('-');

/** A comparable in-app route for an href, or null when it is not one (external, mailto, in-page anchor, empty). */
export const routeKey = (href: unknown): string | null => {
  let h = String(href ?? '').trim();
  if (!h || /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//')) return null;
  if (h.startsWith('#/')) h = h.slice(1);
  else if (h.startsWith('#')) return null;
  h = h.split(/[?#]/)[0];
  if (!h.startsWith('/')) h = '/' + h;
  return (h.replace(/\/+$/, '') || '/').toLowerCase();
};

const textOf = (comp: Component): string => {
  if (comp.get('type') === 'textnode') return String(comp.get('content') || '');
  let text = String(comp.get('content') || '');
  comp.components().forEach((child: Component) => {
    text += ' ' + textOf(child);
  });
  return text;
};

const labelOf = (comp: Component): string => {
  const attrs = comp.getAttributes();
  const text = textOf(comp).replace(/\s+/g, ' ').trim();
  return (comp.get('button-label') || text || attrs.title || attrs['aria-label'] || '').toString().trim();
};

/** The first value set among the component's own props, then its attributes. */
const propOrAttr = (comp: Component, keys: string[]): string | undefined => {
  const attrs = comp.getAttributes();
  const value = keys.map((k) => comp.get(k)).find(Boolean) ?? keys.map((k) => attrs[k]).find(Boolean);
  return value ? String(value) : undefined;
};

export function buildNavigationGraph(pages: Page[]): NavigationGraph {
  const navPages: NavPage[] = pages.map((page, index) => {
    const name = page.getName() || page.getId();
    return { id: page.getId(), name, route: routeFromName(name), isStart: index === 0, depth: null };
  });

  const byRoute = new Map(navPages.map((p) => [routeKey(p.route)!, p.id]));
  if (navPages.length) byRoute.set('/', navPages[0].id);
  const byId = new Set(navPages.map((p) => p.id));
  const byName = new Map(navPages.map((p) => [p.name, p.id]));

  const links: NavLink[] = [];
  pages.forEach((page) => {
    const fromPageId = page.getId();
    const walk = (comp: Component, inShell: boolean) => {
      const shell = inShell || isShell(comp);
      const tag = String(comp.get('tagName') || '').toLowerCase();
      const type = String(comp.get('type') || '');

      if (BUTTON_TYPES.includes(type) || tag === 'button') {
        const screen = propOrAttr(comp, ['target-screen', 'data-target-screen']);
        const action = propOrAttr(comp, ['action-type', 'data-action-type']);
        if (screen && (!action || action === 'navigate')) {
          const id = screen.replace(/^page:/, '');
          links.push({
            fromPageId,
            toPageId: byId.has(id) ? id : byName.get(screen) ?? null,
            target: id,
            label: labelOf(comp),
            kind: 'button',
            inShell: shell,
            componentId: comp.getId(),
          });
        }
      } else if (tag === 'a' || type === 'link' || type === 'link-button') {
        const href = propOrAttr(comp, ['href', 'data-href']);
        const key = routeKey(href);
        if (key) {
          links.push({
            fromPageId,
            toPageId: byRoute.get(key) ?? null,
            target: String(href).trim(),
            label: labelOf(comp),
            kind: 'link',
            inShell: shell,
            componentId: comp.getId(),
          });
        }
      }
      comp.components().forEach((child: Component) => walk(child, shell));
    };
    walk(page.getMainComponent(), false);
  });

  // Breadth-first from the start page over every working link.
  if (navPages.length) {
    const depth = new Map<string, number>([[navPages[0].id, 0]]);
    const queue = [navPages[0].id];
    while (queue.length) {
      const from = queue.shift()!;
      links.forEach((l) => {
        if (l.fromPageId === from && l.toPageId && !depth.has(l.toPageId)) {
          depth.set(l.toPageId, depth.get(from)! + 1);
          queue.push(l.toPageId);
        }
      });
    }
    navPages.forEach((p) => {
      p.depth = depth.get(p.id) ?? null;
    });
  }

  return { pages: navPages, links };
}

/** Pages the app shell (nav bar, header, footer) links to, without repeats. */
export const shellTargets = (graph: NavigationGraph): string[] => [
  ...new Set(graph.links.filter((l) => l.inShell && l.toPageId).map((l) => l.toPageId!)),
];

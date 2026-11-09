/**
 * Reads the links between the pages of a GUI (no-code) diagram, the way the
 * BESSER GUI processor turns them into navigation:
 *   - an action button whose action is `navigate` targets a page id
 *     (`target-screen`, optionally `page:`-prefixed);
 *   - an `<a href="/route">` targets the page whose route matches. The
 *     generated app routes a page at `/` + its lowercased name (spaces as
 *     hyphens) and treats the first page as the start page; `/` is the start page.
 * Links inside a nav or footer band are the app shell, repeated on every page,
 * so they are reported apart from in-page links.
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
  /** What the link points at as written (route or page id). */
  target: string;
  label: string;
  kind: 'link' | 'button';
  /** Inside the app's nav bar or footer. */
  inShell: boolean;
  componentId: string;
}

export interface NavigationGraph {
  pages: NavPage[];
  links: NavLink[];
}

/** The slice of the GrapesJS component API this module reads. */
interface ComponentLike {
  get(prop: string): any;
  getId(): string;
  getAttributes(): Record<string, any>;
  getClasses(): string[];
  components(): { forEach(fn: (c: ComponentLike) => void): void };
}

interface PageLike {
  getId(): string;
  getName(): string;
  get(prop: string): any;
  getMainComponent(): ComponentLike | undefined;
}

const SHELL_CLASSES = ['ds-nav', 'assistant-nav-header', 'ds-footer', 'assistant-footer'];
const SHELL_TAGS = ['nav', 'header', 'footer'];

const isShell = (comp: ComponentLike): boolean => {
  const tag = String(comp.get('tagName') || '').toLowerCase();
  return SHELL_TAGS.includes(tag) || comp.getClasses().some((c) => SHELL_CLASSES.includes(c));
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

const textOf = (comp: ComponentLike): string => {
  if (comp.get('type') === 'textnode') return String(comp.get('content') || '');
  let text = String(comp.get('content') || '');
  comp.components().forEach((child) => {
    text += ' ' + textOf(child);
  });
  return text;
};

const labelOf = (comp: ComponentLike): string => {
  const attrs = comp.getAttributes();
  const text = textOf(comp).replace(/\s+/g, ' ').trim();
  return (comp.get('button-label') || text || attrs.title || attrs['aria-label'] || '').toString().trim();
};

export function buildNavigationGraph(pages: PageLike[]): NavigationGraph {
  const navPages: NavPage[] = pages.map((page, index) => {
    const name = page.getName() || page.getId();
    return {
      id: page.getId(),
      name,
      route: page.get('route_path') || routeFromName(name),
      isStart: index === 0,
      depth: null,
    };
  });

  const byRoute = new Map<string, string>();
  navPages.forEach((p) => {
    const custom = routeKey(p.route);
    if (custom && !byRoute.has(custom)) byRoute.set(custom, p.id);
  });
  // The name route is what the generated app serves, so it wins a clash.
  navPages.forEach((p) => byRoute.set(routeKey(routeFromName(p.name))!, p.id));
  if (navPages.length) byRoute.set('/', navPages[0].id);
  const pageIds = new Set(navPages.map((p) => p.id));

  const links: NavLink[] = [];
  pages.forEach((page) => {
    const fromPageId = page.getId();
    const walk = (comp: ComponentLike, inShell: boolean) => {
      const shell = inShell || isShell(comp);
      const attrs = comp.getAttributes();
      const tag = String(comp.get('tagName') || '').toLowerCase();
      const type = String(comp.get('type') || '');

      const screen = comp.get('target-screen') || attrs['data-target-screen'] || attrs['target-screen'];
      const action = comp.get('action-type') || attrs['data-action-type'];
      if (screen && (!action || action === 'navigate')) {
        const id = String(screen).replace(/^page:/, '');
        links.push({
          fromPageId,
          toPageId: pageIds.has(id) ? id : null,
          target: id,
          label: labelOf(comp),
          kind: 'button',
          inShell: shell,
          componentId: comp.getId(),
        });
      } else if (tag === 'a' || type === 'link' || type === 'link-button') {
        const href = attrs.href || attrs['data-href'];
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
      comp.components().forEach((child) => walk(child, shell));
    };
    const root = page.getMainComponent();
    if (root) walk(root, false);
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

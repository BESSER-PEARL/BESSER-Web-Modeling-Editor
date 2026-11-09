import { describe, expect, it } from 'vitest';
import grapesjs from 'grapesjs';
import { buildNavigationGraph, routeKey } from '../navigationGraph';
import { toElements } from '../navigationLayout';

const navButton = (target: string, label: string, action = 'navigate') => ({
  type: 'action-button',
  'action-type': action,
  'target-screen': target,
  'button-label': label,
  components: [{ type: 'textnode', content: label }],
});

const graphOf = (pages: { id: string; name: string; component: any; route_path?: string }[]) => {
  const editor = grapesjs.init({ headless: true, storageManager: false, pageManager: { pages } });
  return buildNavigationGraph(editor.Pages.getAll());
};

describe('buildNavigationGraph', () => {
  const shell =
    '<nav class="ds-nav"><a href="/home">Home</a><a href="/my-tasks">My tasks</a></nav>';

  const graph = graphOf([
    { id: 'home', name: 'Home', component: shell + '<section><a href="/my-tasks">See tasks</a></section>' },
    {
      id: 'tasks-1',
      name: 'My Tasks',
      component: [
        { tagName: 'nav', components: '<a href="/">Start</a>' },
        navButton('page:task-detail', 'Open task'),
        navButton('task-detail', 'Complete', 'run-method'),
        '<a href="https://example.com">Docs</a><a href="#top">Top</a><a href="mailto:a@b.c">Mail</a>',
        '<a href="/reports">Reports</a>',
      ],
    },
    { id: 'task-detail', name: 'Task detail', component: navButton('gone-page', 'Back') },
    { id: 'orphan', name: 'Orphan', component: '<p>nobody links here</p>' },
  ]);
  const linksFrom = (id: string) => graph.links.filter((l) => l.fromPageId === id);

  it('resolves an href by the route the generated app gives the page name', () => {
    const body = linksFrom('home').find((l) => !l.inShell)!;
    expect(body).toMatchObject({ toPageId: 'tasks-1', label: 'See tasks', kind: 'link' });
  });

  it('marks nav-band links as app shell', () => {
    expect(linksFrom('home').filter((l) => l.inShell).map((l) => l.toPageId)).toEqual(['home', 'tasks-1']);
    expect(linksFrom('tasks-1').find((l) => l.label === 'Start')).toMatchObject({ toPageId: 'home', inShell: true });
  });

  it('follows navigate buttons by page id, ignoring other button actions', () => {
    const buttons = linksFrom('tasks-1').filter((l) => l.kind === 'button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatchObject({ toPageId: 'task-detail', label: 'Open task' });
  });

  it('reports links to pages that do not exist and skips non-page hrefs', () => {
    expect(linksFrom('tasks-1').filter((l) => l.kind === 'link').map((l) => l.target)).toEqual(['/', '/reports']);
    expect(graph.links.filter((l) => l.toPageId === null).map((l) => l.target)).toEqual(['/reports', 'gone-page']);
  });

  it('counts clicks from the start page and leaves unlinked pages unreached', () => {
    expect(graph.pages.map((p) => [p.id, p.isStart, p.depth])).toEqual([
      ['home', true, 0],
      ['tasks-1', false, 1],
      ['task-detail', false, 2],
      ['orphan', false, null],
    ]);
  });
});

describe('routeKey', () => {
  it('normalises in-app routes and rejects everything else', () => {
    expect(routeKey('/Tasks/?x=1#a')).toBe('/tasks');
    expect(routeKey('#/tasks')).toBe('/tasks');
    expect(routeKey('tasks')).toBe('/tasks');
    expect(routeKey('/')).toBe('/');
    expect(['', '#', '#top', 'https://x.y', '//cdn.x', 'tel:1', 'javascript:void(0)', null].map(routeKey)).toEqual(
      Array(8).fill(null),
    );
  });
});

describe('toElements', () => {
  const graph = graphOf([
    {
      id: 'home',
      name: 'Home',
      component: '<nav><a href="/home">Home</a><a href="/list">List</a></nav><a href="/list">All</a><a href="/list">See list</a><a href="/home">Self</a>',
    },
    { id: 'list', name: 'List', component: '<a href="/home">Back</a>' },
    { id: 'lost', name: 'Lost', component: '' },
  ]);

  it('lays pages out by clicks from the start, with unreached pages last and the nav bar as one hub', () => {
    const els = toElements(graph, 'Navigation bar', 'list');
    const node = (id: string) => els.find((e) => e.data.id === id)!;

    expect([node('home'), node('list'), node('lost')].map((n) => n.position!.x)).toEqual([0, 250, 500]);
    expect(node('home').classes).toBe('start');
    expect(node('list').classes).toBe('current');
    expect(node('lost').classes).toBe('unreached');
    expect(node('__shell__').position!.x).toBe(0);

    const edges = els.filter((e) => e.data.source).map((e) => [e.data.source, e.data.target, e.data.label ?? null]);
    expect(edges).toEqual([
      ['__shell__', 'home', null],
      ['__shell__', 'list', null],
      ['home', 'list', 'All, See list'],
      ['list', 'home', 'Back'],
    ]);
  });
});

describe('buildNavigationGraph link encodings', () => {
  const graph = graphOf([
    {
      id: 'start',
      name: 'Start',
      component: [
        '<div class="assistant-nav-header"><a href="/shop">Shop link</a></div>',
        { tagName: 'button', attributes: { 'data-action-type': 'navigate', 'data-target-screen': 'page:shop' }, components: 'Shop' },
        { type: 'action-button', 'target-screen': 'My Shop', components: 'By name' },
        { type: 'link', attributes: { href: '/my-shop' }, components: 'Go shopping' },
        { tagName: 'a', 'target-screen': 'page:shop', attributes: { href: '/about' }, components: 'Anchor' },
        '<a href="/about-us">Custom route</a>',
      ],
    },
    { id: 'shop', name: 'My Shop', component: '' },
    // Pages-panel routes: a custom one and one left stale by a rename. The generated app serves neither.
    { id: 'about', name: 'About', route_path: '/about-us', component: '' },
    { id: 'renamed', name: 'Renamed', route_path: '/shop', component: '' },
  ]);
  const byLabel = (label: string) => graph.links.find((l) => l.label === label)!;

  it('treats an app-shell class on any tag as the nav bar', () => {
    expect(byLabel('Shop link')).toMatchObject({ inShell: true });
  });

  it('reads navigate buttons from data- attributes, by page id or else by page name', () => {
    expect(byLabel('Shop')).toMatchObject({ toPageId: 'shop', kind: 'button' });
    expect(byLabel('By name')).toMatchObject({ toPageId: 'shop', kind: 'button' });
  });

  it('reads links from the link component type and an anchor by its href, not a target-screen', () => {
    expect(byLabel('Go shopping')).toMatchObject({ toPageId: 'shop', kind: 'link' });
    expect(byLabel('Anchor')).toMatchObject({ toPageId: 'about', kind: 'link' });
  });

  it('resolves routes by page name only, like the generated app', () => {
    expect(byLabel('Custom route').toPageId).toBeNull();
    expect(byLabel('Shop link').toPageId).toBeNull();
    expect(graph.pages.find((p) => p.id === 'about')!.route).toBe('/about');
  });
});

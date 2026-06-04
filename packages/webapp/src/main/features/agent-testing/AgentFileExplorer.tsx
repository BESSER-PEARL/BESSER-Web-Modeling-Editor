import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Code2,
  Copy,
  File,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectSessionId } from '@/main/features/agent-testing';
import { BACKEND_URL } from '@/main/shared/constants/constant';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionFile {
  path: string;
  content: string;
}

type TreeNode =
  | { kind: 'file'; name: string; fullPath: string; content: string }
  | { kind: 'dir'; name: string; fullPath: string; children: TreeNode[] };

interface SessionFilesResponse {
  files: SessionFile[];
  directories?: string[];
}

interface ShikiToken {
  content: string;
  htmlStyle?: string | Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizeDirectoryPath(path: string): string {
  return normalizePath(path).replace(/^\/+/, '').replace(/\/+$/, '');
}

function buildTree(files: SessionFile[], directories: string[] = [], prefix = ''): TreeNode[] {
  const dirMap = new Map<string, { files: SessionFile[]; dirs: string[] }>();
  const fileNodes: TreeNode[] = [];

  const ensureDirEntry = (name: string) => {
    if (!dirMap.has(name)) {
      dirMap.set(name, { files: [], dirs: [] });
    }
    return dirMap.get(name)!;
  };

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    const slashIdx = normalizedPath.indexOf('/');
    if (slashIdx === -1) {
      const fullPath = prefix ? `${prefix}/${normalizedPath}` : normalizedPath;
      fileNodes.push({ kind: 'file', name: normalizedPath, fullPath, content: file.content });
    } else {
      const dirName = normalizedPath.slice(0, slashIdx);
      ensureDirEntry(dirName).files.push({ path: normalizedPath.slice(slashIdx + 1), content: file.content });
    }
  }

  for (const dirPath of directories) {
    const normalizedDirPath = normalizeDirectoryPath(dirPath);
    if (!normalizedDirPath) continue;
    const slashIdx = normalizedDirPath.indexOf('/');
    if (slashIdx === -1) {
      ensureDirEntry(normalizedDirPath);
    } else {
      const dirName = normalizedDirPath.slice(0, slashIdx);
      const nestedPath = normalizedDirPath.slice(slashIdx + 1);
      const entry = ensureDirEntry(dirName);
      if (!entry.dirs.includes(nestedPath)) entry.dirs.push(nestedPath);
    }
  }

  const dirNodes: TreeNode[] = [];
  for (const [dirName, children] of dirMap) {
    const childPrefix = prefix ? `${prefix}/${dirName}` : dirName;
    dirNodes.push({
      kind: 'dir',
      name: dirName,
      fullPath: childPrefix,
      children: buildTree(children.files, children.dirs, childPrefix),
    });
  }

  return [
    ...dirNodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...fileNodes.sort((a, b) => a.name.localeCompare(b.name)),
  ];
}

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    py: 'python',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    md: 'markdown',
    txt: 'text',
    sh: 'bash',
    toml: 'toml',
  };
  return langMap[ext] ?? 'text';
}

function getAuthHeaders(): Record<string, string> {
  const githubSession = sessionStorage.getItem('github_session');
  return githubSession ? { 'X-GitHub-Session': githubSession } : {};
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useHighlightedTokens(content: string, lang: string) {
  const [lines, setLines] = useState<ShikiToken[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { codeToTokens } = await import('shiki/bundle/web');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { tokens } = await codeToTokens(content, {
          lang: lang as any,
          defaultColor: false,
          themes: { light: 'github-light', dark: 'github-dark' },
        });
        if (!cancelled) setLines(tokens as ShikiToken[][]);
      } catch {
        if (!cancelled) setLines(null);
      }
    })();
    return () => { cancelled = true; };
  }, [content, lang]);

  return lines;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title="Copy file content"
    >
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function HighlightedCode({ content, lang }: { content: string; lang: string }) {
  const lines = useHighlightedTokens(content, lang);

  if (!lines) {
    return (
      <pre className="min-w-max p-4 font-mono text-xs leading-relaxed text-foreground">
        {content}
      </pre>
    );
  }

  return (
    <pre className="min-w-max p-4 font-mono text-xs leading-relaxed">
      <code>
        {lines.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            <span>
              {line.map((token, tokenIndex) => {
                const style = typeof token.htmlStyle === 'string' ? undefined : token.htmlStyle;
                return (
                  <span
                    key={tokenIndex}
                    className="text-shiki-light bg-shiki-light-bg dark:text-shiki-dark dark:bg-shiki-dark-bg"
                    style={style}
                  >
                    {token.content}
                  </span>
                );
              })}
            </span>
            {lineIndex !== lines.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </code>
    </pre>
  );
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string, content: string) => void;
}) {
  // Top-level directories start expanded
  const [expanded, setExpanded] = useState(depth === 0);
  const indent = depth * 12 + 8;

  if (node.kind === 'file') {
    const isSelected = selectedPath === node.fullPath;
    return (
      <button
        className={[
          'flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        ].join(' ')}
        style={{ paddingLeft: indent }}
        onClick={() => onSelectFile(node.fullPath, node.content)}
      >
        <File className="size-3 shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        style={{ paddingLeft: indent }}
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          className={['size-3 shrink-0 transition-transform', expanded ? 'rotate-90' : ''].join(' ')}
        />
        {expanded ? (
          <FolderOpen className="size-3 shrink-0 text-yellow-500" />
        ) : (
          <Folder className="size-3 shrink-0 text-yellow-500" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {expanded && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AgentFileExplorer: React.FC = () => {
  const sessionId = useAppSelector(selectSessionId);

  const [files, setFiles] = useState<SessionFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  const fetchFiles = useCallback(async (sid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/test/sessions/${sid}/files`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) {
        const text = await resp.text();
        setFetchError(`Failed to fetch files: ${text || String(resp.status)}`);
        return;
      }
      const data = (await resp.json()) as SessionFilesResponse;
      const normalizedFiles = data.files.map((file) => ({
        ...file,
        path: normalizePath(file.path),
      }));
      const normalizedDirectories = (data.directories ?? [])
        .map(normalizeDirectoryPath)
        .filter((path) => Boolean(path));
      setFiles(normalizedFiles);
      setDirectories(normalizedDirectories);
      // Auto-select agent.py (or first file) when no valid selection exists
      setSelectedPath((prev) => {
        if (prev && normalizedFiles.some((f) => f.path === prev)) return prev;
        return normalizedFiles.find((f) => f.path === 'agent.py' || f.path.endsWith('/agent.py'))?.path
          ?? normalizedFiles[0]?.path
          ?? null;
      });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever sessionId appears or changes
  useEffect(() => {
    if (sessionId) {
      void fetchFiles(sessionId);
    } else {
      setFiles([]);
      setDirectories([]);
      setSelectedPath(null);
      setSelectedContent(null);
      setFetchError(null);
    }
  }, [sessionId, fetchFiles]);

  // Keep selected content in sync with files list
  useEffect(() => {
    if (!selectedPath) { setSelectedContent(null); return; }
    const file = files.find((f) => f.path === selectedPath);
    setSelectedContent(file?.content ?? null);
  }, [selectedPath, files]);

  const tree = useMemo(() => buildTree(files, directories), [files, directories]);
  const lang = useMemo(() => (selectedPath ? detectLanguage(selectedPath) : 'text'), [selectedPath]);

  const handleSelectFile = useCallback((path: string, content: string) => {
    setSelectedPath(path);
    setSelectedContent(content);
  }, []);

  // Empty states
  if (!sessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Code2 className="size-10 text-muted-foreground/25" />
        <p className="text-sm font-medium text-muted-foreground">No active test session</p>
        <p className="text-xs text-muted-foreground/60">
          Start a test session to explore the generated files.
        </p>
      </div>
    );
  }

  if (loading && files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading session files…</p>
      </div>
    );
  }

  if (fetchError && files.length === 0 && directories.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-red-500">{fetchError}</p>
        <Button variant="outline" size="sm" onClick={() => void fetchFiles(sessionId)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm">
      {/* Sidebar: file tree */}
      <div className="flex w-48 min-w-48 shrink-0 flex-col overflow-hidden border-r border-border/40">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border/40 bg-muted/30 px-2 py-1.5">
          <span className="flex-1 truncate text-xs font-medium text-muted-foreground">Files</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-5 text-muted-foreground hover:text-foreground"
            onClick={() => void fetchFiles(sessionId)}
            disabled={loading}
            title="Refresh files"
          >
            <RefreshCw className={['size-3', loading ? 'animate-spin' : ''].join(' ')} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {tree.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground/60">No files or folders found</p>
          ) : (
            tree.map((node) => (
              <TreeItem
                key={node.fullPath}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
              />
            ))
          )}
        </div>
      </div>

      {/* Main: file content viewer */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {selectedPath && selectedContent !== null ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5">
              <File className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-xs font-medium text-muted-foreground">
                {selectedPath}
              </span>
              <CopyButton content={selectedContent} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <HighlightedCode content={selectedContent} lang={lang} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Select a file to view its content
          </div>
        )}
      </div>
    </div>
  );
};

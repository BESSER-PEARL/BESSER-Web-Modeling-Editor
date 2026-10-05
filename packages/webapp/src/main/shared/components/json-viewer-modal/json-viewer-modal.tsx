import React from 'react';
import { useTranslation } from 'react-i18next';
import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import pythonLang from 'highlight.js/lib/languages/python';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import './json-viewer-modal.css';

if (!hljs.getLanguage('json')) {
  hljs.registerLanguage('json', jsonLang);
}

if (!hljs.getLanguage('python')) {
  hljs.registerLanguage('python', pythonLang);
}

interface JsonViewerModalProps {
  isVisible: boolean;
  jsonData: string;
  diagramType: string;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  enableBumlView?: boolean;
  bumlData?: string;
  bumlLabel?: string;
  isBumlLoading?: boolean;
  bumlError?: string;
  onRequestBuml?: () => void;
  onCopyBuml?: () => void;
  onDownloadBuml?: () => void;
}

/** Muted, theme-aware code surface shared by the JSON tree and highlighted code. */
const codeSurfaceClass =
  'jvm-code m-0 overflow-auto rounded-xl border border-border/70 bg-muted/40 p-[18px] text-[13px] leading-[1.65] text-foreground';

type SupportedLanguage = 'json' | 'python';
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface JsonTreeNodeProps {
  value: JsonValue;
  path: string;
  depth: number;
  isLast: boolean;
  propertyKey?: string;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  copiedPath: string | null;
  onCopyNode: (path: string, value: JsonValue) => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const highlightCode = (code: string, language: SupportedLanguage): string => {
  if (!code) {
    return '';
  }

  try {
    return hljs.highlight(code, { language }).value;
  } catch (error) {
    console.warn('Failed to highlight code. Falling back to plain text.', error);
    return escapeHtml(code);
  }
};

const HighlightedCode: React.FC<{ code: string; language: SupportedLanguage }> = ({ code, language }) => {
  const highlightedMarkup = React.useMemo(() => highlightCode(code, language), [code, language]);

  return (
    <pre className={cn(codeSurfaceClass, 'whitespace-pre')}>
      <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />
    </pre>
  );
};

const isJsonContainer = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } =>
  typeof value === 'object' && value !== null;

const buildJsonPath = (parentPath: string, key: string | number): string =>
  `${parentPath}/${encodeURIComponent(String(key))}`;

const renderJsonPrimitive = (value: JsonPrimitive): React.ReactNode => {
  if (typeof value === 'string') {
    return <span className="hljs-string">{JSON.stringify(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className="hljs-number">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="hljs-literal">{value ? 'true' : 'false'}</span>;
  }

  return <span className="hljs-literal">null</span>;
};

const renderJsonKey = (propertyKey?: string): React.ReactNode => {
  if (propertyKey === undefined) {
    return null;
  }

  return (
    <>
      <span className="hljs-attr">{JSON.stringify(propertyKey)}</span>
      <span>{': '}</span>
    </>
  );
};

const CopyNodeButton: React.FC<{ path: string; value: JsonValue; copiedPath: string | null; onCopyNode: (path: string, value: JsonValue) => void }> = ({
  path,
  value,
  copiedPath,
  onCopyNode,
}) => {
  const { t } = useTranslation();
  const isCopied = copiedPath === path;

  return (
    <button
      type="button"
      className="jvm-copy-node-btn ml-1.5 rounded-sm border-none bg-transparent p-0 text-[11px] leading-none text-muted-foreground opacity-0 cursor-pointer transition-[color,opacity] duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => {
        event.stopPropagation();
        onCopyNode(path, value);
      }}
      aria-label={t('shared.jsonViewer.copyValue')}
    >
      {isCopied ? '✓' : '⧉'}
    </button>
  );
};

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  value,
  path,
  depth,
  isLast,
  propertyKey,
  collapsedPaths,
  onToggle,
  copiedPath,
  onCopyNode,
}) => {
  const { t } = useTranslation();
  if (!isJsonContainer(value)) {
    return (
      <div className="jvm-tree-row flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="inline-block w-3.5 mr-1 text-center text-transparent" aria-hidden="true" />
        {renderJsonKey(propertyKey)}
        {renderJsonPrimitive(value)}
        {!isLast && <span>,</span>}
        <CopyNodeButton path={path} value={value} copiedPath={copiedPath} onCopyNode={onCopyNode} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const openToken = isArray ? '[' : '{';
  const closeToken = isArray ? ']' : '}';
  const entries: Array<[string | number, JsonValue]> = isArray
    ? value.map((item, index) => [index, item])
    : (Object.entries(value) as Array<[string, JsonValue]>);
  const hasChildren = entries.length > 0;
  const isCollapsed = hasChildren && collapsedPaths.has(path);
  const sectionName = propertyKey ?? t('shared.jsonViewer.root');

  if (!hasChildren) {
    return (
      <div className="jvm-tree-row flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="inline-block w-3.5 mr-1 text-center text-transparent" aria-hidden="true" />
        {renderJsonKey(propertyKey)}
        <span>{openToken}{closeToken}</span>
        {!isLast && <span>,</span>}
        <CopyNodeButton path={path} value={value} copiedPath={copiedPath} onCopyNode={onCopyNode} />
      </div>
    );
  }

  return (
    <>
      <div className="jvm-tree-row flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          type="button"
          onClick={() => onToggle(path)}
          aria-label={
            isCollapsed
              ? t('shared.jsonViewer.expand', { name: sectionName })
              : t('shared.jsonViewer.collapse', { name: sectionName })
          }
          className="border-none bg-transparent text-inherit m-0 p-0 font-[inherit] leading-[inherit] cursor-pointer inline-flex items-baseline min-w-0 rounded-sm text-left hover:opacity-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-block w-3.5 mr-1 text-muted-foreground text-center" aria-hidden="true">
            {isCollapsed ? '>' : 'v'}
          </span>
          {renderJsonKey(propertyKey)}
          <span>{openToken}</span>
          {isCollapsed && (
            <>
              <span> </span>
              <span className="text-muted-foreground">...</span>
              <span> {closeToken}</span>
            </>
          )}
        </button>
        {isCollapsed && !isLast && <span>,</span>}
        <CopyNodeButton path={path} value={value} copiedPath={copiedPath} onCopyNode={onCopyNode} />
      </div>

      {!isCollapsed && (
        <>
          {entries.map(([entryKey, entryValue], index) => {
            const childPath = buildJsonPath(path, entryKey);

            return (
              <JsonTreeNode
                key={childPath}
                value={entryValue}
                path={childPath}
                depth={depth + 1}
                isLast={index === entries.length - 1}
                propertyKey={isArray ? undefined : String(entryKey)}
                collapsedPaths={collapsedPaths}
                onToggle={onToggle}
                copiedPath={copiedPath}
                onCopyNode={onCopyNode}
              />
            );
          })}
          <div className="flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="inline-block w-3.5 mr-1 text-center text-transparent" aria-hidden="true" />
            <span>{closeToken}</span>
            {!isLast && <span>,</span>}
          </div>
        </>
      )}
    </>
  );
};

const JsonTreeViewer: React.FC<{ rawJson: string }> = ({ rawJson }) => {
  const [collapsedPaths, setCollapsedPaths] = React.useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCollapsedPaths(new Set());
  }, [rawJson]);

  const parsed = React.useMemo<{ isValid: true; value: JsonValue } | { isValid: false }>(() => {
    try {
      return { isValid: true, value: JSON.parse(rawJson) as JsonValue };
    } catch (error) {
      console.warn('Failed to parse JSON preview. Falling back to highlighted text.', error);
      return { isValid: false };
    }
  }, [rawJson]);

  const togglePath = React.useCallback((path: string) => {
    setCollapsedPaths((previousState) => {
      const nextState = new Set(previousState);

      if (nextState.has(path)) {
        nextState.delete(path);
      } else {
        nextState.add(path);
      }

      return nextState;
    });
  }, []);

  const handleCopyNode = React.useCallback((path: string, value: JsonValue) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath((current) => (current === path ? null : current)), 1500);
    });
  }, []);

  if (!parsed.isValid) {
    return <HighlightedCode code={rawJson} language="json" />;
  }

  return (
    <div className={codeSurfaceClass}>
      <JsonTreeNode
        value={parsed.value}
        path="root"
        depth={0}
        isLast
        collapsedPaths={collapsedPaths}
        onToggle={togglePath}
        copiedPath={copiedPath}
        onCopyNode={handleCopyNode}
      />
    </div>
  );
};

const tabClass = (isActive: boolean): string =>
  cn(
    'flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
    isActive
      ? 'border-brand bg-brand text-brand-foreground'
      : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
  );

const primaryButtonClass = 'bg-brand text-brand-foreground hover:bg-brand-dark';

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  isVisible,
  jsonData,
  diagramType,
  onClose,
  onCopy,
  onDownload,
  enableBumlView = false,
  bumlData,
  bumlLabel,
  isBumlLoading = false,
  bumlError,
  onRequestBuml,
  onCopyBuml,
  onDownloadBuml,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'json' | 'buml'>('json');

  React.useEffect(() => {
    if (isVisible) {
      setActiveTab('json');
    }
  }, [isVisible]);

  const handleTabChange = (tab: 'json' | 'buml') => {
    setActiveTab(tab);
    if (tab === 'buml' && enableBumlView && onRequestBuml && !bumlData && !isBumlLoading) {
      onRequestBuml();
    }
  };

  const resolvedBumlLabel = bumlLabel ?? t('shared.jsonViewer.diagramBuml');
  const isBumlView = enableBumlView && activeTab === 'buml';
  const headerTitle = isBumlView ? resolvedBumlLabel : t('shared.jsonViewer.jsonTitle');

  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[min(960px,92vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4 pr-12">
          <DialogTitle>{headerTitle}</DialogTitle>
          <DialogDescription className="text-xs font-medium">{diagramType}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 pt-4 pb-5">
          {enableBumlView && (
            <div className="mb-3.5 flex gap-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'json'}
                className={tabClass(activeTab === 'json')}
                onClick={() => handleTabChange('json')}
              >
                JSON
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'buml'}
                className={tabClass(activeTab === 'buml')}
                onClick={() => handleTabChange('buml')}
              >
                B-UML
              </button>
            </div>
          )}

          {isBumlView ? (
            <>
              {isBumlLoading && (
                <div className="rounded-xl border border-dashed border-border p-[22px] text-center text-sm text-muted-foreground">
                  {t('shared.jsonViewer.generatingBuml')}
                </div>
              )}
              {!isBumlLoading && bumlError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                  {bumlError}
                </div>
              )}
              {!isBumlLoading && !bumlError && bumlData && <HighlightedCode code={bumlData} language="python" />}
              {!isBumlLoading && !bumlError && !bumlData && (
                <div className="rounded-xl border border-dashed border-border p-[22px] text-center text-sm text-muted-foreground">
                  {t('shared.jsonViewer.noBumlPreview')}
                </div>
              )}
            </>
          ) : (
            <JsonTreeViewer rawJson={jsonData} />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-6 py-4">
          {isBumlView ? (
            <>
              {onRequestBuml && (
                <Button variant="outline" onClick={onRequestBuml} disabled={isBumlLoading}>
                  {isBumlLoading ? t('shared.jsonViewer.generating') : t('shared.jsonViewer.regenerate')}
                </Button>
              )}
              {onDownloadBuml && (
                <Button variant="outline" onClick={onDownloadBuml} disabled={isBumlLoading || !bumlData}>
                  {t('shared.jsonViewer.downloadBuml')}
                </Button>
              )}
              {onCopyBuml && (
                <Button className={primaryButtonClass} onClick={onCopyBuml} disabled={isBumlLoading || !bumlData}>
                  {t('shared.jsonViewer.copyBuml')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onDownload}>
                {t('shared.jsonViewer.downloadJson')}
              </Button>
              <Button className={primaryButtonClass} onClick={onCopy}>
                {t('shared.jsonViewer.copyJson')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

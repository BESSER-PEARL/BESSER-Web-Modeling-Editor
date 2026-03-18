import React from 'react';
import { createPortal } from 'react-dom';
import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import pythonLang from 'highlight.js/lib/languages/python';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '../../../constants/z-index';
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
    <pre className="jvm-code-block m-0 rounded-xl p-[18px] text-[13px] leading-[1.65] whitespace-pre overflow-auto">
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
    return <span className="text-[#a6da95]">{JSON.stringify(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-[#f5a97f]">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-[#ff7ab2]">{value ? 'true' : 'false'}</span>;
  }

  return <span className="text-[#ff7ab2]">null</span>;
};

const renderJsonKey = (propertyKey?: string): React.ReactNode => {
  if (propertyKey === undefined) {
    return null;
  }

  return (
    <>
      <span className="text-[#7dc4e4]">{JSON.stringify(propertyKey)}</span>
      <span className="text-[#dbe5ff]">{': '}</span>
    </>
  );
};

const CopyNodeButton: React.FC<{ path: string; value: JsonValue; copiedPath: string | null; onCopyNode: (path: string, value: JsonValue) => void }> = ({
  path,
  value,
  copiedPath,
  onCopyNode,
}) => {
  const isCopied = copiedPath === path;

  return (
    <button
      type="button"
      className="jvm-copy-node-btn ml-1.5 border-none bg-transparent text-[#93a7c7] p-0 cursor-pointer text-[11px] leading-none opacity-0 transition-opacity duration-150"
      onClick={(event) => {
        event.stopPropagation();
        onCopyNode(path, value);
      }}
      aria-label="Copy value"
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
  if (!isJsonContainer(value)) {
    return (
      <div className="jvm-tree-row flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="inline-block w-3.5 mr-1 text-center text-transparent" aria-hidden="true" />
        {renderJsonKey(propertyKey)}
        {renderJsonPrimitive(value)}
        {!isLast && <span className="text-[#dbe5ff]">,</span>}
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
  const sectionName = propertyKey ?? 'root';

  if (!hasChildren) {
    return (
      <div className="jvm-tree-row flex items-baseline whitespace-nowrap" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="inline-block w-3.5 mr-1 text-center text-transparent" aria-hidden="true" />
        {renderJsonKey(propertyKey)}
        <span className="text-[#dbe5ff]">{openToken}{closeToken}</span>
        {!isLast && <span className="text-[#dbe5ff]">,</span>}
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
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${sectionName}`}
          className="border-none bg-transparent text-inherit m-0 p-0 font-[inherit] leading-[inherit] cursor-pointer inline-flex items-baseline min-w-0 text-left hover:opacity-[0.92]"
        >
          <span className="inline-block w-3.5 mr-1 text-[#93a7c7] text-center" aria-hidden="true">
            {isCollapsed ? '>' : 'v'}
          </span>
          {renderJsonKey(propertyKey)}
          <span className="text-[#dbe5ff]">{openToken}</span>
          {isCollapsed && (
            <>
              <span className="text-[#dbe5ff]"> </span>
              <span className="text-[#7f8aa3]">...</span>
              <span className="text-[#dbe5ff]"> {closeToken}</span>
            </>
          )}
        </button>
        {isCollapsed && !isLast && <span className="text-[#dbe5ff]">,</span>}
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
            <span className="text-[#dbe5ff]">{closeToken}</span>
            {!isLast && <span className="text-[#dbe5ff]">,</span>}
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
    <div className="jvm-tree-block m-0 rounded-xl p-[18px] text-[13px] leading-[1.65] overflow-auto">
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

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  isVisible,
  jsonData,
  diagramType,
  onClose,
  onCopy,
  onDownload,
  enableBumlView = false,
  bumlData,
  bumlLabel = 'Diagram B-UML',
  isBumlLoading = false,
  bumlError,
  onRequestBuml,
  onCopyBuml,
  onDownloadBuml,
}) => {
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

  if (!isVisible) {
    return null;
  }

  const isBumlView = enableBumlView && activeTab === 'buml';
  const headerTitle = isBumlView ? bumlLabel : 'Project JSON Preview';

  return createPortal(
    <div
      className="jvm-overlay fixed inset-0 flex items-center justify-center p-5"
      style={{ zIndex: Z_INDEX.MODAL }}
      onClick={onClose}
    >
      <div
        className="jvm-content flex flex-col overflow-hidden rounded-[14px] border"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="jvm-header flex items-center justify-between gap-4 px-[22px] py-[18px]">
          <h3 className="m-0 flex flex-col gap-1 text-[#e2e8f0] text-lg font-bold leading-tight">
            {headerTitle}
            <span className="text-[#93a7c7] text-xs font-medium tracking-[0.01em]">
              {diagramType}
            </span>
          </h3>
          <button
            className="jvm-close-btn w-[34px] h-[34px] inline-flex items-center justify-center rounded-lg border text-lg cursor-pointer transition-all duration-200 ease-in-out"
            onClick={onClose}
            aria-label="Close preview modal"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-[22px] pt-4 pb-5">
          {enableBumlView && (
            <div className="flex gap-2 mb-3.5">
              <button
                type="button"
                className={cn(
                  'jvm-tab-btn flex-1 rounded-full py-2 px-3 text-xs font-bold tracking-[0.04em] cursor-pointer transition-all duration-200 ease-in-out',
                  activeTab === 'json' && 'active',
                )}
                onClick={() => handleTabChange('json')}
              >
                JSON
              </button>
              <button
                type="button"
                className={cn(
                  'jvm-tab-btn flex-1 rounded-full py-2 px-3 text-xs font-bold tracking-[0.04em] cursor-pointer transition-all duration-200 ease-in-out',
                  activeTab === 'buml' && 'active',
                )}
                onClick={() => handleTabChange('buml')}
              >
                B-UML
              </button>
            </div>
          )}

          {isBumlView ? (
            <>
              {isBumlLoading && (
                <div className="jvm-placeholder rounded-[10px] p-[22px] text-sm text-center">
                  Generating B-UML preview...
                </div>
              )}
              {!isBumlLoading && bumlError && (
                <div className="jvm-error rounded-[10px] p-4 text-sm font-semibold">
                  {bumlError}
                </div>
              )}
              {!isBumlLoading && !bumlError && bumlData && <HighlightedCode code={bumlData} language="python" />}
              {!isBumlLoading && !bumlError && !bumlData && (
                <div className="jvm-placeholder rounded-[10px] p-[22px] text-sm text-center">
                  No B-UML preview is available yet.
                </div>
              )}
            </>
          ) : (
            <JsonTreeViewer rawJson={jsonData} />
          )}
        </div>

        {/* Footer */}
        <div className="jvm-footer flex gap-2.5 justify-end px-[22px] pt-4 pb-[18px]">
          {isBumlView ? (
            <>
              {onRequestBuml && (
                <button
                  className="jvm-footer-btn secondary-button rounded-lg py-[9px] px-3.5 text-[13px] font-bold cursor-pointer"
                  onClick={onRequestBuml}
                  disabled={isBumlLoading}
                >
                  {isBumlLoading ? 'Generating...' : 'Regenerate'}
                </button>
              )}
              {onDownloadBuml && (
                <button
                  className="jvm-footer-btn secondary-button rounded-lg py-[9px] px-3.5 text-[13px] font-bold cursor-pointer"
                  onClick={onDownloadBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  Download B-UML
                </button>
              )}
              {onCopyBuml && (
                <button
                  className="jvm-footer-btn primary-button rounded-lg py-[9px] px-3.5 text-[13px] font-bold cursor-pointer"
                  onClick={onCopyBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  Copy B-UML
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="jvm-footer-btn secondary-button rounded-lg py-[9px] px-3.5 text-[13px] font-bold cursor-pointer"
                onClick={onDownload}
              >
                Download JSON
              </button>
              <button
                className="jvm-footer-btn primary-button rounded-lg py-[9px] px-3.5 text-[13px] font-bold cursor-pointer"
                onClick={onCopy}
              >
                Copy JSON
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

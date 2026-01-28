import React from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import pythonLang from 'highlight.js/lib/languages/python';

if (!hljs.getLanguage('json')) {
  hljs.registerLanguage('json', jsonLang);
}

if (!hljs.getLanguage('python')) {
  hljs.registerLanguage('python', pythonLang);
}

const ModalOverlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
  overflow-y: auto;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  z-index: 100000;
  position: relative;
  margin: auto;
`;

const ModalHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 18px;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #64748b;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
`;

const ModalFooter = styled.div`
  padding: 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;

  button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &.copy-button {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
    }

    &.download-button {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;

      &:hover {
        background: #e2e8f0;
      }
    }
  }
`;

const TabSwitcher = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 16px;

  button {
    flex: 1;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #475569;
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button.active {
    background: linear-gradient(135deg, #22d3ee, #0ea5e9);
    color: white;
    border-color: transparent;
    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.35);
  }
`;

const PlaceholderBox = styled.div`
  background: #0f172a;
  color: #94a3b8;
  padding: 32px;
  border-radius: 8px;
  text-align: center;
  border: 1px dashed #334155;
`;

const ErrorBox = styled.div`
  background: #331919;
  color: #fecaca;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  font-weight: 600;
`;

const CodeBlock = styled.pre`
  margin: 0;
  background: #0f172a;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow: auto;
  border: 1px solid #1e293b;

  code {
    display: block;
    background: transparent;
    color: inherit;
    white-space: pre;
  }

  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-literal {
    color: #93c5fd;
  }

  .hljs-string,
  .hljs-title,
  .hljs-name,
  .hljs-attr {
    color: #fcd34d;
  }

  .hljs-number,
  .hljs-symbol,
  .hljs-bullet {
    color: #fca5a5;
  }

  .hljs-built_in,
  .hljs-type,
  .hljs-attribute {
    color: #a5b4fc;
  }

  .hljs-comment,
  .hljs-quote {
    color: #94a3b8;
    font-style: italic;
  }

  .hljs-variable,
  .hljs-template-variable,
  .hljs-selector-attr {
    color: #67e8f9;
  }
`;

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
    console.warn('Failed to highlight code, falling back to plain text.', error);
    return escapeHtml(code);
  }
};

const HighlightedCode: React.FC<{ code: string; language: SupportedLanguage }> = ({
  code,
  language,
}) => {
  const highlightedMarkup = React.useMemo(
    () => highlightCode(code, language),
    [code, language],
  );

  return (
    <CodeBlock>
      <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />
    </CodeBlock>
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
  if (!isVisible) {
    return null;
  }

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

  const isBumlView = enableBumlView && activeTab === 'buml';
  const headerTitle = isBumlView ? bumlLabel : 'Diagram JSON';

  return createPortal(
    <ModalOverlay $isVisible={isVisible} onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <h3>
            📋 {headerTitle}
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#64748b' }}>
              ({diagramType})
            </span>
          </h3>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </ModalHeader>

        <ModalBody>
          {enableBumlView && (
            <TabSwitcher>
              <button
                type="button"
                className={activeTab === 'json' ? 'active' : ''}
                onClick={() => handleTabChange('json')}
              >
                JSON
              </button>
              <button
                type="button"
                className={activeTab === 'buml' ? 'active' : ''}
                onClick={() => handleTabChange('buml')}
              >
                B-UML
              </button>
            </TabSwitcher>
          )}

          {isBumlView ? (
            <>
              {isBumlLoading && <PlaceholderBox>Generating B-UML preview...</PlaceholderBox>}
              {!isBumlLoading && bumlError && <ErrorBox>{bumlError}</ErrorBox>}
              {!isBumlLoading && !bumlError && bumlData && (
                <HighlightedCode code={bumlData} language="python" />
              )}
              {!isBumlLoading && !bumlError && !bumlData && (
                <PlaceholderBox>No B-UML preview is available yet.</PlaceholderBox>
              )}
            </>
          ) : (
            <HighlightedCode code={jsonData} language="json" />
          )}
        </ModalBody>

        <ModalFooter>
          {isBumlView ? (
            <>
              {onDownloadBuml && (
                <button
                  className="download-button"
                  onClick={onDownloadBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  💾 Download B-UML
                </button>
              )}
              {onCopyBuml && (
                <button
                  className="copy-button"
                  onClick={onCopyBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  📋 Copy B-UML
                </button>
              )}
            </>
          ) : (
            <>
              <button className="download-button" onClick={onDownload}>
                💾 Download
              </button>
              <button className="copy-button" onClick={onCopy}>
                📋 Copy to Clipboard
              </button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>,
    document.body
  );
};

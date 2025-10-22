import React from 'react';
import styled from 'styled-components';

const ModalOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isVisible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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

  pre {
    margin: 0;
    background: #1e293b;
    color: #e2e8f0;
    padding: 20px;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    overflow: auto;
  }
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

interface JsonViewerModalProps {
  isVisible: boolean;
  jsonData: string;
  diagramType: string;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  isVisible,
  jsonData,
  diagramType,
  onClose,
  onCopy,
  onDownload
}) => {
  return (
    <ModalOverlay isVisible={isVisible} onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <h3>
            📋 Diagram JSON
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#64748b' }}>
              ({diagramType})
            </span>
          </h3>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </ModalHeader>
        
        <ModalBody>
          <pre>{jsonData}</pre>
        </ModalBody>
        
        <ModalFooter>
          <button className="download-button" onClick={onDownload}>
            💾 Download
          </button>
          <button className="copy-button" onClick={onCopy}>
            📋 Copy to Clipboard
          </button>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

import { styled } from '../theme/styles';

export const PanelWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  flex-direction: row;
  z-index: 10;
  pointer-events: none;
`;

export const ResizeHandle = styled.div`
  width: 6px;
  cursor: ew-resize;
  background: transparent;
  user-select: none;
  flex-shrink: 0;
  transition: background-color 0.15s;
  pointer-events: auto;

  &:hover {
    background-color: ${(props) => props.theme.color.gray};
  }
`;

export const PanelContainer = styled.aside`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-left: 1px solid ${(props) => props.theme.color.gray};
  background-color: ${(props) => props.theme.color.background};
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid ${(props) => props.theme.color.gray};
  flex-shrink: 0;
  user-select: none;
`;

export const PanelHeaderTitle = styled.span`
  font-size: 0.85em;
  font-weight: 600;
  color: ${(props) => props.theme.color.primaryContrast};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${(props) => props.theme.color.primaryContrast};
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    background-color: ${(props) => props.theme.color.gray};
  }
`;

export const PanelBody = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5em 0.75em;
  position: relative;
`;

export const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  color: ${(props) => props.theme.color.graylight};
  font-size: 0.85em;
  text-align: center;
  user-select: none;
`;

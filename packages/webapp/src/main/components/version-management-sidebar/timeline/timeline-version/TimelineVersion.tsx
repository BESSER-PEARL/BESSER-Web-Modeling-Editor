import React from 'react';
import styled from 'styled-components';
import { Circle, RecordCircle } from 'react-bootstrap-icons';
import { Diagram } from '../../../../services/diagram/diagramSlice';
import { VersionActions } from './VersionActions';
import { PreviewActions } from './PreviewActions';
import { useAppSelector } from '../../../store/hooks';
import { selectPreviewedDiagramIndex } from '../../../../services/version-management/versionManagementSlice';
import { selectDisplayUnpublishedVersion } from '../../../../services/diagram/diagramSlice';

const FirstVerticalLine = styled.div`
  width: 1px;
  height: 100%;
  background-color: #e6e6e6;
  position: absolute;
  margin-top: 20px;
  z-index: -1;
  top: 0;
`;

const VerticalLine = styled.div`
  width: 1px;
  height: calc(100% + 0.5em);
  background-color: #e6e6e6;
  position: absolute;
  z-index: -1;
`;

const Version = styled.div`
  position: relative;
  padding: 0.25rem 0.75rem;
  display: inline-flex;
  width: 100%;
`;

const VersionPosition = styled.div`
  flex-shrink: 0;
  border-radius: 5px;
  margin-right: 0.25rem;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  background-color: var(--apollon-background);
  color: var(--apollon-background-inverse);

  svg {
    z-index: 1;
  }
`;

const VersionInfo = styled.div`
  & {
    min-height: 23px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    align-items: start;
    justify-content: start;
    background-color: var(--apollon-background-variant);
    color: var(--apollon-background-inverse);
    border: 1px solid var(--apollon-modal-bottom-border);
    border-radius: 0.25rem;
    transition: 0.2s ease-in;
    width: 100%;
    box-sizing: border-box;
  }
`;

type Props = {
  isPreviewedVersion: boolean;
  isFirstVersion: boolean;
  isLastVersion: boolean;
  index: number;
  version?: Diagram;
  isOnlyUnpublishedVersion?: boolean;
};

export const TimelineVersion: React.FC<Props> = (props) => {
  const displayUnpublishedVersion = useAppSelector(selectDisplayUnpublishedVersion);
  const previewedDiagramIndex = useAppSelector(selectPreviewedDiagramIndex);
  const formatLastUpdated = (lastUpdated: Date) => {
    return `${lastUpdated.getMonth()}/${lastUpdated.getDate()}/${lastUpdated.getFullYear()} ${String(
      lastUpdated.getHours(),
    ).padStart(2, '0')}:${String(lastUpdated.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Version>
      <VersionPosition>
        {props.index === -1 && !props.isOnlyUnpublishedVersion && <FirstVerticalLine />}
        {!props.isLastVersion && props.index !== -1 && <VerticalLine />}
        {props.isPreviewedVersion ||
        (!displayUnpublishedVersion && previewedDiagramIndex === -1 && props.isFirstVersion) ? (
          <RecordCircle />
        ) : (
          <Circle />
        )}
      </VersionPosition>
      {props.index === -1 && (
        <VersionInfo>
          <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>Current Unpublished Version</div>
        </VersionInfo>
      )}
      {props.index !== -1 && (
        <VersionInfo>
          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{props.version!.title}</div>
          <div style={{ fontWeight: 400, fontSize: '0.8rem' }}>{props.version!.description}</div>
          <div style={{ fontWeight: 300, fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {formatLastUpdated(new Date(props.version!.lastUpdate))}
          </div>
          <VersionActions index={props.index} />
          {props.isPreviewedVersion && <PreviewActions index={props.index} />}
        </VersionInfo>
      )}
    </Version>
  );
};

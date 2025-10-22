import React from 'react';
import { LocalStorageDiagramListItem } from '../../../services/local-storage/local-storage-types';
import styled from 'styled-components';
import { useAppSelector } from '../../store/hooks';

const SubTitle = styled.span`
  display: block;
  font-size: small;
  color: #9e9e9e;
`;

type Props = {
  item: LocalStorageDiagramListItem;
};

export const LoadDiagramItem: React.FC<Props> = ({ item }) => {
  const locale = useAppSelector((state) => state.diagram.editorOptions.locale);
  return (
    <div className="d-flex justify-content-between align-items-center">
      <div className="text-truncate pr-1">
        <span>{item.title}</span>
        <SubTitle>{item.type}</SubTitle>
      </div>
      <div className="flex-shrink-0">
        <SubTitle>last updated:</SubTitle>
        <SubTitle>{new Date(item.lastUpdate).toLocaleTimeString(locale)}</SubTitle>
      </div>
    </div>
  );
};

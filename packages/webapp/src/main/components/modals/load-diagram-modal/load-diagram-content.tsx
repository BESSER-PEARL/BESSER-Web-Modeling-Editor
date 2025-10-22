import { ListGroup } from 'react-bootstrap';
import React from 'react';
import { LocalStorageDiagramListItem } from '../../../services/local-storage/local-storage-types';
import { LoadDiagramItem } from './load-diagram-item';

type Props = {
  diagrams: LocalStorageDiagramListItem[];
  onSelect: (diagramListItemId: string) => void;
};

export const LoadDiagramContent = (props: Props) => {
  if (props.diagrams && props.diagrams.length > 0) {
    return (
      <ListGroup>
        {props.diagrams.map((value        ) => (
          <ListGroup.Item key={value.id} action onClick={() => props.onSelect(value.id)}>
            <LoadDiagramItem item={value} />
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  } else {
    return <div>You do not have any diagrams stored.</div>;
  }
};

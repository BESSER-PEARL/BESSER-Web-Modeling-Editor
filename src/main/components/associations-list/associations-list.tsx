import React, { Component } from 'react';
import { styled } from '../theme/styles';
import { IUMLElement } from '../../services/uml-element/uml-element';
import { ClassRelationshipType } from '../../packages/uml-class-diagram';

const ListContainer = styled.div`
  margin-top: 20px;
  padding: 10px;
  background: white;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px 0;
`;

const Arrow = styled.span<{ isOpen: boolean }>`
  margin-right: 5px;
  font-size: 8px;
  line-height: 8px;
  transform: rotate(${props => props.isOpen ? '90deg' : '0deg'});
  transition: transform 0.2s ease;
  display: inline-block;
  &::after {
    content: '►';
  }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.theme.color.primary};
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: white;
`;

const ListItem = styled.li`
  padding: 8px 12px;
  border-bottom: 1px solid ${(props) => props.theme.color.gray};
  cursor: pointer;
  font-size: 13px;
  
  &:hover {
    background-color: ${(props) => props.theme.color.backgroundVariant};
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

interface Props {
  elements: { [key: string]: IUMLElement };
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
}

interface State {
  isOpen: boolean;
}

export class AssociationsList extends Component<Props, State> {
  state = {
    isOpen: false
  };

  toggleList = () => {
    this.setState(prevState => ({ isOpen: !prevState.isOpen }));
  };

  getAssociations() {

    const associations = Object.entries(this.props.elements).filter(([_, element]) => {
      // Check if element has type property that matches any relationship type
      const isAssociation = element.type && (
        element.type === ClassRelationshipType.ClassBidirectional ||
        element.type === ClassRelationshipType.ClassUnidirectional ||
        element.type === ClassRelationshipType.ClassComposition ||
        element.type === ClassRelationshipType.ClassInheritance ||
        element.type === ClassRelationshipType.ClassAggregation ||
        element.type === ClassRelationshipType.ClassDependency ||
        element.type === ClassRelationshipType.ClassRealization
      );
      return isAssociation;
    });
    return associations;
  }

  render() {
    const associations = this.getAssociations();
    const { isOpen } = this.state;

    return (
      <ListContainer>
        <TitleContainer onClick={this.toggleList}>
          <Arrow isOpen={isOpen} />
          <Title>Associations ({associations.length})</Title>
        </TitleContainer>
        {isOpen && (
          associations.length === 0 ? (
            <div>No associations yet</div>
          ) : (
            <List>
              {associations.map(([id, association]) => (
                <ListItem 
                  key={id}
                  onClick={() => this.props.onSelect(id)}
                  onDoubleClick={() => this.props.onDoubleClick(id)}
                >
                  {association.name || `Association ${id.slice(0, 8)}`}
                </ListItem>
              ))}
            </List>
          )
        )}
      </ListContainer>
    );
  }
}
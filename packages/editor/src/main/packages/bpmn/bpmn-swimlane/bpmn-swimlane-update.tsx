import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Switch } from '../../../components/controls/switch/switch';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Body } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { BPMNElementType } from '..';
import { IUMLContainer, UMLContainer } from '../../../services/uml-container/uml-container';
import { IBoundary } from '../../../utils/geometry/boundary';
import { memoizeOnElements } from '../../../utils/memoize-on-elements';
import { BPMNSwimlane } from './bpmn-swimlane';
import { clampTrustScore, clampMultiplicity } from '../common/types';
import { swapLanes } from '../common/swap-lanes';
import { PresetField } from '../../common/agentic/preset-field';
import { AgentDiagramLinkSection } from '../../../components/agent-diagram-linker/AgentDiagramLinkSection';

type Lane = { id: string; bounds: IBoundary };

interface OwnProps {
  element: BPMNSwimlane;
}
interface StateProps {
  prevLane: Lane | null;
  nextLane: Lane | null;
  agenticEnabled: boolean;
}
interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  swapLanes: typeof swapLanes;
}
type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const makeMapStateToProps = () => {
  // The neighbouring lanes (by y) inside the owning pool, for the move buttons.
  const selectNeighbours = memoizeOnElements(
    (elements: ModelState['elements'], { element }: OwnProps): Pick<StateProps, 'prevLane' | 'nextLane'> => {
      const none = { prevLane: null, nextLane: null };
      const owner = element.owner ? elements[element.owner] : undefined;
      if (!owner || !UMLContainer.isUMLContainer(owner)) return none;
      const sortedLanes = (owner as IUMLContainer).ownedElements
        .map((id) => elements[id])
        .filter((el) => !!el && el.type === BPMNElementType.BPMNSwimlane)
        .sort((a, b) => a.bounds.y - b.bounds.y);
      const idx = sortedLanes.findIndex((lane) => lane.id === element.id);
      if (idx === -1) return none;
      const toLane = (el: (typeof sortedLanes)[number] | undefined): Lane | null =>
        el ? { id: el.id, bounds: el.bounds } : null;
      return { prevLane: toLane(sortedLanes[idx - 1]), nextLane: toLane(sortedLanes[idx + 1]) };
    },
    ({ element }) => element.id,
  );
  return (state: ModelState, ownProps: OwnProps): StateProps => ({
    ...selectNeighbours(state.elements, ownProps),
    agenticEnabled: state.editor.agenticEnabled,
  });
};

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(makeMapStateToProps, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    swapLanes,
  }),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const FieldLabel = styled(Body)`
  width: 6em;
  flex-shrink: 0;
  margin-right: 0.5em;
`;

type State = { colorOpen: boolean };

/**
 * Lane popup: name, order, colours and, with the agentic perspective enabled,
 * the "Agentic" toggle with the agent role / trust score / copies fields and
 * the link to the lane's Agent diagram.
 */
class BPMNSwimlaneUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => this.setState((s) => ({ colorOpen: !s.colorOpen }));

  render() {
    const { element, agenticEnabled, translate } = this.props;
    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <Button color="link" tabIndex={-1} onClick={this.moveUp} disabled={this.props.prevLane === null}>
              ▲
            </Button>
            <Button color="link" tabIndex={-1} onClick={this.moveDown} disabled={this.props.nextLane === null}>
              ▼
            </Button>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
            fillColor
          />
        </section>
        {agenticEnabled && (
          <section>
            <Divider />
            <Switch value={element.isAgentic ? 'agentic' : ''} onChange={this.toggleAgentic(element.id)} color="primary">
              <Switch.Item value={'agentic'}>{translate('packages.BPMNDiagram.BPMNAgentic')}</Switch.Item>
            </Switch>
          </section>
        )}
        {agenticEnabled && element.isAgentic && (
          <>
            <section>
              <Divider />
              <Flex>
                <FieldLabel>{translate('packages.BPMNDiagram.BPMNAgentRole')}</FieldLabel>
                <Textfield
                  value={element.role}
                  onChange={this.changeRole(element.id)}
                  placeholder={translate('packages.BPMNDiagram.BPMNAgentRolePlaceholder')}
                />
              </Flex>
              <Flex>
                <FieldLabel>{translate('popup.preset')}</FieldLabel>
                <PresetField>
                  <Dropdown
                    value={element.role}
                    onChange={this.changeRole(element.id)}
                    placeholder={translate('popup.presetPlaceholder')}
                  >
                    <Dropdown.Item value={'solution'}>
                      {translate('packages.BPMNDiagram.BPMNAgentRoleSolution')}
                    </Dropdown.Item>
                    <Dropdown.Item value={'supervision'}>
                      {translate('packages.BPMNDiagram.BPMNAgentRoleSupervision')}
                    </Dropdown.Item>
                  </Dropdown>
                </PresetField>
              </Flex>
            </section>
            <section>
              <Divider />
              <Flex>
                <span>{translate('packages.BPMNDiagram.BPMNTrustScore')}</span>
                <Textfield value={String(element.trustScore)} onChange={this.changeTrustScore(element.id)} />
              </Flex>
            </section>
            <section>
              <Divider />
              <Flex>
                <span>{translate('packages.BPMNDiagram.BPMNMultiplicity')}</span>
                <Textfield value={String(element.multiplicity)} onChange={this.changeMultiplicity(element.id)} />
              </Flex>
            </section>
            <AgentDiagramLinkSection
              laneId={element.id}
              laneName={element.name}
              agentDiagramRef={element.agentDiagramRef}
            />
          </>
        )}
      </div>
    );
  }

  private moveUp = () => {
    if (this.props.prevLane) this.props.swapLanes(this.props.element, this.props.prevLane);
  };

  private moveDown = () => {
    if (this.props.nextLane) this.props.swapLanes(this.props.element, this.props.nextLane);
  };

  private rename = (id: string) => (value: string) => this.props.update(id, { name: value });

  private toggleAgentic = (id: string) => (_value: string) => {
    this.props.update<BPMNSwimlane>(id, { isAgentic: !this.props.element.isAgentic });
  };

  private changeRole = (id: string) => (value: string) => {
    this.props.update<BPMNSwimlane>(id, { role: value });
  };

  private changeTrustScore = (id: string) => (value: string) => {
    const parsed = Number.parseInt(value, 10);
    this.props.update<BPMNSwimlane>(id, { trustScore: clampTrustScore(Number.isFinite(parsed) ? parsed : 0) });
  };

  private changeMultiplicity = (id: string) => (value: string) => {
    const parsed = Number.parseInt(value, 10);
    this.props.update<BPMNSwimlane>(id, { multiplicity: clampMultiplicity(Number.isFinite(parsed) ? parsed : 1) });
  };

  private delete = (id: string) => () => this.props.delete(id);
}

export const BPMNSwimlaneUpdate = enhance(BPMNSwimlaneUpdateComponent);

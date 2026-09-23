import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AGENTIC_ELIGIBLE_GATEWAY_TYPES, BPMNGateway, BPMNGatewayType } from './bpmn-gateway';
import { BPMNFlow } from '../bpmn-flow/bpmn-flow';
import { findDownstreamAgenticConstructs, resolveUpstreamDivergingGateway } from '../bpmn-flow/bpmn-flow-validator';
import { BPMNTask } from '../bpmn-task/bpmn-task';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { Switch } from '../../../components/controls/switch/switch';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import { generateGovernanceDsl, GOV_POLICY_TYPES, GovPolicyType } from '../common/governance-dsl';
import { BPMNGatewayRole, clampTrustScore } from '../common/types';

// BPMN 2.0.2 § 8.3.13 / §§ 10.5.4 / 10.5.6: Parallel and Event-Based gateways
// cannot carry a default outgoing sequence flow.
const NO_DEFAULT_GATEWAY_TYPES: ReadonlySet<BPMNGatewayType> = new Set<BPMNGatewayType>(['parallel', 'event-based']);

// Friendly labels for the governance policy dropdown. Keyed to i18n.
const govPolicyKey = (p: GovPolicyType): string => {
  switch (p) {
    case 'MajorityPolicy':
      return 'BPMNGovPolicyMajority';
    case 'AbsoluteMajorityPolicy':
      return 'BPMNGovPolicyAbsoluteMajority';
    case 'LeaderDrivenPolicy':
      return 'BPMNGovPolicyLeaderDriven';
    case 'ConsensusPolicy':
      return 'BPMNGovPolicyConsensus';
  }
};

interface OwnProps {
  element: BPMNGateway;
}

type StateProps = {
  // IDs of outgoing default sequence flows from this gateway. Cleared by
  // `changeGatewayType` when the user switches to a type that may not carry
  // a default flow (Parallel / Event-Based per BPMN 2.0.2 § 8.3.13).
  outgoingDefaultFlowIds: string[];
  // T1/P3′: true when an upstream agentic diverging gateway exists. Gates the
  // `merging` role option (a merging gateway is only valid downstream of a
  // diverging one). Presence-only — the deleted collaborationMode is no longer
  // read. The unified map is still needed by the governance generator.
  hasUpstreamDiverging: boolean;
  elementsById: Record<string, { id: string; type: string }>;
};

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state, ownProps) => {
      const myId = ownProps.element.id;
      const outgoingDefaultFlowIds = Object.values(state.elements)
        .filter((e) => {
          const f = e as unknown as Partial<BPMNFlow>;
          if (f.flowType !== 'sequence' || f.isDefault !== true) return false;
          const r = e as unknown as { source?: { element: string } };
          return r.source?.element === myId;
        })
        .map((e) => e.id);
      const elementsById = state.elements as unknown as Record<string, { id: string; type: string }>;
      const hasUpstreamDiverging = resolveUpstreamDivergingGateway(myId, elementsById) !== undefined;
      return { outgoingDefaultFlowIds, hasUpstreamDiverging, elementsById };
    },
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
    },
  ),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

// Governance DSL editor. Mirrors the agent-diagram code-snippet UX.
// Applied few changes for better UX: max-width, scroll: 
const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  width: 100%;
  max-width: 100%;
  min-width: 200px;
  min-height: 120px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
    max-width: 100%;
    min-height: 120px;
  }

  .CodeMirror-scroll {
    max-width: 100%;
  }
`;

const GovHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

type State = { colorOpen: boolean; confirmRegenerate: boolean; govPolicyType: GovPolicyType };

class BPMNGatewayUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false, confirmRegenerate: false, govPolicyType: 'MajorityPolicy' as GovPolicyType };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <Divider />
        </section>
        <section>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
            fillColor
          />
        </section>
        <section>
          <Dropdown value={element.gatewayType} onChange={this.changeGatewayType(element.id)}>
            <Dropdown.Item value={'exclusive'}>
              {this.props.translate('packages.BPMNDiagram.BPMNExclusiveGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'parallel'}>
              {this.props.translate('packages.BPMNDiagram.BPMNParallelGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'inclusive'}>
              {this.props.translate('packages.BPMNDiagram.BPMNInclusiveGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'event-based'}>
              {this.props.translate('packages.BPMNDiagram.BPMNEventBasedGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'complex'}>
              {this.props.translate('packages.BPMNDiagram.BPMNComplexGateway')}
            </Dropdown.Item>
          </Dropdown>
        </section>
        {/* Agentic BPMN (SEAA'25 § 4.3): only Parallel + Inclusive gateways are
            eligible (Exclusive excluded; Complex / Event-Based not in the
            paper). Toggle reveals the role / trust fields. */}
        {AGENTIC_ELIGIBLE_GATEWAY_TYPES.has(element.gatewayType) && (
          <>
            <section>
              <Divider />
              <Switch
                value={element.isAgentic ? 'agentic' : ''}
                onChange={this.toggleAgentic(element.id)}
                color="primary"
              >
                <Switch.Item value={'agentic'}>{this.props.translate('packages.BPMNDiagram.BPMNAgentic')}</Switch.Item>
              </Switch>
            </section>
            {element.isAgentic && (
              <>
                <section>
                  <Divider />
                  {/* Hide the `merging` role option when no
                      upstream agentic diverging gateway exists. Prevents users
                      from creating an orphaned merging gateway. */}
                  <Dropdown value={element.gatewayRole} onChange={this.changeGatewayRole(element.id)}>
                    {[
                      <Dropdown.Item key="diverging" value={'diverging'}>
                        {this.props.translate('packages.BPMNDiagram.BPMNGatewayRoleDiverging')}
                      </Dropdown.Item>,
                      ...(this.props.hasUpstreamDiverging || element.gatewayRole === 'merging'
                        ? [
                            <Dropdown.Item key="merging" value={'merging'}>
                              {this.props.translate('packages.BPMNDiagram.BPMNGatewayRoleMerging')}
                            </Dropdown.Item>,
                          ]
                        : []),
                    ]}
                  </Dropdown>
                </section>
                <section>
                  <Divider />
                  <Flex>
                    <span>{this.props.translate('packages.BPMNDiagram.BPMNTrustScore')}</span>
                    <Textfield value={String(element.trustScore)} onChange={this.changeTrustScore(element.id)} />
                  </Flex>
                </section>
                {/* Governance DSL: merging gateways only —
                    the merge point is the governed moment (SEAA'25 § 4.3). */}
                {element.gatewayRole === 'merging' && (
                  <section>
                    <Divider />
                    <GovHeaderRow>
                      <span>{this.props.translate('packages.BPMNDiagram.BPMNGovernanceLabel')}</span>
                      {!this.state.confirmRegenerate && (
                        <Button color="link" onClick={this.startGenerateGovernance(element.id)}>
                          {this.props.translate(
                            element.governanceDsl && element.governanceDsl.trim().length > 0
                              ? 'packages.BPMNDiagram.BPMNGovernanceRegenerate'
                              : 'packages.BPMNDiagram.BPMNGovernanceGenerate',
                          )}
                        </Button>
                      )}
                    </GovHeaderRow>
                    {/* Pick the governance policy to seed; Generate writes the skeleton. */}
                    <Flex>
                      <span>{this.props.translate('packages.BPMNDiagram.BPMNGovernancePolicyTypeLabel')}</span>
                      <Dropdown value={this.state.govPolicyType} onChange={this.changeGovPolicyType}>
                        {GOV_POLICY_TYPES.map((p) => (
                          <Dropdown.Item key={p} value={p}>
                            {this.props.translate(`packages.BPMNDiagram.${govPolicyKey(p)}`)}
                          </Dropdown.Item>
                        ))}
                      </Dropdown>
                    </Flex>
                    {this.state.confirmRegenerate && (
                      <GovHeaderRow>
                        <span>{this.props.translate('packages.BPMNDiagram.BPMNGovernanceOverwriteConfirm')}</span>
                        <span>
                          <Button color="link" onClick={this.confirmGenerateGovernance(element.id)}>
                            {this.props.translate('packages.BPMNDiagram.BPMNGovernanceReplace')}
                          </Button>
                          <Button color="link" onClick={this.cancelGenerateGovernance}>
                            {this.props.translate('packages.BPMNDiagram.BPMNGovernanceCancel')}
                          </Button>
                        </span>
                      </GovHeaderRow>
                    )}
                    <ResizableCodeMirrorWrapper>
                      <CodeMirror
                        value={element.governanceDsl ?? ''}
                        options={{
                          mode: null,
                          theme: 'material',
                          lineNumbers: true,
                          tabSize: 4,
                        }}
                        onBeforeChange={this.changeGovernanceDsl(element.id)}
                      />
                    </ResizableCodeMirrorWrapper>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  /**
   * Rename the gateway
   * @param id The ID of the gateway that should be renamed
   */
  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  /**
   * Change the type of the gateway. If the new type cannot carry a default
   * flow (Parallel / Event-Based per BPMN 2.0.2 § 8.3.13), clear `isDefault`
   * on every outgoing sequence flow first. If the new type is not agentic-
   * eligible (Exclusive / Complex / Event-Based), clear `isAgentic`.
   *
   * When this is an agentic diverging gateway and the new type stays
   * agentic-eligible (parallel ↔ inclusive), forward-propagate the type to
   * every downstream agentic merging gateway in the same collaboration block —
   * the diverging and merging halves must agree per SEAA'25 § 4.3.
   * @param id The ID of the gateway whose type should be changed
   */
  private changeGatewayType = (id: string) => (value: string) => {
    const newType = value as BPMNGatewayType;
    if (NO_DEFAULT_GATEWAY_TYPES.has(newType)) {
      for (const flowId of this.props.outgoingDefaultFlowIds) {
        this.props.update<BPMNFlow>(flowId, { isDefault: false });
      }
    }
    const patch: Partial<BPMNGateway> = { gatewayType: newType };
    if (!AGENTIC_ELIGIBLE_GATEWAY_TYPES.has(newType) && this.props.element.isAgentic) {
      patch.isAgentic = false;
    }
    this.props.update<BPMNGateway>(id, patch);
    if (
      this.props.element.isAgentic &&
      this.props.element.gatewayRole === 'diverging' &&
      AGENTIC_ELIGIBLE_GATEWAY_TYPES.has(newType)
    ) {
      const { mergingGatewayIds } = findDownstreamAgenticConstructs(id, this.props.elementsById);
      for (const gwId of mergingGatewayIds) {
        this.props.update<BPMNGateway>(gwId, { gatewayType: newType });
      }
    }
  };

  /**
   * Toggle whether the gateway is agentic.
   */
  private toggleAgentic = (id: string) => (_value: string) => {
    this.props.update<BPMNGateway>(id, { isAgentic: !this.props.element.isAgentic });
  };

  /**
   * Change the gateway role (diverging / merging).
   */
  private changeGatewayRole = (id: string) => (value: string) => {
    this.props.update<BPMNGateway>(id, { gatewayRole: value as BPMNGatewayRole });
  };

  /**
   * Change the trust score, clamped to 0–100.
   */
  private changeTrustScore = (id: string) => (value: string) => {
    const parsed = Number.parseInt(value, 10);
    this.props.update<BPMNGateway>(id, { trustScore: clampTrustScore(Number.isFinite(parsed) ? parsed : 0) });
  };

  /**
   * Persist a manual edit to the governance DSL (free-text).
   * CodeMirror's onBeforeChange passes (editor, data, value).
   */
  private changeGovernanceDsl = (id: string) => (_editor: unknown, _data: unknown, value: string) => {
    this.props.update<BPMNGateway>(id, { governanceDsl: value });
  };

  /**
   * Generate (or Regenerate) the governance DSL from the collaboration block.
   * Generate-once: when a non-empty DSL already exists, switch the header row
   * to an in-popup Replace/Cancel confirm (no browser dialog) instead of
   * overwriting straight away (the field is meant to be hand-edited).
   */
  private startGenerateGovernance = (id: string) => () => {
    const existing = this.props.element.governanceDsl;
    if (existing && existing.trim().length > 0) {
      this.setState({ confirmRegenerate: true });
      return;
    }
    this.writeGeneratedGovernance(id);
  };

  /** Confirm the in-popup Regenerate overwrite. */
  private confirmGenerateGovernance = (id: string) => () => {
    this.writeGeneratedGovernance(id);
    this.setState({ confirmRegenerate: false });
  };

  /** Dismiss the in-popup Regenerate confirm without overwriting. */
  private cancelGenerateGovernance = () => {
    this.setState({ confirmRegenerate: false });
  };

  private changeGovPolicyType = (value: string) => {
    this.setState({ govPolicyType: value as GovPolicyType });
  };

  private writeGeneratedGovernance = (id: string) => {
    const dsl = generateGovernanceDsl(
      id,
      this.props.elementsById as unknown as Record<string, never>,
      this.state.govPolicyType,
    );
    this.props.update<BPMNGateway>(id, { governanceDsl: dsl });
  };

  /**
   * Delete a gateway
   * @param id The ID of the gateway that should be deleted
   */
  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const BPMNGatewayUpdate = enhance(BPMNGatewayUpdateComponent);

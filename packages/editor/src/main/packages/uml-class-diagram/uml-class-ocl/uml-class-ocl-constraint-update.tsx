import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { ClassRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import {
  ClassOCLConstraint,
  IUMLClassOCLConstraint,
  OCLConstraintKind,
} from './uml-class-ocl-constraint';

const Flex = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Label = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => props.theme.color.graylight};
  text-transform: uppercase;
  letter-spacing: 0.3px;
  min-width: 56px;
`;

const Notice = styled.div<{ $variant?: 'info' | 'warning' }>`
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 3px;
  background-color: ${(props) =>
    props.$variant === 'warning'
      ? `${props.theme.color.gray}55`
      : `${props.theme.color.gray}33`};
  color: ${(props) => props.theme.color.graylight};
`;

const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
`;

const StyledTextarea = styled.textarea`
  font-family: inherit;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: both;
  min-width: 200px;
  min-height: 100px;
  height: 150px;
  line-height: 1.4;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  padding: 8px;
`;

type State = { colorOpen: boolean };

const KIND_OPTIONS: { value: OCLConstraintKind; label: string }[] = [
  { value: 'invariant', label: 'Invariant' },
  { value: 'precondition', label: 'Precondition' },
  { value: 'postcondition', label: 'Postcondition' },
];

interface MethodOption {
  id: string;
  label: string;
}

class ClassOCLConstraintUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((s) => ({ colorOpen: !s.colorOpen }));
  };

  render() {
    const { element, linkedClassName, methodOptions, targetMethodMissing, translate } = this.props;
    const isContract = element.kind && element.kind !== 'invariant';
    const showMethodNotice = isContract && !linkedClassName;
    const showOrphanNotice = isContract && !!element.targetMethodId && targetMethodMissing;

    return (
      <div>
        <section>
          <Flex>
            <StyledTextarea
              value={element.constraint || ''}
              placeholder={translate('packages.OCLConstraint.Constraint')}
              onChange={(e) => this.onConstraintChange(e.target.value)}
              autoFocus
            />

            <Row>
              <Label>Name</Label>
              <Textfield
                value={element.constraintName || ''}
                onChange={this.onNameChange}
                placeholder="auto-generated if empty"
              />
            </Row>

            <Row>
              <Label>Kind</Label>
              <Dropdown value={element.kind || 'invariant'} onChange={this.onKindChange}>
                {KIND_OPTIONS.map((opt) => (
                  <Dropdown.Item key={opt.value} value={opt.value}>
                    {opt.label}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            </Row>

            {isContract && (
              <Row>
                <Label>Method</Label>
                {linkedClassName && methodOptions.length > 0 ? (
                  <Dropdown
                    value={element.targetMethodId || ''}
                    onChange={this.onTargetMethodChange}
                  >
                    {[
                      <Dropdown.Item key="__placeholder__" value="">
                        -- Select method --
                      </Dropdown.Item>,
                      ...methodOptions.map((m) => (
                        <Dropdown.Item key={m.id} value={m.id}>
                          {m.label}
                        </Dropdown.Item>
                      )),
                    ]}
                  </Dropdown>
                ) : (
                  <Notice $variant="info">
                    {linkedClassName
                      ? `Class "${linkedClassName}" has no methods yet.`
                      : 'Link this constraint to a class first.'}
                  </Notice>
                )}
              </Row>
            )}

            {showOrphanNotice && (
              <Notice $variant="warning">
                The previously selected method no longer exists. Pick another or switch back to Invariant.
              </Notice>
            )}

            {showMethodNotice && !showOrphanNotice && (
              <Notice $variant="warning">
                Draw an OCL link to a class to enable {element.kind} authoring.
              </Notice>
            )}

            <ButtonRow>
              <ColorButton onClick={this.toggleColor} />
              <Button color="link" tabIndex={-1} onClick={() => this.props.delete(element.id)}>
                <TrashIcon />
              </Button>
            </ButtonRow>
          </Flex>
        </section>
        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          lineColor
          textColor
          fillColor
        />
      </div>
    );
  }

  private onConstraintChange = (constraint: string) => {
    const { element, update } = this.props;
    update(element.id, {
      constraint,
      bounds: { ...element.bounds },
    } as Partial<IUMLClassOCLConstraint>);
  };

  private onNameChange = (value: string | number) => {
    const constraintName = String(value || '').trim() || undefined;
    this.props.update(this.props.element.id, { constraintName } as Partial<IUMLClassOCLConstraint>);
  };

  private onKindChange = (value: unknown) => {
    const kind = value as OCLConstraintKind;
    const patch: Partial<IUMLClassOCLConstraint> = { kind };
    // Switching to invariant clears any method binding so we don't leave
    // stale targetMethodId values floating around. Switching between pre
    // and post leaves the method choice alone.
    if (kind === 'invariant') {
      patch.targetMethodId = undefined;
    }
    this.props.update(this.props.element.id, patch);
  };

  private onTargetMethodChange = (value: unknown) => {
    const targetMethodId = (value as string) || undefined;
    this.props.update(this.props.element.id, {
      targetMethodId,
    } as Partial<IUMLClassOCLConstraint>);
  };
}

type OwnProps = {
  element: ClassOCLConstraint;
};

type StateProps = {
  linkedClassName?: string;
  methodOptions: MethodOption[];
  targetMethodMissing: boolean;
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: AsyncDispatch<typeof UMLElementRepository.delete>;
};

export type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const mapStateToProps = (state: ModelState, ownProps: OwnProps): StateProps => {
  const elements = state.elements as Record<string, any>;
  // Walk every relationship-shaped entry to find the ClassOCLLink that
  // connects this OCL box to a class. Source/target ordering depends on
  // which way the user drew the line, so check both.
  let linkedClassId: string | undefined;
  for (const entry of Object.values(elements)) {
    if (!entry || entry.type !== ClassRelationshipType.ClassOCLLink) continue;
    const sourceId: string | undefined = entry.source?.element;
    const targetId: string | undefined = entry.target?.element;
    if (!sourceId || !targetId) continue;
    if (sourceId === ownProps.element.id) {
      linkedClassId = targetId;
      break;
    }
    if (targetId === ownProps.element.id) {
      linkedClassId = sourceId;
      break;
    }
  }

  let linkedClassName: string | undefined;
  const methodOptions: MethodOption[] = [];
  if (linkedClassId) {
    const cls = elements[linkedClassId];
    if (cls && (cls.type === UMLElementType.Class || cls.type === UMLElementType.AbstractClass)) {
      linkedClassName = cls.name;
      // In the editor's in-memory state, classes expose their attribute and
      // method children via `ownedElements` (the `methods` field only exists
      // in the serialized JSON form). Walk owned elements and keep the ones
      // whose type is ClassMethod.
      const ownedIds: string[] = (cls as any).ownedElements || [];
      for (const oid of ownedIds) {
        const m = elements[oid];
        if (m && m.type === UMLElementType.ClassMethod) {
          methodOptions.push({ id: oid, label: m.name || oid });
        }
      }
    }
  }

  // Orphan detection: a non-invariant constraint references a method id
  // that the current diagram no longer has.
  const targetMethodId = ownProps.element.targetMethodId;
  const targetMethodMissing = !!targetMethodId
    && (!elements[targetMethodId] || elements[targetMethodId]?.type !== UMLElementType.ClassMethod);

  return { linkedClassName, methodOptions, targetMethodMissing };
};

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(mapStateToProps, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
  }),
);

export const ClassOCLConstraintUpdate = enhance(ClassOCLConstraintUpdateComponent);

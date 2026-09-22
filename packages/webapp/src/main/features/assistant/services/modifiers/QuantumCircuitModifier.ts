/**
 * Quantum Circuit Modifier
 * Handles modification operations for Quantum Circuit Diagrams.
 *
 * Supported actions:
 *  - add_gate        — insert a gate at a qubit / column position
 *  - remove_element  — remove a gate or wire element
 *  - modify_gate     — change gate type, params, or qubit mapping
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const SUPPORTED_ACTIONS = ['add_gate', 'remove_element', 'modify_gate'] as const;

export class QuantumCircuitModifier implements DiagramModifier {
  getDiagramType() {
    return 'QuantumCircuitDiagram' as const;
  }

  canHandle(action: string): boolean {
    return (SUPPORTED_ACTIONS as readonly string[]).includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_gate' as any:
        return this.addGate(updatedModel, modification);
      case 'modify_gate' as any:
        return this.modifyGate(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for QuantumCircuitDiagram: ${modification.action}`);
    }
  }

  private addGate(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as any;
    const gateId = ModifierHelpers.generateUniqueId('qgate');

    model.elements[gateId] = {
      id: gateId,
      name: changes.name || 'H',
      type: 'QuantumGate',
      owner: null,
      bounds: {
        x: changes.column != null ? 80 + changes.column * 90 : 80,
        y: changes.qubit != null ? 60 + changes.qubit * 80 - 20 : 60,
        width: 60,
        height: 60,
      },
      qubits: changes.qubits ?? [changes.qubit ?? 0],
      params: changes.params ?? {},
    };

    return model;
  }

  private modifyGate(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target as any;
    const targetId =
      target.gateId ??
      target.stateId ??
      ModifierHelpers.findElementByName(model, target.stateName ?? target.gateName ?? '', 'QuantumGate');

    if (targetId && model.elements[targetId]) {
      const el = model.elements[targetId];
      if (modification.changes.name) el.name = modification.changes.name;
      if ((modification.changes as any).params) el.params = (modification.changes as any).params;
      if ((modification.changes as any).qubits) el.qubits = (modification.changes as any).qubits;
    }

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target as any;
    const targetId =
      target.gateId ??
      target.stateId ??
      ModifierHelpers.findElementByName(model, target.stateName ?? target.gateName ?? '', 'QuantumGate');

    if (targetId) {
      return ModifierHelpers.removeElementWithChildren(model, targetId);
    }
    return model;
  }
}

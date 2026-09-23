import { describe, it, expect } from 'vitest';
import { UMLComponentComponent } from '../../../../../../editor/src/main/packages/uml-component-diagram/uml-component/uml-component-component';
import { UMLDeploymentComponent } from '../../../../../../editor/src/main/packages/uml-deployment-diagram/uml-deployment-component/uml-component';
import { UMLDeploymentArtifact } from '../../../../../../editor/src/main/packages/uml-deployment-diagram/uml-deployment-artifact/uml-deployment-artifact';

/**
 * Regression guard for Component and Deployment stereotype serialization.
 *
 * Before Phase A, UMLComponentComponent.serialize() and
 * UMLDeploymentComponent.serialize() emitted only `displayStereotype`
 * and silently dropped `stereotype`. These tests fail if that
 * round-trip ever regresses.
 */
describe('Phase A — Component/Deployment stereotype survives serialize round-trip', () => {
  it('UMLComponentComponent.serialize() emits the stereotype', () => {
    const component = new UMLComponentComponent({
      name: 'Planner',
      stereotype: 'solution',
      displayStereotype: true,
    });

    const serialized = component.serialize();

    expect(serialized.stereotype).toBe('solution');
    expect(serialized.displayStereotype).toBe(true);
  });

  it('UMLComponentComponent.deserialize() restores the stereotype', () => {
    const original = new UMLComponentComponent({
      name: 'Planner',
      stereotype: 'solution',
      displayStereotype: true,
    });

    const restored = new UMLComponentComponent();
    restored.deserialize(original.serialize());

    expect(restored.stereotype).toBe('solution');
    expect(restored.displayStereotype).toBe(true);
  });

  it('UMLDeploymentComponent.serialize() emits the stereotype', () => {
    const component = new UMLDeploymentComponent({
      name: 'EdgeRuntime',
      stereotype: 'local',
      displayStereotype: true,
    });

    const serialized = component.serialize();

    expect(serialized.stereotype).toBe('local');
    expect(serialized.displayStereotype).toBe(true);
  });

  it('UMLDeploymentComponent.deserialize() restores the stereotype', () => {
    const original = new UMLDeploymentComponent({
      name: 'EdgeRuntime',
      stereotype: 'local',
      displayStereotype: true,
    });

    const restored = new UMLDeploymentComponent();
    restored.deserialize(original.serialize());

    expect(restored.stereotype).toBe('local');
    expect(restored.displayStereotype).toBe(true);
  });

  it('a full serialize → deserialize cycle preserves whatever the default stereotype is', () => {
    // Guards against a regression where the default stereotype value
    // ('component') is dropped when the user never edits the field.
    const original = new UMLComponentComponent({ name: 'Plain' });
    const restored = new UMLComponentComponent();
    restored.deserialize(original.serialize());

    expect(restored.stereotype).toBe(original.stereotype);
  });
});

describe('20 — Deployment Artifact manifests survives serialize round-trip', () => {
  it('UMLDeploymentArtifact.serialize() emits manifests', () => {
    const artifact = new UMLDeploymentArtifact({ name: 'OrderAgent' });
    artifact.manifests = ['cmp-1', 'cmp-2'];

    const serialized = artifact.serialize();

    expect(serialized.manifests).toEqual(['cmp-1', 'cmp-2']);
  });

  it('UMLDeploymentArtifact.deserialize() restores manifests', () => {
    const original = new UMLDeploymentArtifact({ name: 'OrderAgent' });
    original.manifests = ['cmp-1', 'cmp-2'];

    const restored = new UMLDeploymentArtifact();
    restored.deserialize(original.serialize());

    expect(restored.manifests).toEqual(['cmp-1', 'cmp-2']);
  });

  it('UMLDeploymentArtifact.deserialize() defaults manifests to [] when the key is absent (legacy back-compat)', () => {
    const artifact = new UMLDeploymentArtifact();
    // Simulate a serialized Artifact from before manifests were stored.
    artifact.deserialize({ id: 'a1', name: 'X', type: 'DeploymentArtifact' } as never);

    expect(artifact.manifests).toEqual([]);
  });
});

describe('21 — Component processModelRefs survives serialize round-trip', () => {
  it('UMLComponentComponent.serialize() emits processModelRefs', () => {
    const component = new UMLComponentComponent({ name: 'Planner', stereotype: 'solution' });
    component.processModelRefs = ['bpmn-1', 'bpmn-2'];

    const serialized = component.serialize();

    expect(serialized.processModelRefs).toEqual(['bpmn-1', 'bpmn-2']);
  });

  it('UMLComponentComponent.deserialize() restores processModelRefs', () => {
    const original = new UMLComponentComponent({ name: 'Planner', stereotype: 'solution' });
    original.processModelRefs = ['bpmn-1', 'bpmn-2'];

    const restored = new UMLComponentComponent();
    restored.deserialize(original.serialize());

    expect(restored.processModelRefs).toEqual(['bpmn-1', 'bpmn-2']);
  });

  it('UMLComponentComponent.deserialize() defaults processModelRefs to [] when the key is absent (legacy back-compat)', () => {
    const component = new UMLComponentComponent();
    // Simulate a serialized Component from before processModelRefs were stored.
    component.deserialize({ id: 'c1', name: 'X', type: 'Component', stereotype: 'component' } as never);

    expect(component.processModelRefs).toEqual([]);
  });
});

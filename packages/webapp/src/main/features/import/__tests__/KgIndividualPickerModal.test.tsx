/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// i18n is not initialised in unit tests; render the key so assertions can
// target stable identifiers rather than English copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

import { KgIndividualPickerModal } from '../KgIndividualPickerModal';

const model = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'Person', nodeType: 'class', label: 'Person', iri: 'http://ex.org/Person' },
    { id: 'alice', nodeType: 'individual', label: 'Alice', iri: 'http://ex.org/alice' },
    { id: 'bob', nodeType: 'individual', label: 'Bob', iri: 'http://ex.org/bob' },
    { id: 'lit', nodeType: 'literal', label: '30', value: '30' },
  ],
  edges: [],
} as any;

describe('KgIndividualPickerModal', () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  const renderModal = (override: Partial<React.ComponentProps<typeof KgIndividualPickerModal>> = {}) =>
    render(
      <KgIndividualPickerModal
        open
        model={model}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...override}
      />,
    );

  it('lists only individuals, not classes or literals', () => {
    renderModal();
    expect(screen.getByTestId('kg-individual-picker-option-alice')).toBeTruthy();
    expect(screen.getByTestId('kg-individual-picker-option-bob')).toBeTruthy();
    expect(screen.queryByTestId('kg-individual-picker-option-Person')).toBeNull();
    expect(screen.queryByTestId('kg-individual-picker-option-lit')).toBeNull();
  });

  it('filters on label and on IRI', () => {
    renderModal();
    const filter = screen.getByTestId('kg-individual-picker-filter');

    fireEvent.change(filter, { target: { value: 'ali' } });
    expect(screen.getByTestId('kg-individual-picker-option-alice')).toBeTruthy();
    expect(screen.queryByTestId('kg-individual-picker-option-bob')).toBeNull();

    fireEvent.change(filter, { target: { value: 'ex.org/bob' } });
    expect(screen.getByTestId('kg-individual-picker-option-bob')).toBeTruthy();
    expect(screen.queryByTestId('kg-individual-picker-option-alice')).toBeNull();
  });

  it('cannot confirm until an individual is selected', () => {
    renderModal();
    const confirm = screen.getByTestId('kg-individual-picker-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('kg-individual-picker-option-alice'));
    expect(confirm.disabled).toBe(false);
  });

  it('confirms with the selected id and the full-component default depth', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('kg-individual-picker-option-bob'));
    fireEvent.click(screen.getByTestId('kg-individual-picker-confirm'));

    // maxDepth null is the backend's "full connected component".
    expect(onConfirm).toHaveBeenCalledWith({ rootIndividualIds: ['bob'], maxDepth: null });
  });

  it('sends the chosen depth', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('kg-individual-picker-option-alice'));
    fireEvent.click(screen.getByTestId('kg-individual-picker-depth-1'));
    fireEvent.click(screen.getByTestId('kg-individual-picker-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ rootIndividualIds: ['alice'], maxDepth: 1 });
  });

  it('offers no conversion when the graph has no individuals', () => {
    // A TBox-only ontology has nothing for an object diagram to show.
    renderModal({ model: { ...model, nodes: [model.nodes[0]] } });
    expect(screen.queryByTestId('kg-individual-picker-confirm')).toBeNull();
    expect(screen.getByText('import.kg.individualPicker.emptyDescription')).toBeTruthy();
  });

  it('cancels without confirming', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('kg-individual-picker-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

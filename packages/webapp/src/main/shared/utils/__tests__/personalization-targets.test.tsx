import React, { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PersonalizationEditor } from '../../../../../../editor/src/main/packages/user-modeling/personalization/PersonalizationEditor';
import {
  isPersonalizationSpecEmpty,
  type UserPersonalizationSpec,
} from '../../../../../../editor/src/main/packages/user-modeling/personalization-spec';
import { aggregateProfilePersonalization } from '../personalization-aggregation';
import { UMLUserModelName } from '../../../../../../editor/src/main/packages/user-modeling/uml-user-model-name/uml-user-model-name';

function ProfileEditor({ initial }: { initial: UserPersonalizationSpec }) {
  const [spec, setSpec] = useState<UserPersonalizationSpec | undefined>(initial);
  return (
    <ThemeProvider theme={{ color: { graylight: '#cccccc' } }}>
      <PersonalizationEditor value={spec} onChange={setSpec} defaultOpen />
      <output data-testid="stored-spec">{JSON.stringify(spec) ?? 'unset'}</output>
    </ThemeProvider>
  );
}

describe('independent agent and GUI personalization', () => {
  it('keeps GUI read-aloud independent of agent speech output and presentation edits', () => {
    render(<ProfileEditor initial={{ modality: { outputModalities: ['text'] } }} />);
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));
    fireEvent.click(gui.getByLabelText('Read text aloud'));
    fireEvent.change(gui.getByLabelText('Language'), { target: { value: 'french' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({
      modality: { outputModalities: ['text'] }, gui: { modality: { readAloud: true }, presentation: { language: 'french' } },
    });
  });

  it('stores summaries as a GUI-only content rule and clears the last rule', () => {
    render(<ProfileEditor initial={{}} />);
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));
    const checkbox = gui.getByLabelText('Summarize long content');
    fireEvent.click(checkbox);
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({ gui: { content: { summarizeLongContent: true } } });
    fireEvent.change(gui.getByLabelText('Language'), { target: { value: 'french' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!).gui.content.summarizeLongContent).toBe(true);
    fireEvent.change(gui.getByLabelText('Language'), { target: { value: 'original' } });
    fireEvent.click(checkbox);
    expect(screen.getByTestId('stored-spec')).toHaveTextContent('unset');
  });

  it('stores GUI content independently and preserves it when changing presentation', () => {
    render(<ProfileEditor initial={{ content: { adaptContentToUserProfile: true } }} />);
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));
    const checkbox = gui.getByLabelText('Adapt content to this user profile');
    fireEvent.click(checkbox);
    fireEvent.change(gui.getByLabelText('Language'), { target: { value: 'french' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({
      content: { adaptContentToUserProfile: true },
      gui: { content: { adaptContentToUserProfile: true }, presentation: { language: 'french' } },
    });
    fireEvent.click(checkbox);
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({
      content: { adaptContentToUserProfile: true }, gui: { presentation: { language: 'french' } },
    });
    expect(isPersonalizationSpecEmpty({ gui: { content: { adaptContentToUserProfile: true } } })).toBe(false);
  });

  it('shares sentence-length choices while keeping agent and GUI rules independent', () => {
    render(<ProfileEditor initial={{ presentation: { sentenceLength: 'verbose' } }} />);
    const agent = within(screen.getByRole('region', { name: 'Agent personalization' })).getByLabelText('Sentence length');
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' })).getByLabelText('Sentence length');
    const options = (select: HTMLElement) => within(select).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(options(gui)).toEqual(options(agent));
    expect(options(gui)).toEqual(['original', 'concise', 'verbose']);
    fireEvent.change(gui, { target: { value: 'concise' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({
      presentation: { sentenceLength: 'verbose' }, gui: { presentation: { sentenceLength: 'concise' } },
    });
    fireEvent.change(gui, { target: { value: 'original' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({ presentation: { sentenceLength: 'verbose' } });
  });

  it('offers the same languages for both targets and keeps their selections independent', () => {
    render(<ProfileEditor initial={{ presentation: { language: 'english' } }} />);
    const agent = within(screen.getByRole('region', { name: 'Agent personalization' })).getByLabelText('Language');
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' })).getByLabelText('Language');
    const choices = (select: HTMLElement) => within(select).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(choices(gui)).toEqual(choices(agent));
    expect(choices(gui)).toEqual(['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian']);
    fireEvent.change(gui, { target: { value: 'french' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({
      presentation: { language: 'english' }, gui: { presentation: { language: 'french' } },
    });
    fireEvent.change(gui, { target: { value: 'original' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toEqual({ presentation: { language: 'english' } });
  });

  it('stores Simple text as an independent GUI rule and clears it with Original', () => {
    render(<ProfileEditor initial={{ presentation: { languageComplexity: 'complex' } }} />);
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));
    fireEvent.change(gui.getByLabelText('Text complexity'), { target: { value: 'simple' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toMatchObject({
      presentation: { languageComplexity: 'complex' }, gui: { presentation: { languageComplexity: 'simple' } },
    });
    fireEvent.change(gui.getByLabelText('Text complexity'), { target: { value: 'original' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!).gui).toBeUndefined();
  });

  it('loads existing custom values and saves presets as numbers, with Original clearing only that setting', () => {
    render(<ProfileEditor initial={{ presentation: { size: 20 }, gui: { presentation: { size: 22, lineSpacing: 1.7 } } }} />);
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));
    expect(gui.getByLabelText('Custom font size')).toHaveValue(22);
    expect(gui.getByLabelText('Custom line spacing')).toHaveValue(1.7);
    fireEvent.change(gui.getByLabelText('Font size'), { target: { value: '24' } });
    fireEvent.change(gui.getByLabelText('Line spacing'), { target: { value: '1.5' } });
    expect(gui.getByLabelText('Font size')).toHaveDisplayValue('Large (24px)');
    expect(gui.queryByLabelText('Custom font size')).toBeNull();
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toMatchObject({ gui: { presentation: { size: 24, lineSpacing: 1.5 } } });
    fireEvent.change(gui.getByLabelText('Font size'), { target: { value: 'custom' } });
    fireEvent.change(gui.getByLabelText('Custom font size'), { target: { value: '29' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!).gui.presentation.size).toBe(29);
    fireEvent.change(gui.getByLabelText('Font size'), { target: { value: '' } });
    expect(gui.getByLabelText('Font size')).toHaveDisplayValue('Original');
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toMatchObject({ presentation: { size: 20 }, gui: { presentation: { lineSpacing: 1.5 } } });
  });

  it('preserves both targets when saving and reloading a profile element', () => {
    const spec: UserPersonalizationSpec = {
      presentation: { size: 16 },
      gui: { presentation: { size: 24, font: 'serif', lineSpacing: 1.8, alignment: 'left', color: '#000000', contrast: 'high' }, content: { adaptContentToUserProfile: true } },
    };
    const element = new UMLUserModelName({ className: 'User', personalization: spec });
    const saved = JSON.parse(JSON.stringify(element.serialize()));
    expect(new UMLUserModelName(saved).serialize().personalization).toEqual(spec);
  });

  it('edits either target without overwriting the other target', () => {
    render(<ProfileEditor initial={{ presentation: { size: 16 }, gui: { presentation: { size: 24 } } }} />);
    const agent = within(screen.getByRole('region', { name: 'Agent personalization' }));
    const gui = within(screen.getByRole('region', { name: 'GUI personalization' }));

    fireEvent.change(gui.getByLabelText('Font size'), { target: { value: 'custom' } });
    fireEvent.change(gui.getByLabelText('Custom font size'), { target: { value: '28' } });
    expect(agent.getByLabelText('Custom font size')).toHaveValue(16);
    fireEvent.change(agent.getByLabelText('Font'), { target: { value: 'serif' } });
    expect(JSON.parse(screen.getByTestId('stored-spec').textContent!)).toMatchObject({
      presentation: { size: 16, font: 'serif' },
      gui: { presentation: { size: 28 } },
    });

    fireEvent.change(gui.getByLabelText('Font size'), { target: { value: '' } });
    const stored = JSON.parse(screen.getByTestId('stored-spec').textContent!);
    expect(stored.gui).toBeUndefined();
    expect(stored.presentation).toEqual({ size: 16, font: 'serif' });
  });

  it('keeps GUI text styling available when agent recommendations hide interface fields', () => {
    render(<PersonalizationEditor onChange={() => {}} defaultOpen suggestedFields={['presentation.language']} />);
    expect(within(screen.getByRole('region', { name: 'Agent personalization' })).queryByLabelText('Font size')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'GUI personalization' })).getByLabelText('Font size')).toBeInTheDocument();
  });

  it('recognizes GUI-only rules as active and clears the last rule', () => {
    expect(isPersonalizationSpecEmpty({ gui: { presentation: {} } })).toBe(true);
    expect(isPersonalizationSpecEmpty({ gui: { presentation: { size: 24 } } })).toBe(false);
    render(<ProfileEditor initial={{ gui: { presentation: { size: 24 } } }} />);
    fireEvent.change(within(screen.getByRole('region', { name: 'GUI personalization' })).getByLabelText('Font size'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('stored-spec')).toHaveTextContent('unset');
  });

  it('never applies GUI text styling to agent generation', () => {
    const model = {
      type: 'UserDiagram',
      elements: {
        user: {
          type: 'UserModelName', className: 'User', attributes: [],
          personalization: { presentation: { size: 16 }, gui: { presentation: { size: 28, color: '#ff0000' }, content: { adaptContentToUserProfile: true } } },
        },
      },
    };
    expect(aggregateProfilePersonalization(model as any).configuration).toEqual({ interfaceStyle: { size: 16 } });
    delete (model.elements.user.personalization as any).presentation;
    expect(aggregateProfilePersonalization(model as any).configuration).toEqual({});
  });
});

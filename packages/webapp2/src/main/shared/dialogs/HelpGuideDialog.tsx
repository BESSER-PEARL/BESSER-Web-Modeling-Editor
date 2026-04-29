import React, { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { besserWMERepositoryLink } from '../constants/application-constants';

type GuideSectionId = 'class' | 'object' | 'state' | 'agent' | 'gui' | 'quantum' | 'nn';

interface GuideDetail {
  title: string;
  body: ReactNode;
  image?: {
    src: string;
    alt: string;
    heightClass?: string;
  };
}

interface GuideSection {
  id: GuideSectionId;
  label: string;
  summary: string;
  details: GuideDetail[];
}

interface HelpGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sharedLinkClass = 'font-medium text-brand underline-offset-4 hover:underline';
const DOCS_URL = 'https://besser.readthedocs.io/en/latest/';
const USER_STUDY_PDF_URL = '/Low_code_CA_personalization_study_instructions.pdf';

const sections: GuideSection[] = [
  {
    id: 'class',
    label: 'Class Diagram',
    summary: 'Model classes, relationships, constraints, and advanced UML structures.',
    details: [
      {
        title: 'Add Class',
        body: (
          <p>
            Drag and drop a class shape from the left palette onto the modeling canvas.
          </p>
        ),
        image: {
          src: '/images/help/help-create-element.png',
          alt: 'Create class element',
        },
      },
      {
        title: 'Add Association Or Generalization',
        body: (
          <p>
            Select a source class, then drag from a blue connection point to another class.
            For multiplicities, use values like <code>1</code>, <code>0..1</code>, <code>0..*</code>, <code>1..*</code>, or <code>2..4</code>.
          </p>
        ),
        image: {
          src: '/images/help/help-create-relationship.jpg',
          alt: 'Create class relationship',
        },
      },
      {
        title: 'Edit Class',
        body: (
          <div className="space-y-2">
            <p>
              Double-click a class to edit its name, attributes, and methods.
            </p>
            <p>
              Attribute format examples: <code>+ attribute : type</code>, <code>+ attribute</code>, <code>attribute</code>.
              Primitive types include <code>int</code>, <code>float</code>, <code>str</code>, <code>bool</code>, <code>time</code>, <code>date</code>, <code>datetime</code>, <code>timedelta</code>, and <code>any</code>.
            </p>
            <p>
              Visibility: <code>+</code> public, <code>-</code> private, <code>#</code> protected.
              Method examples: <code>+ notify(sms: str = 'message')</code>, <code>- findBook(title: str): Book</code>, <code>validate()</code>.
            </p>
          </div>
        ),
        image: {
          src: '/images/help/help-update-element.jpg',
          alt: 'Edit class element',
        },
      },
      {
        title: 'Edit Association Or Generalization',
        body: (
          <p>
            Double-click a relationship to edit type (unidirectional, bidirectional, composition, generalization),
            name, source/target role names, and multiplicities.
          </p>
        ),
        image: {
          src: '/images/help/help-update-asso.jpg',
          alt: 'Edit class association',
        },
      },
      {
        title: 'Delete And Move',
        body: (
          <div className="space-y-2">
            <p>
              Select a class and press <code>Delete</code> or <code>Backspace</code> to remove it.
            </p>
            <p>
              Move elements by dragging them or using keyboard arrows.
            </p>
            <p>
              Use <code>Ctrl+Z</code> and <code>Ctrl+Y</code> for undo/redo.
            </p>
          </div>
        ),
        image: {
          src: '/images/help/help-move-element.jpg',
          alt: 'Move class element',
        },
      },
      {
        title: 'OCL Constraint',
        body: (
          <div className="space-y-2">
            <p>
              Drag the OCL shape, then write constraints such as <code>Context "ClassName" ...</code>.
              You can connect constraints to classes using dotted links.
            </p>
            <p>
              Constraint syntax validation runs during Quality Check and is powered by{' '}
              <a
                href="https://b-ocl-interpreter.readthedocs.io/en/latest/"
                target="_blank"
                rel="noopener noreferrer"
                className={sharedLinkClass}
              >
                B-OCL
              </a>.
            </p>
          </div>
        ),
        image: {
          src: '/images/help/help-ocl-constraint.png',
          alt: 'OCL constraint help',
        },
      },
      {
        title: 'Association Class',
        body: (
          <p>
            Create an association class by linking a class element to an existing association center point.
            You can define attributes like a regular class. Note: current generators do not support association classes.
          </p>
        ),
        image: {
          src: '/images/help/help-association-class.png',
          alt: 'Association class help',
        },
      },
    ],
  },
  {
    id: 'object',
    label: 'Object Diagram',
    summary: 'Represent concrete runtime instances and their links.',
    details: [
      {
        title: 'About Object Diagrams',
        body: (
          <p>
            Object diagrams show instances of classes at a specific moment in time, including current attribute values and links.
          </p>
        ),
      },
      {
        title: 'Add Object',
        body: (
          <p>
            Drag and drop an object element from the left panel to the canvas.
          </p>
        ),
        image: {
          src: '/images/help/object/help-create-object.png',
          alt: 'Create object',
        },
      },
      {
        title: 'Edit Object',
        body: (
          <div className="space-y-2">
            <p>
              Double-click an object to edit name, type, and attribute values.
            </p>
            <p>
              Use naming format <code>objectName : ClassName</code>.
              For values, use <code>attributeName = value</code> (for example <code>age = 25</code>).
            </p>
          </div>
        ),
        image: {
          src: '/images/help/object/help-update-object.png',
          alt: 'Edit object',
        },
      },
      {
        title: 'Add Object Link',
        body: (
          <p>
            Click an object, drag from a blue connection point, and drop on another object to create a link.
          </p>
        ),
        image: {
          src: '/images/help/object/help-create-object-link.png',
          alt: 'Create object link',
        },
      },
      {
        title: 'Edit Object Link',
        body: (
          <p>
            Double-click a link to update its properties such as role/name information.
          </p>
        ),
        image: {
          src: '/images/help/object/help-update-object-link.png',
          alt: 'Edit object link',
        },
      },
      {
        title: 'Delete, Move, And Best Practices',
        body: (
          <div className="space-y-2">
            <p>
              Delete objects/links with <code>Delete</code> or <code>Backspace</code>. Move objects by drag-and-drop or arrows.
            </p>
            <p>
              Use object diagrams together with class diagrams to validate real scenarios, names, and value consistency.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'state',
    label: 'State Machine',
    summary: 'Capture dynamic behavior with states, transitions, and actions.',
    details: [
      {
        title: 'About State Machine Diagrams',
        body: (
          <p>
            State machine diagrams describe behavior changes over time in response to events and conditions.
          </p>
        ),
      },
      {
        title: 'Add Initial And Final Flow',
        body: (
          <p>
            Start with an initial node and connect it to the first state.
          </p>
        ),
        image: {
          src: '/images/help/statemachine/help-initial-final-states.png',
          alt: 'State machine initial and final states',
        },
      },
      {
        title: 'Edit State',
        body: (
          <p>
            Double-click a state to update its name, <code>Body</code>, and optional <code>Fallback</code> behavior.
          </p>
        ),
        image: {
          src: '/images/help/statemachine/help-update-state.png',
          alt: 'Edit state',
        },
      },
      {
        title: 'Link Code Block',
        body: (
          <p>
            Link code behavior by providing function names in state body/fallback fields for precise execution mapping.
          </p>
        ),
        image: {
          src: '/images/help/statemachine/help-code-block.png',
          alt: 'State machine code block',
        },
      },
      {
        title: 'Best Practices',
        body: (
          <p>
            Keep state names explicit, guard transitions properly, and verify that all relevant event paths are modeled.
          </p>
        ),
      },
    ],
  },
  {
    id: 'agent',
    label: 'Agent Diagram',
    summary: 'Model BAF conversational agents with states, intents, and transition logic.',
    details: [
      {
        title: 'Modeling BAF Agents',
        body: (
          <p>
            Agent diagrams follow a state-machine style where each state has a behavior body and transitions define routing.
          </p>
        ),
      },
      {
        title: 'Add Agent State',
        body: (
          <p>
            Drag an agent state from the palette to the canvas.
          </p>
        ),
        image: {
          src: '/images/help/agent/help-agent-state.png',
          alt: 'Add agent state',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Edit Agent State Body',
        body: (
          <div className="space-y-2">
            <p>Double-click an agent state to configure behavior.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Text reply: predefined response message.</li>
              <li>LLM reply: delegate response generation to an LLM.</li>
              <li>RAG reply: answer using a retrieval-augmented knowledge source.</li>
              <li>Python code: execute custom behavior logic.</li>
            </ul>
          </div>
        ),
        image: {
          src: '/images/help/agent/help-agent-body.png',
          alt: 'Edit agent body',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Add Transition Between States',
        body: (
          <p>
            Drag from the outer part of a source state to a target state to define a transition.
          </p>
        ),
        image: {
          src: '/images/help/agent/help-agent-transition.png',
          alt: 'Add agent transition',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Set Transition Condition',
        body: (
          <div className="space-y-2">
            <p>Double-click a transition and configure condition rules such as:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>When Intent Matched</li>
              <li>When No Intent Matched</li>
              <li>Variable Operation Matched</li>
              <li>File Received</li>
              <li>Auto Transition</li>
            </ul>
          </div>
        ),
        image: {
          src: '/images/help/agent/help-agent-transition-body.png',
          alt: 'Agent transition conditions',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Set Initial State',
        body: (
          <p>
            Connect the initial node to the state where the conversation should begin.
          </p>
        ),
        image: {
          src: '/images/help/agent/help-agent-initial-state.png',
          alt: 'Agent initial state',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Define Intents',
        body: (
          <p>
            Add intent elements and define intent names plus training sentences to improve recognition quality.
            Intent descriptions help clarify the meaning and purpose of each intent.
          </p>
        ),
        image: {
          src: '/images/help/agent/help-agent-intent.png',
          alt: 'Define agent intents',
          heightClass: 'max-h-80',
        },
      },
      {
        title: 'Agent Configuration',
        body: (
          <div className="space-y-2">
            <p>
              Open Agent Config from the sidebar to configure model and runtime settings for generated agents.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Classical intent recognition: train a local model from defined intents.</li>
              <li>LLM-based intent recognition: delegate intent classification to an LLM.</li>
            </ul>
          </div>
        ),
        image: {
          src: '/images/help/agent/help-agent-configuration.png',
          alt: 'Agent configuration',
          heightClass: 'max-h-80',
        },
      },
    ],
  },
  {
    id: 'gui',
    label: 'GUI Editor',
    summary: 'Build UI screens visually and generate web application frontends.',
    details: [
      {
        title: 'Core Workflow',
        body: (
          <div className="space-y-2">
            <p>Use template blocks, compose layouts, then bind model-based data and actions.</p>
            <p>
              Keep pages modular so generated output remains predictable and maintainable.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'quantum',
    label: 'Quantum Editor',
    summary: 'Design circuits, configure gates, and generate Qiskit-compatible artifacts.',
    details: [
      {
        title: 'Core Workflow',
        body: (
          <div className="space-y-2">
            <p>Place gates on qubit lines, validate structure, then generate with selected backend settings.</p>
            <p>Use shot count and backend selection in Generate for reproducible results.</p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'nn',
    label: 'Neural Network',
    summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    details: [
      {
        title: 'Core Workflow',
        body: (
          <div className="space-y-2">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
              officia deserunt mollit anim id est laborum.
            </p>
          </div>
        ),
      },
    ],
  },
];

export const HelpGuideDialog: React.FC<HelpGuideDialogProps> = ({ open, onOpenChange }) => {
  const [activeSection, setActiveSection] = useState<GuideSectionId>('class');

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (open) {
      setActiveSection('class');
    }
  }, [open]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === activeSection) ?? sections[0],
    [activeSection],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !gap-0 h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-brand" />
            How The Editor Works
          </DialogTitle>
          <DialogDescription>Complete modeling guide with examples and visuals.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0 space-y-2 overflow-y-auto border-r border-border/70 p-4">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Diagram Types
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex w-full items-center rounded-md border px-3 py-2 text-left text-sm transition',
                  section.id === activeSection
                    ? 'border-brand/30 bg-brand/10 font-semibold text-foreground'
                    : 'border-border/70 bg-background text-muted-foreground hover:border-brand/30 hover:text-foreground',
                )}
              >
                {section.label}
              </button>
            ))}
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <h3 className="text-base font-semibold">{selectedSection.label}</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{selectedSection.summary}</p>

            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[760px] table-fixed">
                <tbody>
                  {selectedSection.details.map((detail) => (
                    <tr key={detail.title} className="align-top border-b border-border/60 last:border-b-0">
                      <th className="w-44 bg-muted/20 px-3 py-3 text-left text-sm font-semibold text-foreground">
                        {detail.title}
                      </th>
                      <td className="px-3 py-3 text-sm leading-relaxed text-muted-foreground">
                        <div className="space-y-2">{detail.body}</div>
                      </td>
                      <td className="w-72 px-3 py-3">
                        {detail.image ? (
                          // TODO: Convert help images to WebP format for smaller file sizes (#31)
                          <img
                            src={detail.image.src}
                            alt={detail.image.alt}
                            loading="lazy"
                            className={cn(
                              'max-h-56 w-full rounded-md border border-border/60 object-contain',
                              detail.image.heightClass,
                            )}
                          />
                        ) : (
                          <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                            No image for this item.
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button variant="outline" onClick={() => openExternalUrl(USER_STUDY_PDF_URL)} className="gap-2">
            Open User Study Instructions
            <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="outline" onClick={() => openExternalUrl(DOCS_URL)} className="gap-2">
            Open BESSER Docs
            <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="outline" onClick={() => openExternalUrl(besserWMERepositoryLink)} className="gap-2">
            Open WME Repository
            <ExternalLink className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * AssistantWidget — floating chat widget that delegates all business logic
 * to the shared useAssistantLogic hook.
 *
 * Renders as a fixed FAB button in the bottom-right corner that toggles a
 * popup chat card.  Route-aware: only visible on editor pages and implements
 * diagram switching via route navigation.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { CircleHelp, X } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import { switchDiagramTypeThunk } from '../../services/project/projectSlice';
import type { SupportedDiagramType } from '../../types/project';
import { toUMLDiagramType } from '../../types/project';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';
import { useAssistantLogic, type ConnectionStatus } from './useAssistantLogic';

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const AGENT_AVATAR_SRC = '/img/agent_back.png';

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'closing':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
};

const getConnectionLabel = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting\u2026';
    case 'closing':
      return 'Closing\u2026';
    case 'closed':
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AssistantWidgetProps {
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ onAssistantGenerate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const dispatch = useAppDispatch();
  const { switchDiagramType } = useProject();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnEditorPage = ['/', '/graphical-ui-editor', '/quantum-editor'].includes(location.pathname);

  /* ---- Widget-specific diagram switching (route-aware) ---- */

  const switchDiagram = async (targetType: string): Promise<boolean> => {
    const isGuiDiagram = targetType === 'GUINoCodeDiagram';
    const isQuantumDiagram = targetType === 'QuantumCircuitDiagram';

    if (isGuiDiagram || isQuantumDiagram) {
      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: targetType as SupportedDiagramType })).unwrap();
      } catch {
        return false;
      }
      if (isGuiDiagram && location.pathname !== '/graphical-ui-editor') {
        navigate('/graphical-ui-editor');
      }
      if (isQuantumDiagram && location.pathname !== '/quantum-editor') {
        navigate('/quantum-editor');
      }
      return true;
    }

    const umlType = toUMLDiagramType(targetType as any);
    if (!umlType) return false;

    try {
      if (location.pathname !== '/') {
        navigate('/');
      }
      switchDiagramType(umlType as UMLDiagramType);
      return true;
    } catch {
      return false;
    }
  };

  /* ---- Shared assistant logic ---- */

  const {
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    connectionStatus,
    rateLimitStatus,
    messageListContainerRef,
    handleSubmit,
    stopGenerating,
  } = useAssistantLogic({
    isActive: isVisible,
    switchDiagram,
    onGenerate: onAssistantGenerate,
  });

  /* ---- Hide when not on an editor page ---- */

  useEffect(() => {
    if (!isOnEditorPage) {
      setIsVisible(false);
    }
  }, [isOnEditorPage]);

  /* ---- External toggle event ---- */

  useEffect(() => {
    const toggle = () => {
      if (!isOnEditorPage) return;
      setIsVisible((p) => !p);
    };
    window.addEventListener('besser:toggle-agent-widget', toggle);
    return () => window.removeEventListener('besser:toggle-agent-widget', toggle);
  }, [isOnEditorPage]);

  /* ---- Render ---- */

  if (!isOnEditorPage) return null;

  const rateLimitColor =
    rateLimitStatus.cooldownRemaining > 0 || rateLimitStatus.requestsLastMinute >= 8
      ? 'text-red-500'
      : rateLimitStatus.requestsLastMinute >= 6
        ? 'text-amber-500'
        : 'text-muted-foreground';

  return (
    <>
      {/* ── Floating widget container ── */}
      <div className="fixed bottom-5 right-4 z-[1000] md:right-16">
        {/* ── Chat card ── */}
        <Card
          className={cn(
            'absolute bottom-[74px] right-0 flex h-[min(78vh,700px)] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300 sm:w-[480px] lg:w-[520px]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">BESSER Modeling Assistant</p>
                <p className="mt-1 text-xs opacity-80">AI modeling support</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white dark:text-slate-900 dark:hover:bg-slate-300"
                onClick={() => setShowDisclaimer(true)}
                title="Privacy and data processing"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
              <span className={cn('h-2.5 w-2.5 rounded-full', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          {/* Message list */}
          <div ref={messageListContainerRef} className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/40">
            <MessageList messages={messages} isTyping={isGenerating} showTimeStamps={false} />
          </div>

          {/* Status bar */}
          <Separator />
          <div className="flex items-center justify-between bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', getConnectionDotClass(connectionStatus))} />
              <span>{getConnectionLabel(connectionStatus)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={rateLimitColor}>{rateLimitStatus.requestsLastMinute}/8 req/min</span>
              <span>{messages.length} message{messages.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Input */}
          <Separator />
          <div className="bg-background p-3">
            <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
              {({ files, setFiles }) => (
                <MessageInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Describe what you want to create or modify\u2026"
                  allowAttachments
                  files={files}
                  setFiles={setFiles}
                  isGenerating={isGenerating}
                  stop={stopGenerating}
                />
              )}
            </ChatForm>
          </div>
        </Card>

        {/* ── FAB toggle button ── */}
        <Button
          type="button"
          size="icon"
          className="h-14 w-14 rounded-full border border-slate-300 bg-white text-slate-900 shadow-lg transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onClick={() => setIsVisible((p) => !p)}
          title={isVisible ? 'Close assistant' : 'Open assistant'}
        >
          {isVisible ? (
            <X className="h-5 w-5" />
          ) : (
            <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-10 w-10 rounded-full" />
          )}
        </Button>
      </div>

      {/* ── Disclaimer dialog ── */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Privacy and Data Processing
            </DialogTitle>
            <DialogDescription>
              Important information about how the assistant processes modeling data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">Data processing notice:</strong></p>
            <p>When you use the Modeling Assistant, your messages and diagram data are processed to provide AI-powered modeling support.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your diagram models and messages are sent to the AI service for processing.</li>
              <li>Data is transmitted over encrypted connections.</li>
              <li>Requests are processed to generate UML updates and modeling suggestions.</li>
              <li>Conversation history is stored locally in your current browser session.</li>
            </ul>
            <p><strong className="text-foreground">Privacy:</strong> Avoid sharing sensitive or confidential information in assistant messages.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowDisclaimer(false)}>I Understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

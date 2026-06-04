import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppDispatch, useAppSelector } from '@/main/app/store/hooks';
import {
  fetchLimitsThunk,
  selectAgentTestLimits,
  startAgentTestThunk,
} from '@/main/features/agent-testing';

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramTitle: string;
  diagramModel: object;
  diagramConfig?: object;
  diagramConfigYaml?: string;
}

const SENSITIVE_DATA_WARNING =
  'Do not share sensitive personal information (passwords, personal data, confidential documents) in the test chat. Test sessions are logged and may be visible to operators of this editor.';

export const CredentialsDialog: React.FC<CredentialsDialogProps> = ({
  open,
  onOpenChange,
  diagramTitle,
  diagramModel,
  diagramConfig,
  diagramConfigYaml,
}) => {
  const dispatch = useAppDispatch();
  const limits = useAppSelector(selectAgentTestLimits);

  const [apiKeyMode, setApiKeyMode] = useState<'own' | 'quota'>('own');
  const [openAiKey, setOpenAiKey] = useState('');
  const [huggingFaceToken, setHuggingFaceToken] = useState('');
  const [replicateKey, setReplicateKey] = useState('');
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [validationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      dispatch(fetchLimitsThunk());
    }
  }, [open, dispatch]);

  const handleStartTest = () => {
    const credentials =
      apiKeyMode === 'own'
        ? {
            openAiApiKey: openAiKey || undefined,
            huggingFaceToken: huggingFaceToken || undefined,
            replicateApiKey: replicateKey || undefined,
          }
        : undefined;

    const payload = {
      title: diagramTitle,
      model: diagramModel,
      config: diagramConfig,
      configYaml: diagramConfigYaml,
      credentials,
    };

    dispatch(startAgentTestThunk(payload));
    onOpenChange(false);
  };

  const editorQuotaEnabled = limits?.editorQuotaEnabled ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-primary/10">
              <FlaskConical className="size-4" />
            </div>
            Test Agent: {diagramTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 dark:border-amber-700/40 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              {SENSITIVE_DATA_WARNING}
            </p>
          </div>

          {/* API Keys section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight">API Keys</h3>

            {/* Mode selector */}
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="apiKeyMode"
                  value="own"
                  checked={apiKeyMode === 'own'}
                  onChange={() => setApiKeyMode('own')}
                  className="accent-primary"
                />
                Use my own API keys
              </label>

              {editorQuotaEnabled && (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="radio"
                    name="apiKeyMode"
                    value="quota"
                    checked={apiKeyMode === 'quota'}
                    onChange={() => setApiKeyMode('quota')}
                    className="accent-primary"
                  />
                  Use editor quota
                </label>
              )}
            </div>

            {/* Key inputs */}
            {apiKeyMode === 'own' && (
              <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    OpenAI API Key <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    type="password"
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    HuggingFace API Token{' '}
                    <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    type="password"
                    value={huggingFaceToken}
                    onChange={(e) => setHuggingFaceToken(e.target.value)}
                    placeholder="hf_..."
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Replicate API Key <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    type="password"
                    value={replicateKey}
                    onChange={(e) => setReplicateKey(e.target.value)}
                    placeholder="r8_..."
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Resource limits section (collapsible) */}
          {limits && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setLimitsExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between text-sm font-semibold tracking-tight"
              >
                Resource Limits
                {limitsExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </button>

              {limitsExpanded && (
                <dl className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
                  {limits.memoryMb !== undefined && (
                    <div className="flex justify-between py-0.5">
                      <dt className="text-muted-foreground">Memory</dt>
                      <dd className="font-medium">{limits.memoryMb} MB</dd>
                    </div>
                  )}
                  {limits.cpuCores !== undefined && (
                    <div className="flex justify-between py-0.5">
                      <dt className="text-muted-foreground">CPU</dt>
                      <dd className="font-medium">{limits.cpuCores} core(s)</dd>
                    </div>
                  )}
                  {limits.diskMb !== undefined && (
                    <div className="flex justify-between py-0.5">
                      <dt className="text-muted-foreground">Disk</dt>
                      <dd className="font-medium">{limits.diskMb} MB</dd>
                    </div>
                  )}
                  {limits.sessionLifetimeSeconds !== undefined && (
                    <div className="flex justify-between py-0.5">
                      <dt className="text-muted-foreground">Session lifetime</dt>
                      <dd className="font-medium">{Math.round(limits.sessionLifetimeSeconds / 60)} min</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          )}
        </div>

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/60 bg-destructive/10 p-3">
            <p className="mb-1.5 text-xs font-semibold text-destructive">
              Validation failed — agent code could not be generated:
            </p>
            <ul className="space-y-0.5">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-xs text-destructive/90">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStartTest} className="gap-2">
            <FlaskConical className="size-4" />
            Start Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

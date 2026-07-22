import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { BACKEND_URL } from '../constants/constant';
import { validateEmail, validateRequired, validateMinLength } from '../utils/validation';
import { useFieldValidation } from '../hooks/useFieldValidation';

type Satisfaction = 'happy' | 'neutral' | 'sad';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: '', labelKey: 'feedback.categoryOptions.none' },
  { value: 'editor', labelKey: 'feedback.categoryOptions.editor' },
  { value: 'generators', labelKey: 'feedback.categoryOptions.generators' },
  { value: 'deployment', labelKey: 'feedback.categoryOptions.deployment' },
  { value: 'performance', labelKey: 'feedback.categoryOptions.performance' },
  { value: 'bugs', labelKey: 'feedback.categoryOptions.bugs' },
  { value: 'feature_request', labelKey: 'feedback.categoryOptions.feature_request' },
  { value: 'documentation', labelKey: 'feedback.categoryOptions.documentation' },
  { value: 'other', labelKey: 'feedback.categoryOptions.other' },
];

const satisfactionOptions: Array<{ value: Satisfaction; labelKey: string; helperKey: string }> = [
  { value: 'sad', labelKey: 'feedback.satisfaction.sad.label', helperKey: 'feedback.satisfaction.sad.helper' },
  { value: 'neutral', labelKey: 'feedback.satisfaction.neutral.label', helperKey: 'feedback.satisfaction.neutral.helper' },
  { value: 'happy', labelKey: 'feedback.satisfaction.happy.label', helperKey: 'feedback.satisfaction.happy.helper' },
];

const buttonClass = (selected: boolean): string =>
  selected
    ? 'border-brand/30 bg-brand/10 text-foreground'
    : 'border-border/70 bg-background text-muted-foreground hover:border-brand/40 hover:text-foreground';

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [category, setCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Inline validation ────────────────────────────────────────────────
  const feedbackValidators = useMemo(() => ({
    feedback: () => validateRequired(feedback, 'Feedback') ?? validateMinLength(feedback, 10, 'Feedback'),
    email: () => validateEmail(email),
  }), [feedback, email]);
  const validation = useFieldValidation(feedbackValidators);

  const canSubmit = useMemo(() => Boolean(satisfaction) && feedback.trim().length > 0 && !isSubmitting && !validateEmail(email), [feedback, isSubmitting, satisfaction, email]);

  const reset = () => {
    setSatisfaction(null);
    setCategory('');
    setFeedback('');
    setEmail('');
    setIsSubmitting(false);
    validation.resetTouched();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = async () => {
    const errors = validation.touchAll();
    if (Object.keys(errors).length > 0 || !satisfaction) {
      if (!satisfaction) {
        toast.error(t('feedback.toasts.selectRating'));
      }
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${BACKEND_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satisfaction,
          category,
          feedback: feedback.trim(),
          email: email.trim() || null,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        let detail = t('feedback.toasts.submitFailedDefault');
        try {
          const payload = await response.json();
          if (typeof payload?.detail === 'string') {
            detail = payload.detail;
          }
        } catch {
          // Use fallback detail.
        }
        throw new Error(detail);
      }

      toast.success(t('feedback.toasts.thankYou'));
      handleOpenChange(false);
    } catch (error) {
      toast.error(t('feedback.toasts.submitFailed', { error: error instanceof Error ? error.message : t('feedback.toasts.unknownError') }));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('feedback.satisfactionQuestion')}</Label>
            <div className="grid gap-2.5 md:grid-cols-3">
              {satisfactionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSatisfaction(option.value)}
                  className={`group relative overflow-hidden rounded-xl border px-4 py-4 text-left transition-all duration-200 ${
                    satisfaction === option.value
                      ? 'border-brand/40 bg-brand/[0.06] shadow-elevation-1 ring-1 ring-brand/15'
                      : 'border-border/50 bg-background text-muted-foreground hover:-translate-y-px hover:border-brand/25 hover:shadow-elevation-1'
                  }`}
                >
                  <div className="pointer-events-none absolute -right-3 -top-3 size-10 rounded-full bg-brand/[0.04] transition-transform duration-300 group-hover:scale-[2]" />
                  <p className="relative text-sm font-semibold tracking-tight text-foreground">{t(option.labelKey)}</p>
                  <p className="relative mt-1 text-xs opacity-70">{t(option.helperKey)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedback-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('feedback.category')}</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {categories.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <FormField label={t('feedback.feedbackLabel')} htmlFor="feedback-message" required error={validation.getError('feedback')}>
            <Textarea
              id="feedback-message"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              onBlur={() => validation.markTouched('feedback')}
              placeholder={t('feedback.feedbackPlaceholder')}
              className={`min-h-28 ${validation.getError('feedback') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}`}
            />
          </FormField>

          <FormField label={t('feedback.emailLabel')} htmlFor="feedback-email" error={validation.getError('email')} helperText={t('feedback.emailHelper')}>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => validation.markTouched('email')}
              placeholder="your.email@example.com"
              className={validation.getError('email') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
            />
          </FormField>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="rounded-lg">
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit} className="rounded-lg bg-brand text-brand-foreground shadow-elevation-1 transition-shadow hover:bg-brand-dark hover:shadow-elevation-2">
            {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

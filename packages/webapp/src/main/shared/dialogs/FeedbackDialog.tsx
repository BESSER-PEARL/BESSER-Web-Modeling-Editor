import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// No category is the empty value, shown as the Select placeholder
// ('feedback.categoryOptions.none'); Radix Select items cannot use ''.
const categories = [
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

const smallLabelClass = 'text-xs font-medium text-muted-foreground';

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
          <div className="flex flex-col gap-2">
            <Label id="feedback-satisfaction-label" className={smallLabelClass}>{t('feedback.satisfactionQuestion')}</Label>
            <RadioGroup
              aria-labelledby="feedback-satisfaction-label"
              value={satisfaction ?? ''}
              onValueChange={(value) => setSatisfaction(value as Satisfaction)}
              className="grid gap-2.5 overflow-visible rounded-none border-0 md:grid-cols-3"
            >
              {satisfactionOptions.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  className="group flex items-start gap-2.5 rounded-xl border border-border/60 bg-background px-4 py-3.5 text-left text-sm text-muted-foreground transition-[background-color,border-color,box-shadow] duration-150 hover:border-brand/30 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background data-[state=checked]:border-brand/50 data-[state=checked]:bg-brand/[0.06] data-[state=checked]:text-muted-foreground data-[state=checked]:hover:bg-brand/[0.06]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 transition-[border-color] duration-150 group-data-[state=checked]:border-brand"
                  >
                    <span className="size-2 rounded-full bg-brand opacity-0 transition-opacity duration-150 group-data-[state=checked]:opacity-100" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">{t(option.labelKey)}</span>
                    <span className="mt-0.5 text-xs">{t(option.helperKey)}</span>
                  </span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedback-category" className={smallLabelClass}>{t('feedback.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="feedback-category" className="rounded-lg">
                <SelectValue placeholder={t('feedback.categoryOptions.none')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

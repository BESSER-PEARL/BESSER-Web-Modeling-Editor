import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BACKEND_URL } from '../../constant';

type Satisfaction = 'happy' | 'neutral' | 'sad';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: '', label: 'Select a category (optional)' },
  { value: 'editor', label: 'Diagram Editor' },
  { value: 'generators', label: 'Code Generation' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'performance', label: 'Performance' },
  { value: 'bugs', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

const satisfactionOptions: Array<{ value: Satisfaction; label: string; helper: string }> = [
  { value: 'sad', label: 'Not Satisfied', helper: 'Needs improvements' },
  { value: 'neutral', label: 'Neutral', helper: 'Mixed experience' },
  { value: 'happy', label: 'Very Satisfied', helper: 'Great experience' },
];

const buttonClass = (selected: boolean): string =>
  selected
    ? 'border-primary bg-primary/10 text-foreground'
    : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground';

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onOpenChange }) => {
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [category, setCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => Boolean(satisfaction) && feedback.trim().length > 0 && !isSubmitting, [feedback, isSubmitting, satisfaction]);

  const reset = () => {
    setSatisfaction(null);
    setCategory('');
    setFeedback('');
    setEmail('');
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = async () => {
    if (!satisfaction || !feedback.trim()) {
      toast.error('Please provide a satisfaction rating and feedback.');
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
        let detail = 'Failed to submit feedback.';
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

      toast.success('Thank you for your feedback.');
      handleOpenChange(false);
    } catch (error) {
      toast.error(`Feedback submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">Help Us Improve BESSER</DialogTitle>
          <DialogDescription>Share your feedback about the editor and generation workflow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How satisfied are you with your experience?</Label>
            <div className="grid gap-2.5 md:grid-cols-3">
              {satisfactionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSatisfaction(option.value)}
                  className={`group relative overflow-hidden rounded-xl border px-4 py-4 text-left transition-all duration-200 ${
                    satisfaction === option.value
                      ? 'border-primary/40 bg-primary/6 shadow-elevation-1 ring-1 ring-primary/15'
                      : 'border-border/50 bg-background text-muted-foreground hover:-translate-y-px hover:border-primary/25 hover:shadow-elevation-1'
                  }`}
                >
                  <div className="pointer-events-none absolute -right-3 -top-3 h-10 w-10 rounded-full bg-primary/4 transition-transform duration-300 group-hover:scale-[2]" />
                  <p className="relative text-sm font-semibold tracking-tight text-foreground">{option.label}</p>
                  <p className="relative mt-1 text-xs opacity-70">{option.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {categories.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feedback <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="feedback-message"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us what works, what does not, and what you want next."
              className="min-h-28"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your.email@example.com"
            />
            <p className="text-[11px] text-muted-foreground/70">Leave your email if you want follow-up from the team.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="rounded-lg">
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit} className="rounded-lg shadow-elevation-1 transition-shadow hover:shadow-elevation-2">
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

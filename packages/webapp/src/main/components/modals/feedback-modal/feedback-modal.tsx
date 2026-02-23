import React, { useState } from 'react';
import { Modal, Form, Button, ButtonGroup } from 'react-bootstrap';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import { ModalContentProps } from '../application-modal-types';
import { BACKEND_URL } from '../../../constant';

const SatisfactionButton = styled(Button)<{ selected: boolean }>`
  border: 2px solid ${(props) => (props.selected ? 'var(--apollon-primary)' : '#ddd')};
  background: ${(props) => (props.selected ? 'var(--apollon-primary)' : 'white')};
  color: ${(props) => (props.selected ? 'white' : '#333')};
  transition: all 0.2s;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: ${(props) => (props.selected ? 'var(--apollon-primary)' : '#f8f9fa')};
    border-color: ${(props) => (props.selected ? 'var(--apollon-primary)' : '#999')};
    color: ${(props) => (props.selected ? 'white' : '#333')};
  }
`;

const EmojiIcon = styled.span`
  font-size: 2rem;
`;

export const FeedbackModal: React.FC<ModalContentProps> = ({ close }) => {
  const [satisfaction, setSatisfaction] = useState<'happy' | 'neutral' | 'sad' | null>(null);
  const [category, setCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!satisfaction || !feedback.trim()) {
      toast.error('Please provide a satisfaction rating and feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satisfaction,
          category,
          feedback,
          email: email || null,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit feedback');
      }

      toast.success('Thank you for your feedback! 🙏');

      // Reset form
      setSatisfaction(null);
      setCategory('');
      setFeedback('');
      setEmail('');
      close();
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Help Us Improve BESSER</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-4">
            <Form.Label>How satisfied are you with your experience?</Form.Label>
            <ButtonGroup className="w-100 d-flex">
              <SatisfactionButton
                type="button"
                selected={satisfaction === 'sad'}
                onClick={() => setSatisfaction('sad')}
                className="flex-fill"
              >
                <EmojiIcon>😞</EmojiIcon>
                <div>Not Satisfied</div>
              </SatisfactionButton>
              <SatisfactionButton
                type="button"
                selected={satisfaction === 'neutral'}
                onClick={() => setSatisfaction('neutral')}
                className="flex-fill"
              >
                <EmojiIcon>😐</EmojiIcon>
                <div>Neutral</div>
              </SatisfactionButton>
              <SatisfactionButton
                type="button"
                selected={satisfaction === 'happy'}
                onClick={() => setSatisfaction('happy')}
                className="flex-fill"
              >
                <EmojiIcon>😊</EmojiIcon>
                <div>Very Satisfied</div>
              </SatisfactionButton>
            </ButtonGroup>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>What would you like to share feedback about?</Form.Label>
            <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a category (optional)</option>
              <option value="editor">Diagram Editor</option>
              <option value="generators">Code Generation</option>
              <option value="deployment">Deployment</option>
              <option value="performance">Performance</option>
              <option value="bugs">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="documentation">Documentation</option>
              <option value="other">Other</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Your Feedback <span style={{ color: 'red' }}>*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Tell us about your experience, what can we improve, or what features you'd like to see..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email (optional)</Form.Label>
            <Form.Control
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Form.Text className="text-muted">
              Provide your email if you'd like us to follow up with you
            </Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting || !satisfaction || !feedback.trim()}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </Modal.Footer>
      </Form>
    </>
  );
};

import {
  BPMNIntermediateEvent,
  BPMNIntermediateEventType,
} from '../../../../../main/packages/bpmn/bpmn-intermediate-event/bpmn-intermediate-event';

describe('BPMNIntermediateEvent - eventType (Phase A construct gaps)', () => {
  it('should accept timer-throw as a valid intermediate-event type', () => {
    const event = new BPMNIntermediateEvent({ eventType: 'timer-throw' as BPMNIntermediateEventType });
    expect(event.eventType).toBe('timer-throw');
  });

  it('should round-trip timer-throw through serialize/deserialize', () => {
    const event = new BPMNIntermediateEvent({ eventType: 'timer-throw' as BPMNIntermediateEventType });
    const serialized = event.serialize();
    expect(serialized.eventType).toBe('timer-throw');

    const restored = new BPMNIntermediateEvent();
    restored.deserialize(serialized);
    expect(restored.eventType).toBe('timer-throw');
  });
});

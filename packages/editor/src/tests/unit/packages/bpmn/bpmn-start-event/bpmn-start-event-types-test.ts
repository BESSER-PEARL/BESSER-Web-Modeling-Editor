import {
  BPMNStartEvent,
  BPMNStartEventType,
} from '../../../../../main/packages/bpmn/bpmn-start-event/bpmn-start-event';

describe('BPMNStartEvent - eventType (Phase A construct gaps)', () => {
  const newTypes: BPMNStartEventType[] = ['escalation', 'error', 'compensation', 'link'];

  it.each(newTypes)('should accept %s as a valid start-event type', (type) => {
    const event = new BPMNStartEvent({ eventType: type });
    expect(event.eventType).toBe(type);
  });

  it.each(newTypes)('should round-trip %s through serialize/deserialize', (type) => {
    const event = new BPMNStartEvent({ eventType: type });
    const serialized = event.serialize();
    expect(serialized.eventType).toBe(type);

    const restored = new BPMNStartEvent();
    restored.deserialize(serialized);
    expect(restored.eventType).toBe(type);
  });
});

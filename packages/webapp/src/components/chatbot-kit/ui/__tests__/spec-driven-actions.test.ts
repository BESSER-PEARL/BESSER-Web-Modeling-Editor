import { describe, expect, it } from 'vitest';

import { describeToolCall, parseToolDetail } from '../spec-driven-actions';

// Detail strings below are the shape BESSER's `_tool_call_detail` emits.
describe('describeToolCall', () => {
  it('names file tools by verb and path', () => {
    expect(describeToolCall('write_file', 'path=frontend/package.json')).toEqual({
      verb: 'write',
      target: 'frontend/package.json',
    });
    expect(describeToolCall('modify_file', 'path=backend/main_api.py batched=3')).toEqual({
      verb: 'edit',
      target: 'backend/main_api.py',
    });
    expect(describeToolCall('read_file', 'file_path=backend/routers/hotel.py').verb).toBe('read');
  });

  it('keeps spaces inside a shell command', () => {
    expect(describeToolCall('run_command', 'command=npm view vite version batched=2')).toEqual({
      verb: 'shell',
      target: 'npm view vite version',
    });
  });

  it('reads task_list bookkeeping as action and id', () => {
    expect(describeToolCall('task_list', 'action=update id=3').target).toBe('update #3');
    expect(describeToolCall('task_list', 'action=add text=Add CORS').target).toBe('add Add CORS');
  });

  it('labels generator tools and falls back to the raw tool name', () => {
    expect(describeToolCall('generate_react')).toEqual({ verb: 'generate', target: 'react' });
    expect(describeToolCall('some_new_tool')).toEqual({ verb: 'some_new_tool', target: '' });
  });

  it('falls back to the summary when there is no detail', () => {
    expect(describeToolCall('write_file', null, 'README.md').target).toBe('README.md');
  });
});

describe('parseToolDetail', () => {
  it('splits only before known keys', () => {
    expect(parseToolDetail('pattern=a = b path=src')).toEqual({ pattern: 'a = b', path: 'src' });
    expect(parseToolDetail(undefined)).toEqual({});
  });
});

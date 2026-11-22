import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoScroll } from '../use-auto-scroll';

describe('useAutoScroll', () => {
  it('should initialize with shouldAutoScroll as true', () => {
    const { result } = renderHook(() => useAutoScroll([]));
    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it('should disable auto-scroll when user scrolls up deliberately', () => {
    const { result } = renderHook(() => useAutoScroll([]));

    // Mock the container with proper getter/setter for scrollTop
    const mockEl = {
      _scrollTop: 500,
      scrollHeight: 1000,
      clientHeight: 500,
      get scrollTop() {
        return this._scrollTop;
      },
      set scrollTop(value: number) {
        this._scrollTop = value;
      },
    };

    // Initialize the hook by setting up the container mock
    act(() => {
      result.current.containerRef.current = mockEl as any;
    });

    // Simulate deliberate scroll up (move up > 10px)
    act(() => {
      mockEl.scrollTop = 400; // Scrolled up by 100px
      result.current.handleScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(false);
  });

  it('should re-enable auto-scroll when user scrolls back to bottom', () => {
    const { result } = renderHook(() => useAutoScroll([]));

    const mockEl = {
      _scrollTop: 400,
      scrollHeight: 1000,
      clientHeight: 500,
      get scrollTop() {
        return this._scrollTop;
      },
      set scrollTop(value: number) {
        this._scrollTop = value;
      },
    };

    act(() => {
      result.current.containerRef.current = mockEl as any;
    });

    // Start scrolled up
    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(false);

    // Scroll back to bottom
    act(() => {
      mockEl.scrollTop = 500; // Back at bottom (1000 - 500 - 500 = 0, within 40px threshold)
      result.current.handleScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it('should provide scrollToBottom function that sets scrollTop to scrollHeight', () => {
    const { result } = renderHook(() => useAutoScroll([]));

    const mockEl = {
      _scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
      get scrollTop() {
        return this._scrollTop;
      },
      set scrollTop(value: number) {
        this._scrollTop = value;
      },
    };

    act(() => {
      result.current.containerRef.current = mockEl as any;
    });

    expect(typeof result.current.scrollToBottom).toBe('function');

    // Call scrollToBottom
    act(() => {
      result.current.scrollToBottom();
    });

    // scrollTop should be set to scrollHeight
    expect(mockEl.scrollTop).toBe(1000);
  });

  it('should handle touch start by disabling auto-scroll', () => {
    const { result } = renderHook(() => useAutoScroll([]));

    const mockEl = {
      _scrollTop: 500,
      scrollHeight: 1000,
      clientHeight: 500,
      get scrollTop() {
        return this._scrollTop;
      },
      set scrollTop(value: number) {
        this._scrollTop = value;
      },
    };

    act(() => {
      result.current.containerRef.current = mockEl as any;
    });

    // Initially at bottom
    expect(result.current.shouldAutoScroll).toBe(true);

    // Touch start disables auto-scroll
    act(() => {
      result.current.handleTouchStart();
    });

    expect(result.current.shouldAutoScroll).toBe(false);
  });
});

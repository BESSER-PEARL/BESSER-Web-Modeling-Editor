/**
 * Pointer APIs Radix Select needs to open from a `pointerdown`, which the root jsdom (23) lacks.
 * On develop the old editor's pepjs polyfill, loaded through `@besser/wme`, supplied them; the
 * React Flow library does not load pepjs.
 */
export function installPointerEventPolyfill(): void {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? '';
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
}

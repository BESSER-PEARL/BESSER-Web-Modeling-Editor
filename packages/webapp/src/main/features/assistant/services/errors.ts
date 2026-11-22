/**
 * Structured error handling for the assistant module.
 *
 * Preserves error chains via Error.cause and provides
 * user-friendly messages with debugging context.
 */

export class AssistantError extends Error {
    /** The original error that caused this one. */
    public readonly cause?: Error;

    constructor(message: string, options?: { cause?: Error }) {
        super(message);
        this.name = 'AssistantError';
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}

export class ProtocolError extends AssistantError {
    /** The raw payload that failed to parse, truncated for logging. */
    public readonly rawPreview: string;
    /** Which parsing strategy failed. */
    public readonly parseStrategy: string;

    constructor(message: string, rawPayload: string = '', parseStrategy: string = '', options?: { cause?: Error }) {
        super(message, options);
        this.name = 'ProtocolError';
        this.rawPreview = rawPayload.slice(0, 200);
        this.parseStrategy = parseStrategy;
    }
}

export class InjectionError extends AssistantError {
    /** The action that failed (inject_element, modify_model, etc.). */
    public readonly action: string;
    /** The diagram type being modified. */
    public readonly diagramType: string;

    constructor(message: string, action: string = '', diagramType: string = '', options?: { cause?: Error }) {
        super(message, options);
        this.name = 'InjectionError';
        this.action = action;
        this.diagramType = diagramType;
    }
}

export class TimeoutError extends AssistantError {
    public readonly timeoutMs: number;

    constructor(message: string, timeoutMs: number, options?: { cause?: Error }) {
        super(message, options);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

/** Format an error for user-facing display. */
export function formatErrorForUser(error: unknown): string {
    if (error instanceof InjectionError) {
        return `Could not apply ${error.action || 'change'}${error.diagramType ? ` to ${error.diagramType}` : ''}: ${error.message}`;
    }
    if (error instanceof ProtocolError) {
        return `Received an invalid response from the assistant (${error.parseStrategy || 'unknown format'}). Please try again.`;
    }
    if (error instanceof TimeoutError) {
        return `The assistant took too long to respond (${Math.round(error.timeoutMs / 1000)}s). Please try again.`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Escape angle brackets so an error/message string renders as literal text
 * instead of being interpreted as markup. Shared home for the sanitizer that
 * the assistant hooks use; re-exported from the services barrel.
 */
export function sanitizeForDisplay(text: string): string {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

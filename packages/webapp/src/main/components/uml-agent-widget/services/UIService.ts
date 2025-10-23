/**
 * UI utility service for UML Agent Widget
 * Handles message formatting, validation, and UI state management
 */

import { ChatMessage } from './WebSocketService';

export interface MessageDisplayConfig {
  showTimestamp?: boolean;
  showAvatar?: boolean;
  enableCodeHighlighting?: boolean;
  maxMessageLength?: number;
}

/**
 * Service for handling UI-related operations
 */
export class UIService {
  private config: MessageDisplayConfig;

  constructor(config: MessageDisplayConfig = {}) {
    this.config = {
      showTimestamp: true,
      showAvatar: true,
      enableCodeHighlighting: true,
      maxMessageLength: 5000,
      ...config
    };
  }

  /**
   * Format message content for display
   */
  formatMessageContent(message: ChatMessage): string {
    let content = typeof message.message === 'string' 
      ? message.message 
      : JSON.stringify(message.message, null, 2);

    // Truncate if too long
    if (this.config.maxMessageLength && content.length > this.config.maxMessageLength) {
      content = content.substring(0, this.config.maxMessageLength) + '...';
    }

    return content;
  }

  /**
   * Extract JSON blocks from message content
   */
  extractJsonBlocks(content: string): Array<{ json: string; language: string }> {
    const jsonBlocks: Array<{ json: string; language: string }> = [];
    
    // Look for fenced code blocks first (```json ... ```)
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match;

    while ((match = jsonRegex.exec(content)) !== null) {
      jsonBlocks.push({
        json: match[1].trim(),
        language: 'json'
      });
    }

    if (jsonBlocks.length === 0) {
      // Look for standalone JSON objects only if no fenced block was found
      const standaloneJsonRegex = /(\{[\s\S]*?\})/g;
      const standaloneMatches = content.match(standaloneJsonRegex);

      if (standaloneMatches) {
        standaloneMatches.forEach(jsonStr => {
          try {
            const trimmed = jsonStr.trim();
            const parsed = JSON.parse(trimmed);
            if (this.isValidUMLModel(parsed)) {
              jsonBlocks.push({
                json: trimmed,
                language: 'json'
              });
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        });
      }
    }

    return jsonBlocks;
  }

  /**
   * Check if message contains importable model
   */
  containsImportableModel(content: string): boolean {
    const jsonBlocks = this.extractJsonBlocks(content);
    
    return jsonBlocks.some(block => {
      try {
        const parsed = JSON.parse(block.json);
        return this.isValidUMLModel(parsed);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Validate if object is a valid UML model
   */
  private isValidUMLModel(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    if (obj.elements && typeof obj.elements === 'object') {
      return true;
    }

    if (obj.relationships && typeof obj.relationships === 'object') {
      return true;
    }

    const elementLike = obj.class || obj.object || obj.state || obj.intent;
    if (elementLike && typeof elementLike === 'object') {
      return true;
    }

    if (typeof obj.type === 'string' && obj.type.endsWith('Diagram') && obj.class) {
      return true;
    }

    return false;
  }

  /**
   * Validate user input
   */
  validateUserInput(input: string): { valid: boolean; error?: string } {
    if (!input || input.trim().length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    if (input.length > 1000) {
      return { valid: false, error: 'Message too long (max 1000 characters)' };
    }

    // Check for potential harmful content (basic)
    const harmfulPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(input)) {
        return { valid: false, error: 'Invalid characters detected' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate unique ID for UI elements
   */
  generateId(prefix: string = 'ui'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Scroll to bottom of element
   */
  scrollToBottom(element: HTMLElement | null, smooth: boolean = true): void {
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  /**
   * Show toast notification (simple implementation)
   */
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    // Add CSS animation
    if (!document.querySelector('#toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'toast-styles';
      styles.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * Get friendly error message
   */
  getFriendlyErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error) {
      return error.error;
    }
    
    return 'An unexpected error occurred';
  }
}

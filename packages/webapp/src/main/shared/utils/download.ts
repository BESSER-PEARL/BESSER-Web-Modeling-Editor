/**
 * Download content as a file.
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Download JSON content as a .json file.
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * Copy text to clipboard and return success status.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

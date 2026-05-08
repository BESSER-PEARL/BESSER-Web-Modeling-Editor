/**
 * Utility functions for handling GitHub URLs
 */

/**
 * Convert a GitHub blob URL to a raw content URL
 * @param githubUrl - GitHub URL (blob or raw format)
 * @returns Raw content URL
 * @example
 * convertToRawUrl('https://github.com/user/repo/blob/main/file.py')
 * // Returns: 'https://raw.githubusercontent.com/user/repo/main/file.py'
 */
export function convertToRawUrl(githubUrl: string): string {
    try {
        const url = new URL(githubUrl);

        // Already a raw URL
        if (url.hostname === 'raw.githubusercontent.com') {
            return githubUrl;
        }

        // Convert github.com blob URL to raw URL
        if (url.hostname === 'github.com' && url.pathname.includes('/blob/')) {
            const pathParts = url.pathname.split('/');
            // Format: /owner/repo/blob/branch/path/to/file
            // Remove 'blob' from the path
            const blobIndex = pathParts.indexOf('blob');
            if (blobIndex !== -1) {
                pathParts.splice(blobIndex, 1);
            }

            // Reconstruct as raw URL
            const newPath = pathParts.join('/');
            return `https://raw.githubusercontent.com${newPath}`;
        }

        // If not a recognized format, return as-is
        return githubUrl;
    } catch (error) {
        console.error('Error converting GitHub URL:', error);
        return githubUrl;
    }
}

/**
 * Extract filename from a GitHub URL
 * @param githubUrl - GitHub URL
 * @returns Filename with extension
 * @example
 * extractFileName('https://github.com/user/repo/blob/main/model.py')
 * // Returns: 'model.py'
 */
export function extractFileName(githubUrl: string): string {
    try {
        const url = new URL(githubUrl);
        const pathParts = url.pathname.split('/');
        const filename = pathParts[pathParts.length - 1];
        return filename || 'model.py';
    } catch (error) {
        console.error('Error extracting filename from URL:', error);
        return 'model.py';
    }
}

/**
 * Validate if a URL is a GitHub URL
 * @param url - URL to validate
 * @returns True if valid GitHub URL
 */
export function validateGitHubUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return (
            (urlObj.hostname === 'github.com' || urlObj.hostname === 'raw.githubusercontent.com') &&
            urlObj.pathname.length > 1
        );
    } catch (error) {
        return false;
    }
}

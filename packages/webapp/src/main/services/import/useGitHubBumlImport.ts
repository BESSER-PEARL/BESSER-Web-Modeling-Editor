import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { convertToRawUrl, extractFileName, validateGitHubUrl } from '../../utils/githubUrlUtils';
import { importProjectFromBUML } from './useImportProject';
import { useProject } from '../../hooks/useProject';

export const useGitHubBumlImport = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { loadProject } = useProject();

    const importFromGitHub = useCallback(async (githubUrl: string) => {
        // Validate GitHub URL
        if (!validateGitHubUrl(githubUrl)) {
            toast.error('Invalid GitHub URL. Please provide a valid GitHub repository URL.');
            return;
        }

        setIsLoading(true);

        try {
            // Convert to raw URL if needed
            const rawUrl = convertToRawUrl(githubUrl);
            const filename = extractFileName(githubUrl);

            // Show loading toast
            const loadingToast = toast.loading(`Fetching ${filename} from GitHub...`);

            // Fetch the file from GitHub
            const response = await fetch(rawUrl);

            if (!response.ok) {
                toast.dismiss(loadingToast);
                if (response.status === 404) {
                    toast.error('File not found on GitHub. Please check the URL and try again.');
                } else {
                    toast.error(`Failed to fetch file from GitHub: ${response.statusText}`);
                }
                setIsLoading(false);
                return;
            }

            // Get the file content as text
            const fileContent = await response.text();

            // Create a File object from the content
            const file = new File([fileContent], filename, { type: 'text/x-python' });

            // Dismiss loading toast
            toast.dismiss(loadingToast);

            // Use the project import function which calls /get-project-json-model
            const importedProject = await importProjectFromBUML(file);

            // Load the imported project
            await loadProject(importedProject.id);

            toast.success(`Successfully imported project: ${importedProject.name}`);

        } catch (error) {
            console.error('Error importing from GitHub:', error);

            let errorMessage = 'Failed to import model from GitHub';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [loadProject]);

    return { importFromGitHub, isLoading };
};

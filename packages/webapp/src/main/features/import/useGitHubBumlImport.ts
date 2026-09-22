import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { convertToRawUrl, extractFileName, validateGitHubUrl } from '../../shared/utils/githubUrlUtils';
import { importProjectFromBUML } from '../../shared/services/project-import/projectImport';
import { useProject } from '../../app/hooks/useProject';

export const useGitHubBumlImport = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { loadProject } = useProject();
    const { t } = useTranslation();

    const importFromGitHub = useCallback(async (githubUrl: string) => {
        // Validate GitHub URL
        if (!validateGitHubUrl(githubUrl)) {
            toast.error(t('github.toasts.invalidGitHubUrl'));
            return;
        }

        setIsLoading(true);

        try {
            // Convert to raw URL if needed
            const rawUrl = convertToRawUrl(githubUrl);
            const filename = extractFileName(githubUrl);

            // Show loading toast
            const loadingToast = toast.loading(t('github.toasts.fetchingFromGitHub', { filename }));

            // Fetch the file from GitHub
            const response = await fetch(rawUrl);

            if (!response.ok) {
                toast.dismiss(loadingToast);
                if (response.status === 404) {
                    toast.error(t('github.toasts.fileNotFound'));
                } else {
                    toast.error(t('github.toasts.fetchFileFailed', { status: response.statusText }));
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

            toast.success(t('github.toasts.importProjectSuccess', { name: importedProject.name }));

        } catch (error) {
            console.error('Error importing from GitHub:', error);

            let errorMessage = t('github.toasts.importModelFailed');
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [loadProject, t]);

    return { importFromGitHub, isLoading };
};

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import { convertToRawUrl, extractFileName, validateGitHubUrl } from '../../shared/utils/githubUrlUtils';
import { importProjectFromBUML } from '../../shared/services/project-import/projectImport';
import { useProject } from '../../app/hooks/useProject';
import { fetchRawGitHubFile } from '../../shared/api/github';
import { errorProperties, track } from '../../shared/services/analytics/events';

export const useGitHubBumlImport = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { loadProject } = useProject();
    const { t } = useTranslation();

    const importFromGitHub = useCallback(async (githubUrl: string) => {
        // Validate GitHub URL
        if (!validateGitHubUrl(githubUrl)) {
            reportError(t('github.toasts.invalidGitHubUrl'));
            track('project_creation_failed', { via: 'url_import', reason: 'invalid_input' });
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
            const response = await fetchRawGitHubFile(rawUrl);

            if (!response.ok) {
                toast.dismiss(loadingToast);
                track('project_creation_failed', { via: 'url_import', reason: 'request', http_status: response.status });
                if (response.status === 404) {
                    reportError(t('github.toasts.fileNotFound'));
                } else {
                    reportError(t('github.toasts.fetchFileFailed', { status: response.statusText }));
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
            // The imported project opens in the low-code editor.
            track('project_created', { interface: 'model', via: 'url_import' });

        } catch (error) {
            console.error('Error importing from GitHub:', error);

            let errorMessage = t('github.toasts.importModelFailed');
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            reportError(errorMessage, { error });
            track('project_creation_failed', { via: 'url_import', reason: 'request', ...errorProperties(error) });
        } finally {
            setIsLoading(false);
        }
    }, [loadProject, t]);

    return { importFromGitHub, isLoading };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { BesserProject } from '../../types/project';
import { LinkedRepository, useGitHubStorage } from './useGitHubStorage';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';

// LocalStorage key for auto-commit settings
const AUTO_COMMIT_SETTINGS_KEY = 'besser_github_auto_commit';

export interface AutoCommitSettings {
    enabled: boolean;
    intervalMinutes: number;
    lastAutoCommitAt?: string;
}

interface UseAutoCommitProps {
    githubSession: string | null;
    projectId: string | null;
    linkedRepo: LinkedRepository | null;
    saveCurrentEditorState: () => void;
}

/**
 * Hook for managing auto-commit functionality.
 * Automatically commits changes to GitHub at specified intervals.
 */
export const useAutoCommit = ({
    githubSession,
    projectId,
    linkedRepo,
    saveCurrentEditorState,
}: UseAutoCommitProps) => {
    const { saveProjectToGitHub, checkForChanges } = useGitHubStorage();
    const [settings, setSettings] = useState<AutoCommitSettings>({
        enabled: false,
        intervalMinutes: 10,
    });
    const [isAutoCommitting, setIsAutoCommitting] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load settings from localStorage
    useEffect(() => {
        if (projectId) {
            try {
                const stored = localStorage.getItem(AUTO_COMMIT_SETTINGS_KEY);
                if (stored) {
                    const allSettings = JSON.parse(stored) as Record<string, AutoCommitSettings>;
                    if (allSettings[projectId]) {
                        setSettings(allSettings[projectId]);
                    }
                }
            } catch (error) {
                console.error('Failed to load auto-commit settings:', error);
            }
        }
    }, [projectId]);

    // Save settings to localStorage
    const saveSettings = useCallback((newSettings: AutoCommitSettings) => {
        if (!projectId) return;

        try {
            const stored = localStorage.getItem(AUTO_COMMIT_SETTINGS_KEY);
            const allSettings = stored ? JSON.parse(stored) : {};
            allSettings[projectId] = newSettings;
            localStorage.setItem(AUTO_COMMIT_SETTINGS_KEY, JSON.stringify(allSettings));
            setSettings(newSettings);
        } catch (error) {
            console.error('Failed to save auto-commit settings:', error);
        }
    }, [projectId]);

    // Update individual setting
    const updateSettings = useCallback((updates: Partial<AutoCommitSettings>) => {
        saveSettings({ ...settings, ...updates });
    }, [settings, saveSettings]);

    // Perform auto-commit
    const performAutoCommit = useCallback(async () => {
        if (!githubSession || !projectId || !linkedRepo) {
            return;
        }

        // Save current editor state first
        saveCurrentEditorState();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get latest project
        const project = ProjectStorageRepository.loadProject(projectId);
        if (!project) {
            console.error('Auto-commit: Could not load project');
            return;
        }

        // Check if there are actual changes
        const hasChanges = await checkForChanges(githubSession, project, linkedRepo);
        if (!hasChanges) {
            console.log('Auto-commit: No changes detected');
            return;
        }

        setIsAutoCommitting(true);

        try {
            const timestamp = new Date().toLocaleString();
            const result = await saveProjectToGitHub(
                githubSession,
                project,
                linkedRepo.owner,
                linkedRepo.repo,
                `Auto-save: ${timestamp}`,
                linkedRepo.branch,
                linkedRepo.filePath
            );

            if (result.success) {
                updateSettings({ lastAutoCommitAt: new Date().toISOString() });
                toast.info('Auto-saved to GitHub', { autoClose: 2000 });
            }
        } catch (error) {
            console.error('Auto-commit failed:', error);
        } finally {
            setIsAutoCommitting(false);
        }
    }, [githubSession, projectId, linkedRepo, saveCurrentEditorState, checkForChanges, saveProjectToGitHub, updateSettings]);

    // Set up interval for auto-commit
    useEffect(() => {
        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Only set up if enabled and all required data is available
        if (settings.enabled && githubSession && projectId && linkedRepo && linkedRepo.lastSyncedAt) {
            const intervalMs = settings.intervalMinutes * 60 * 1000;

            intervalRef.current = setInterval(() => {
                performAutoCommit();
            }, intervalMs);

            console.log(`Auto-commit enabled: every ${settings.intervalMinutes} minutes`);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [settings.enabled, settings.intervalMinutes, githubSession, projectId, linkedRepo, performAutoCommit]);

    return {
        settings,
        updateSettings,
        isAutoCommitting,
        performAutoCommit,
    };
};

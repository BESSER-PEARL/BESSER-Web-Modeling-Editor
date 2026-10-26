import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

// LocalStorage key for auto-commit settings
const AUTO_COMMIT_SETTINGS_KEY = 'besser_github_auto_commit';

export interface AutoCommitSettings {
    enabled: boolean;
    intervalMinutes: number;
    lastAutoCommitAt?: string;
}

interface UseAutoCommitProps {
    projectId: string | null;
    /** The project is linked and GitHub is connected. */
    canCommit: boolean;
    hasLocalChanges: boolean;
    saveCurrentEditorState: () => void;
    /** Commit the model (useRepoSync's save). */
    save: (commitMessage: string) => Promise<{ status: string }>;
}

/**
 * Hook for managing auto-commit functionality.
 * Commits the model to the linked repository at the chosen interval, when it changed.
 */
export const useAutoCommit = ({
    projectId,
    canCommit,
    hasLocalChanges,
    saveCurrentEditorState,
    save,
}: UseAutoCommitProps) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AutoCommitSettings>({
        enabled: false,
        intervalMinutes: 10,
    });
    const [isAutoCommitting, setIsAutoCommitting] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    // Read at tick time: these change on every sync check, which must not restart the interval.
    const hasChangesRef = useRef(hasLocalChanges);
    hasChangesRef.current = hasLocalChanges;
    const saveRef = useRef(save);
    saveRef.current = save;
    const flushRef = useRef(saveCurrentEditorState);
    flushRef.current = saveCurrentEditorState;

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
            let allSettings: Record<string, AutoCommitSettings> = {};
            if (stored) {
                try { allSettings = JSON.parse(stored); } catch { allSettings = {}; }
            }
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
        flushRef.current();
        if (!hasChangesRef.current) {
            return;
        }

        setIsAutoCommitting(true);
        try {
            const timestamp = new Date().toLocaleString();
            const result = await saveRef.current(t('github.toasts.autoSaveCommitMessage', { timestamp }));
            if (result.status !== 'conflict') {
                updateSettings({ lastAutoCommitAt: new Date().toISOString() });
                toast.info(t('github.toasts.autoSaved'), { autoClose: 2000 });
            }
        } catch (error) {
            console.error('Auto-commit failed:', error);
        } finally {
            setIsAutoCommitting(false);
        }
    }, [updateSettings, t]);

    // Set up interval for auto-commit
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (settings.enabled && canCommit) {
            intervalRef.current = setInterval(() => {
                void performAutoCommit();
            }, settings.intervalMinutes * 60 * 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [settings.enabled, settings.intervalMinutes, canCommit, performAutoCommit]);

    return {
        settings,
        updateSettings,
        isAutoCommitting,
        performAutoCommit,
    };
};

import { useState, useRef, useEffect, useCallback } from 'react';
import { Circuit } from '../types';
import { serializeCircuit, deserializeCircuit } from '../utils';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import { QuantumCircuitData, isQuantumCircuitData } from '../../../types/project';

export type SaveStatus = 'saved' | 'saving' | 'error';

interface UseCircuitPersistenceOptions {
    debounceMs?: number;
    autoSaveIntervalMs?: number;
}

interface UseCircuitPersistenceReturn {
    saveStatus: SaveStatus;
    saveCircuit: (circuit: Circuit) => void;
    loadCircuit: () => Circuit;
}

/**
 * Custom hook to handle circuit persistence (load/save to project storage)
 */
export function useCircuitPersistence(
    options: UseCircuitPersistenceOptions = {}
): UseCircuitPersistenceReturn {
    const {
        debounceMs = 1000,
        autoSaveIntervalMs = 30000,
    } = options;

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

    const saveCircuit = useCallback((circuitData: Circuit) => {
        try {
            setSaveStatus('saving');
            const project = ProjectStorageRepository.getCurrentProject();

            if (!project) {
                console.warn('[QuantumEditor] No active project found');
                setSaveStatus('error');
                return;
            }

            // Serialize to Quirk format for compact storage
            const quirkData = serializeCircuit(circuitData);
            const quantumData: QuantumCircuitData = {
                ...quirkData,
                version: '1.0.0'
            };

            // Check if there are actual changes before saving
            const currentModel = project.diagrams.QuantumCircuitDiagram?.model;
            const hasChanges = JSON.stringify(currentModel) !== JSON.stringify(quantumData);

            if (!hasChanges) {
                console.log('[QuantumEditor] No changes detected, skipping save');
                setSaveStatus('saved');
                return;
            }

            const updated = ProjectStorageRepository.updateDiagram(
                project.id,
                'QuantumCircuitDiagram',
                {
                    ...project.diagrams.QuantumCircuitDiagram,
                    model: quantumData,
                    lastUpdate: new Date().toISOString(),
                }
            );

            if (updated) {
                console.log('[QuantumEditor] Circuit saved successfully');
                setSaveStatus('saved');
            } else {
                console.error('[QuantumEditor] Failed to save circuit');
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('[QuantumEditor] Error saving circuit:', error);
            setSaveStatus('error');
        }
    }, []);

    const loadCircuit = useCallback((): Circuit => {
        try {
            const project = ProjectStorageRepository.getCurrentProject();
            const model = project?.diagrams?.QuantumCircuitDiagram?.model;

            if (isQuantumCircuitData(model) && model.cols.length > 0) {
                console.log('[QuantumEditor] Loading circuit from project storage');
                return deserializeCircuit(model);
            }
        } catch (error) {
            console.error('[QuantumEditor] Error loading circuit:', error);
        }

        // Return default empty circuit
        return {
            columns: [],
            qubitCount: 5,
        };
    }, []);

    return {
        saveStatus,
        saveCircuit,
        loadCircuit,
    };
}

/**
 * Hook to handle auto-save functionality
 */
export function useAutoSave(
    circuit: Circuit,
    saveCircuit: (circuit: Circuit) => void,
    options: { debounceMs?: number; intervalMs?: number } = {}
) {
    const { debounceMs = 1000, intervalMs = 30000 } = options;
    const [isInitialized, setIsInitialized] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced save on circuit changes
    useEffect(() => {
        if (!isInitialized) {
            setIsInitialized(true);
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            console.log('[QuantumEditor] Auto-saving circuit (debounced)...');
            saveCircuit(circuit);
        }, debounceMs);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [circuit, saveCircuit, isInitialized, debounceMs]);

    // Periodic auto-save
    useEffect(() => {
        autoSaveIntervalRef.current = setInterval(() => {
            if (isInitialized) {
                console.log('[QuantumEditor] Auto-saving circuit (periodic)...');
                saveCircuit(circuit);
            }
        }, intervalMs);

        return () => {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
            }
        };
    }, [circuit, saveCircuit, isInitialized, intervalMs]);

    // Save before unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isInitialized) {
                console.log('[QuantumEditor] Saving circuit before unload...');
                saveCircuit(circuit);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (isInitialized) {
                saveCircuit(circuit);
            }
        };
    }, [circuit, saveCircuit, isInitialized]);

    return { isInitialized };
}

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
                setSaveStatus('error');
                return;
            }

            // Check if we're about to overwrite a larger circuit with a smaller one
            // This can happen during project switching when stale data is saved
            const currentModel = project.diagrams.QuantumCircuitDiagram?.model;
            if (isQuantumCircuitData(currentModel)) {
                const currentColCount = currentModel.cols?.length || 0;
                const newColCount = circuitData.columns?.length || 0;
                
                // If the new circuit has fewer columns and both have content,
                // this might be stale data from a project switch - skip saving
                if (currentColCount > 0 && newColCount < currentColCount) {
                    setSaveStatus('saved');
                    return;
                }
            }
            
            // Serialize to Quirk format for compact storage
            const quirkData = serializeCircuit(circuitData);
            
            const quantumData: QuantumCircuitData = {
                ...quirkData,
                version: '1.0.0'
            };

            // Check if there are actual changes before saving
            const currentModelStr = JSON.stringify(currentModel);
            const newModelStr = JSON.stringify(quantumData);
            
            if (currentModelStr === newModelStr) {
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
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('[useCircuitPersistence] Error saving circuit:', error);
            setSaveStatus('error');
        }
    }, []);

    const loadCircuit = useCallback((): Circuit => {
        try {
            const project = ProjectStorageRepository.getCurrentProject();
            const model = project?.diagrams?.QuantumCircuitDiagram?.model;

            if (isQuantumCircuitData(model) && model.cols.length > 0) {
                return deserializeCircuit(model);
            }
        } catch (error) {
            console.error('[useCircuitPersistence] Error loading circuit:', error);
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
    projectId: string | undefined,
    options: { debounceMs?: number; intervalMs?: number } = {}
) {
    const { debounceMs = 1000, intervalMs = 30000 } = options;
    const [isInitialized, setIsInitialized] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastProjectIdRef = useRef<string | undefined>(projectId);
    const isProjectSwitchingRef = useRef(false);

    // Track project changes to prevent saving stale data
    useEffect(() => {
        if (lastProjectIdRef.current !== projectId) {
            isProjectSwitchingRef.current = true;
            lastProjectIdRef.current = projectId;
            
            // Clear any pending save
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            
            // Re-enable auto-save after a delay to let the circuit state fully update
            setTimeout(() => {
                isProjectSwitchingRef.current = false;
            }, 2000);
        }
    }, [projectId]);

    // Debounced save on circuit changes
    useEffect(() => {
        if (!isInitialized) {
            setIsInitialized(true);
            return;
        }

        // Don't save during project switch
        if (isProjectSwitchingRef.current) {
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            // Double-check we're not in a project switch
            if (!isProjectSwitchingRef.current) {
                saveCircuit(circuit);
            }
        }, debounceMs);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [circuit, saveCircuit, isInitialized, debounceMs, projectId]);

    // Periodic auto-save
    useEffect(() => {
        autoSaveIntervalRef.current = setInterval(() => {
            if (isInitialized && !isProjectSwitchingRef.current) {
                saveCircuit(circuit);
            }
        }, intervalMs);

        return () => {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
            }
        };
    }, [circuit, saveCircuit, isInitialized, intervalMs, projectId]);

    // Save before unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isInitialized && !isProjectSwitchingRef.current) {
                saveCircuit(circuit);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Don't save on cleanup - this causes issues during project switch
            // The circuit is already auto-saved periodically
        };
    }, [circuit, saveCircuit, isInitialized]);

    return { isInitialized };
}

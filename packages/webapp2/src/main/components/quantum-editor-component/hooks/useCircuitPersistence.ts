import { useState, useRef, useEffect, useCallback } from 'react';
import { Circuit } from '../types';
import { serializeCircuit, deserializeCircuit } from '../utils';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import { QuantumCircuitData, isQuantumCircuitData, BesserProject, getActiveDiagram } from '../../../types/project';

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
    currentProject?: BesserProject | null,
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
            const project = currentProject?.id
                ? ProjectStorageRepository.loadProject(currentProject.id)
                : ProjectStorageRepository.getCurrentProject();

            if (!project) {
                console.error('[saveCircuit] No project found');
                setSaveStatus('error');
                return;
            }
            
            // Serialize to Quirk format for compact storage
            const quirkData = serializeCircuit(circuitData);
            
            // console.log('[saveCircuit] Saving circuit with', circuitData.columns.length, 'columns');
            // console.log('[saveCircuit] gateMetadata keys:', Object.keys(quirkData.gateMetadata || {}));
            
            const quantumData: QuantumCircuitData = {
                ...quirkData,
                version: '1.0.0'
            };

            const updated = ProjectStorageRepository.updateDiagram(
                project.id,
                'QuantumCircuitDiagram',
                {
                    ...(getActiveDiagram(project, 'QuantumCircuitDiagram') ?? {}),
                    model: quantumData,
                    lastUpdate: new Date().toISOString(),
                }
            );

            if (updated) {
                // Redux sync happens automatically via useStorageSync
                setSaveStatus('saved');
            } else {
                console.error('[saveCircuit] updateDiagram returned false');
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('[useCircuitPersistence] Error saving circuit:', error);
            setSaveStatus('error');
        }
    }, [currentProject?.id]);

    const loadCircuit = useCallback((): Circuit => {
        try {
            const project = currentProject?.id
                ? ProjectStorageRepository.loadProject(currentProject.id)
                : ProjectStorageRepository.getCurrentProject();
            const quantumDiagram = project ? getActiveDiagram(project, 'QuantumCircuitDiagram') : undefined;
            const model = quantumDiagram?.model;

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
    }, [currentProject?.id]);

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
    const projectSwitchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Keep a ref to the latest circuit and saveCircuit so interval/unload
    // always use current values without restarting the interval.
    const circuitRef = useRef(circuit);
    circuitRef.current = circuit;
    const saveCircuitRef = useRef(saveCircuit);
    saveCircuitRef.current = saveCircuit;

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

            // Clear any previous project switch timer
            if (projectSwitchTimerRef.current) {
                clearTimeout(projectSwitchTimerRef.current);
            }

            // Re-enable auto-save after a delay to let the circuit state fully update
            projectSwitchTimerRef.current = setTimeout(() => {
                isProjectSwitchingRef.current = false;
            }, 2000);
        }

        return () => {
            if (projectSwitchTimerRef.current) {
                clearTimeout(projectSwitchTimerRef.current);
                projectSwitchTimerRef.current = null;
            }
        };
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
                saveCircuitRef.current(circuitRef.current);
            }
        }, debounceMs);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [circuit, isInitialized, debounceMs, projectId]);

    // Periodic auto-save — uses refs so the interval doesn't need to restart
    // on every circuit change.
    useEffect(() => {
        if (!isInitialized) return;

        autoSaveIntervalRef.current = setInterval(() => {
            if (!isProjectSwitchingRef.current) {
                saveCircuitRef.current(circuitRef.current);
            }
        }, intervalMs);

        return () => {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
                autoSaveIntervalRef.current = null;
            }
        };
    }, [isInitialized, intervalMs, projectId]);

    // Save before unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isInitialized && !isProjectSwitchingRef.current) {
                saveCircuitRef.current(circuitRef.current);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isInitialized]);

    return { isInitialized };
}

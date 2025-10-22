import { useCallback } from 'react';
import { localStorageDiagramPrefix, localStorageDiagramsList, localStorageLatest } from '../../constant';
import { Diagram } from '../diagram/diagramSlice';
import { useAppDispatch } from '../../components/store/hooks';
import { displayError } from '../error-management/errorManagementSlice';

export const useLocalStorage = () => {
  const dispatch = useAppDispatch();

  const loadDiagram = useCallback((id: string): Diagram | null => {
    const localStorageContent = localStorage.getItem(localStorageDiagramPrefix + id);
    if (localStorageContent) {
      const diagram: Diagram = JSON.parse(localStorageContent);
      return diagram;
    } else {
      console.error(`The diagram with id ${id} could not be found in local storage.`);
      dispatch(
        displayError('Could not load diagram', `The diagram with id ${id} could not be found in local storage.`),
      );
      return null;
    }
  }, []);

  return loadDiagram;
};

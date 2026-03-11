import React from 'react';

import { ErrorMessage } from './error-message';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { dismissError, selectErrors } from '../../services/error-management/errorManagementSlice';
import { Z_INDEX } from '../../constants/z-index';

export const ErrorPanel: React.FC = () => {
  const errors = useAppSelector(selectErrors);
  const dispatch = useAppDispatch();

  return (
    <div className="pointer-events-none fixed right-3 top-3 flex w-[min(420px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-4 sm:top-4" style={{ zIndex: Z_INDEX.NOTIFICATION }}>
      {errors.map((error) => (
        <div className="pointer-events-auto" key={error.id}>
          <ErrorMessage error={error} onClose={(apollonError) => dispatch(dismissError(apollonError.id))} />
        </div>
      ))}
    </div>
  );
};

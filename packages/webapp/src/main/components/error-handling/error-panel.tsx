import React from 'react';
import styled from 'styled-components';

import { ErrorMessage } from './error-message';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dismissError } from '../../services/error-management/errorManagementSlice';

export const ErrorPanel: React.FC = () => {
  const errors = useAppSelector((state) => state.errors);
  const dispatch = useAppDispatch();
  return (
    <>
      {errors.map((error, index) => (
        <ErrorMessage error={error} onClose={(apollonError) => dispatch(dismissError(apollonError.id))} key={index} />
      ))}
    </>
  );
};

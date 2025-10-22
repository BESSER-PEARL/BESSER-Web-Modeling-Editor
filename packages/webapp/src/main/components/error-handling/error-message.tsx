import React, { useState } from 'react';
import { Alert } from 'react-bootstrap';
import { ApollonError } from '../../services/error-management/errorManagementSlice';

type Props = {
  error: ApollonError;
  onClose: (error: ApollonError) => void;
};

export function ErrorMessage(props: Props) {
  const [show, setShow] = useState(true);

  const { headerText, bodyText } = props.error;

  return (
    <Alert
      show={show}
      variant="danger"
      onClose={() => {
        props.onClose(props.error);
        setShow(false);
      }}
      dismissible
    >
      <Alert.Heading>{headerText}</Alert.Heading>
      <p>{bodyText}</p>
    </Alert>
  );
}

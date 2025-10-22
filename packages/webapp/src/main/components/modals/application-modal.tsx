import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from 'react-bootstrap';
import { ApplicationModalContent } from './application-modal-content';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { hideModal } from '../../services/modal/modalSlice';

export const ApplicationModal = () => {
  const [isClosable, setIsClosable] = useState(true);
  const displayModal = useAppSelector((state) => state.modal.type);
  const modalSize = useAppSelector((state) => state.modal.size);
  const dispatch = useAppDispatch();

  const onClosableChange = (closable: boolean) => {
    setIsClosable(closable);
  };

  const handleClose = () => {
    if (isClosable) {
      dispatch(hideModal());
    }
  };

  const closeModal = () => {
    dispatch(hideModal());
  };

  if (!displayModal) {
    // Problem: when returned null the listeners are still kept at the document level to close the modal -> they hinder dropdowns to open
    // -> dropdowns: on show -> stopPropagation
    // if this is resolved at some point, the visibility management in menus can be removed
    return null;
  }

  const ModalContent = ApplicationModalContent[displayModal];

  return createPortal(
    <Modal
      id="application-modal"
      aria-labelledby="application-modal"
      size={modalSize}
      centered
      show
      onHide={handleClose}
    >
      <ModalContent close={closeModal} onClosableChange={onClosableChange} />
    </Modal>,
    document.body,
  );
};

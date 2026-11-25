import React, { useState } from 'react';
import styled from 'styled-components';

const OpenEditorBtn = styled.button`
  display: block;
  width: 100%;
  margin-top: 3px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid ${(p: any) => p.theme.color.gray};
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: ${(p: any) => p.theme.color.primary};
  text-align: center;
  letter-spacing: 0.2px;
  &:hover {
    background: ${(p: any) => p.theme.color.primary}18;
    border-color: ${(p: any) => p.theme.color.primary};
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Dialog = styled.div`
  background: ${(p: any) => p.theme.color.background};
  border: 1px solid ${(p: any) => p.theme.color.gray};
  border-radius: 8px;
  padding: 16px;
  width: min(600px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
`;

const DialogTitle = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
`;

const BigTextarea = styled.textarea`
  width: 100%;
  min-height: 200px;
  max-height: 60vh;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid ${(p: any) => p.theme.color.gray};
  border-radius: 4px;
  background: ${(p: any) => p.theme.color.background};
  color: ${(p: any) => p.theme.font.color};
  font-size: 13px;
  font-family: ${(p: any) => p.theme.font.family};
  line-height: 1.5;
  box-sizing: border-box;
  outline: none;
  &:focus {
    border-color: ${(p: any) => p.theme.color.primary};
  }
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const DialogBtn = styled.button<{ primary?: boolean }>`
  padding: 5px 16px;
  background: ${(p: any) => (p.primary ? p.theme.color.primary : 'transparent')};
  color: ${(p: any) => (p.primary ? '#fff' : 'inherit')};
  border: ${(p: any) => (p.primary ? 'none' : `1px solid ${p.theme.color.gray}`)};
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  &:hover {
    opacity: 0.85;
  }
`;

type Props = {
  value: string;
  onSave: (v: string) => void;
  label?: string;
  children: React.ReactNode;
};

export const ExpandableTextfield = ({ value, onSave, label, children }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setOpen(false);
  };

  return (
    <>
      {children}
      <OpenEditorBtn type="button" onClick={handleOpen}>
        ✎ Open text editor
      </OpenEditorBtn>
      {open && (
        <Overlay onClick={handleOverlayClick}>
          <Dialog onClick={(e) => e.stopPropagation()}>
            {label && <DialogTitle>{label}</DialogTitle>}
            <BigTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <DialogBtn type="button" onClick={() => setOpen(false)}>
                Cancel
              </DialogBtn>
              <DialogBtn type="button" primary onClick={handleSave}>
                Save
              </DialogBtn>
            </DialogFooter>
          </Dialog>
        </Overlay>
      )}
    </>
  );
};

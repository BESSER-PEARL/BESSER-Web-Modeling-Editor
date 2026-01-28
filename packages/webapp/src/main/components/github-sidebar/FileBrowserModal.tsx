import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, ListGroup, Breadcrumb, Spinner } from 'react-bootstrap';
import { Folder, FileEarmark, ArrowUp, Check2 } from 'react-bootstrap-icons';
import styled from 'styled-components';
import { GitHubContentItem } from '../../services/github/useGitHubStorage';

const FileItem = styled(ListGroup.Item)`
  cursor: pointer;
  display: flex;
  align-items: center;
  &:hover {
    background-color: var(--apollon-background-secondary, #f8f9fa);
  }
  
  &.selected {
    background-color: var(--apollon-primary-light, #e7f1ff);
    border-color: var(--apollon-primary, #0d6efd);
  }
`;

const FileIcon = styled.div`
  margin-right: 10px;
  color: var(--apollon-text-secondary, #6c757d);
`;

const FileName = styled.div`
  flex: 1;
`;

interface FileBrowserModalProps {
    show: boolean;
    onHide: () => void;
    onSelect: (path: string) => void;
    fetchContents: (path: string) => Promise<GitHubContentItem[]>;
    title?: string;
    selectMode?: 'file' | 'dir'; // What can be selected
    initialPath?: string;
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
    show,
    onHide,
    onSelect,
    fetchContents,
    title = 'Select File',
    selectMode = 'file',
    initialPath = '',
}) => {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [contents, setContents] = useState<GitHubContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<GitHubContentItem | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (show) {
            setCurrentPath(initialPath);
            setSelectedItem(null);
            loadContents(initialPath);
        }
    }, [show, initialPath]);

    const loadContents = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const items = await fetchContents(path);
            setContents(items);
        } catch (err) {
            setError('Failed to load directory contents');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = (item: GitHubContentItem) => {
        if (item.type === 'dir') {
            // If selecting directories, we can select this
            if (selectMode === 'dir') {
                setSelectedItem(item);
            }
            // But clicking usually means "enter directory"
            // We'll use double click or a separate button to enter? 
            // Standard behavior: click to select, double click to enter.
            // For now: click enters directory immediately if it's a dir, unless we are in dir selection mode?
            // Let's make it: Click enters directory. To select a directory, you navigate INTO it and click "Select Current Folder" or similar?
            // Or: Click selects, Double click enters.

            // Let's go with: Click enters directory.
            setCurrentPath(item.path);
            loadContents(item.path);
            setSelectedItem(null); // Deselect when changing dir
        } else {
            // It's a file
            if (selectMode === 'file') {
                setSelectedItem(item);
            }
        }
    };

    const handleNavigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/');
        setCurrentPath(newPath);
        loadContents(newPath);
        setSelectedItem(null);
    };

    const handleBreadcrumbClick = (index: number) => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        const newPath = parts.slice(0, index + 1).join('/');
        setCurrentPath(newPath);
        loadContents(newPath);
        setSelectedItem(null);
    };

    const handleConfirm = () => {
        if (selectMode === 'file' && selectedItem) {
            onSelect(selectedItem.path);
            onHide();
        } else if (selectMode === 'dir') {
            // If we are selecting a directory, we return the current path
            onSelect(currentPath);
            onHide();
        }
    };

    // Breadcrumbs generation
    const renderBreadcrumbs = () => {
        const parts = currentPath ? currentPath.split('/') : [];
        return (
            <Breadcrumb className="mb-2" style={{ fontSize: '0.9rem' }}>
                <Breadcrumb.Item
                    active={parts.length === 0}
                    onClick={() => {
                        if (parts.length > 0) {
                            setCurrentPath('');
                            loadContents('');
                            setSelectedItem(null);
                        }
                    }}
                >
                    root
                </Breadcrumb.Item>
                {parts.map((part, index) => (
                    <Breadcrumb.Item
                        key={index}
                        active={index === parts.length - 1}
                        onClick={() => handleBreadcrumbClick(index)}
                    >
                        {part}
                    </Breadcrumb.Item>
                ))}
            </Breadcrumb>
        );
    };

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {renderBreadcrumbs()}

                {currentPath && (
                    <div className="mb-2">
                        <Button
                            variant="light"
                            size="sm"
                            onClick={handleNavigateUp}
                            className="text-muted"
                        >
                            <ArrowUp size={14} className="me-1" /> Up one level
                        </Button>
                    </div>
                )}

                <div style={{ height: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                    {loading ? (
                        <div className="d-flex justify-content-center align-items-center h-100">
                            <Spinner animation="border" size="sm" />
                        </div>
                    ) : error ? (
                        <div className="text-danger p-3 text-center">{error}</div>
                    ) : contents.length === 0 ? (
                        <div className="text-muted p-3 text-center">Empty directory</div>
                    ) : (
                        <ListGroup variant="flush">
                            {contents.map((item) => (
                                <FileItem
                                    key={item.sha}
                                    className={selectedItem?.sha === item.sha ? 'selected' : ''}
                                    onClick={() => handleItemClick(item)}
                                >
                                    <FileIcon>
                                        {item.type === 'dir' ? <Folder /> : <FileEarmark />}
                                    </FileIcon>
                                    <FileName>{item.name}</FileName>
                                    {selectedItem?.sha === item.sha && <Check2 className="text-primary" />}
                                </FileItem>
                            ))}
                        </ListGroup>
                    )}
                </div>

                {selectMode === 'dir' && (
                    <div className="mt-2 text-muted small">
                        Navigate to the folder you want to select and click "Select Current Folder".
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleConfirm}
                    disabled={selectMode === 'file' && !selectedItem}
                >
                    {selectMode === 'dir' ? 'Select Current Folder' : 'Select File'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

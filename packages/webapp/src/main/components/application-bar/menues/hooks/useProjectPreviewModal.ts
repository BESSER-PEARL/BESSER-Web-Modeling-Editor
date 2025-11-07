import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { BesserProject } from '../../../../types/project';

interface PreviewModalParams {
  project: BesserProject;
  jsonContent: string;
  diagramLabel: string;
}

export const useProjectPreviewModal = (
  generateProjectBumlPreview: (project: BesserProject) => Promise<string>,
) => {
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [jsonToView, setJsonToView] = useState('');
  const [jsonDiagramType, setJsonDiagramType] = useState('');
  const [projectForPreview, setProjectForPreview] = useState<BesserProject | null>(null);
  const [bumlPreview, setBumlPreview] = useState('');
  const [bumlPreviewError, setBumlPreviewError] = useState('');
  const [isBumlPreviewLoading, setIsBumlPreviewLoading] = useState(false);

  const resetBumlState = useCallback(() => {
    setBumlPreview('');
    setBumlPreviewError('');
    setIsBumlPreviewLoading(false);
  }, []);

  const openPreviewModal = useCallback(
    ({ project, jsonContent, diagramLabel }: PreviewModalParams) => {
      setProjectForPreview(project);
      setJsonToView(jsonContent);
      setJsonDiagramType(diagramLabel);
      resetBumlState();
      setShowJsonViewer(true);
    },
    [resetBumlState],
  );

  const closePreviewModal = useCallback(() => {
    setShowJsonViewer(false);
    setProjectForPreview(null);
    setJsonToView('');
    setJsonDiagramType('');
    resetBumlState();
  }, [resetBumlState]);

  const handleCopyJson = useCallback(() => {
    if (!jsonToView) {
      toast.error('No JSON content available to copy.');
      return;
    }

    navigator.clipboard
      .writeText(jsonToView)
      .then(() => toast.success('JSON copied to clipboard!'))
      .catch(() => toast.error('Failed to copy JSON to clipboard'));
  }, [jsonToView]);

  const handleDownloadJson = useCallback(() => {
    if (!projectForPreview) {
      toast.error('No project found to download.');
      return;
    }

    const normalizedName = projectForPreview.name.replace(/\s+/g, '_');
    const blob = new Blob([jsonToView], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizedName}_project.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Project JSON downloaded!');
  }, [jsonToView, projectForPreview]);

  const handleRequestBumlPreview = useCallback(async () => {
    if (!projectForPreview) {
      const message = 'Project data is not available. Re-open the preview and try again.';
      setBumlPreviewError(message);
      toast.error(message);
      return;
    }

    setBumlPreview('');
    setBumlPreviewError('');
    setIsBumlPreviewLoading(true);
    try {
      const bumlText = await generateProjectBumlPreview(projectForPreview);
      setBumlPreview(bumlText);
      toast.success('B-UML preview generated!');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate B-UML preview.';
      setBumlPreviewError(message);
      toast.error(`Failed to generate B-UML preview: ${message}`);
    } finally {
      setIsBumlPreviewLoading(false);
    }
  }, [generateProjectBumlPreview, projectForPreview]);

  const handleCopyBumlPreview = useCallback(() => {
    if (!bumlPreview) {
      toast.error('No B-UML preview to copy.');
      return;
    }

    navigator.clipboard
      .writeText(bumlPreview)
      .then(() => toast.success('B-UML copied to clipboard!'))
      .catch(() => toast.error('Failed to copy B-UML to clipboard'));
  }, [bumlPreview]);

  const handleDownloadBumlPreview = useCallback(() => {
    if (!projectForPreview) {
      toast.error('No project found to download.');
      return;
    }

    if (!bumlPreview) {
      toast.error('No B-UML preview to download.');
      return;
    }

    const normalizedName =
      projectForPreview.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') ||
      'project';

    const blob = new Blob([bumlPreview], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizedName}_preview.py`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('B-UML preview downloaded!');
  }, [bumlPreview, projectForPreview]);

  const canPreviewBuml = Boolean(projectForPreview);

  const bumlPreviewLabel = useMemo(() => {
    if (!projectForPreview?.name) {
      return 'Project B-UML';
    }
    return `Project B-UML Preview (${projectForPreview.name})`;
  }, [projectForPreview]);

  return {
    showJsonViewer,
    jsonToView,
    jsonDiagramType,
    bumlPreview,
    bumlPreviewError,
    isBumlPreviewLoading,
    canPreviewBuml,
    bumlPreviewLabel,
    openPreviewModal,
    closePreviewModal,
    handleCopyJson,
    handleDownloadJson,
    handleRequestBumlPreview,
    handleCopyBumlPreview,
    handleDownloadBumlPreview,
  };
};

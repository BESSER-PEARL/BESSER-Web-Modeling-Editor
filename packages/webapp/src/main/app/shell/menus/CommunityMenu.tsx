import React from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bugReportURL } from '../../../shared/constants/constant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommunityMenuProps {
  outlineButtonClass: string;
  onOpenFeedback: () => void;
}

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
  survey: 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform',
};

export const CommunityMenu: React.FC<CommunityMenuProps> = ({
  outlineButtonClass,
  onOpenFeedback,
}) => {
  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title="Community">
          <Users className="size-4" />
          <span className="hidden xl:inline">Community</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.contribute)}>Contribute</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.repository)}>GitHub Repository</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFeedback}>Send Feedback</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.survey)}>User Evaluation Survey</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(bugReportURL)}>Report a Problem</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

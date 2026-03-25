import React from 'react';
import { Keyboard, Users, PlayCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bugReportURL } from '../../../constants/constant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommunityMenuProps {
  outlineButtonClass: string;
  onOpenFeedback: () => void;
  onOpenHelpDialog: () => void;
  onOpenAboutDialog: () => void;
  onOpenKeyboardShortcuts: () => void;
  onShowWelcomeGuide?: () => void;
}

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
  survey: 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform',
};

export const CommunityMenu: React.FC<CommunityMenuProps> = ({
  outlineButtonClass,
  onOpenFeedback,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenKeyboardShortcuts,
  onShowWelcomeGuide,
}) => {
  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title="Community & Help">
          <Users className="size-4" />
          <span className="hidden xl:inline">Help</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Community
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.contribute)}>Contribute</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.repository)}>GitHub Repository</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFeedback}>Send Feedback</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.survey)}>User Evaluation Survey</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(bugReportURL)}>Report a Problem</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Help
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onOpenHelpDialog}>How does this editor work?</DropdownMenuItem>
        {onShowWelcomeGuide && (
          <DropdownMenuItem onClick={onShowWelcomeGuide}>
            <PlayCircle className="mr-2 size-4" />
            Start Tutorial
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenKeyboardShortcuts}>
          <Keyboard className="mr-2 size-4" />
          Keyboard Shortcuts
          <span className="ml-auto text-xs text-muted-foreground">?</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAboutDialog}>About BESSER</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

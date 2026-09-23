import React, { useState } from 'react';
import type { BesserProject } from '../../shared/types/project';
import type { AgentRuntimeConfig } from '../../shared/services/storage/local-storage-repository';
import { useAgentRuntimeForm } from './runtime/useAgentRuntimeForm';
import { RuntimeSidebar, type RuntimeSection } from './runtime/RuntimeSidebar';
import { RuntimeSettingsSection } from './runtime/sections/RuntimeSettingsSection';
import { AgentConfigSection } from './runtime/sections/AgentConfigSection';
import { NlpSection } from './runtime/sections/NlpSection';
import { WebSocketSection } from './runtime/sections/WebSocketSection';
import { TelegramSection } from './runtime/sections/TelegramSection';
import { GitPlatformSection } from './runtime/sections/GitPlatformSection';
import { A2ASection } from './runtime/sections/A2ASection';
import { DatabaseSection } from './runtime/sections/DatabaseSection';
import { CustomYamlSection } from './runtime/sections/CustomYamlSection';
import { RawYamlSection } from './runtime/sections/RawYamlSection';

export interface AgentRuntimePanelProps {
  currentProject: BesserProject | null;
  agentRuntimeConfig: AgentRuntimeConfig;
  updateAgentRuntimeConfig: (updates: Partial<AgentRuntimeConfig>) => void;
  agentLLMElements: Array<{ id: string; name: string }>;
}

/**
 * Agent runtime settings (platform, intent recognition) and the config-file form, one section
 * at a time. Each section lives in ./runtime/sections; form state in useAgentRuntimeForm.
 */
export function AgentRuntimePanel({
  currentProject,
  agentRuntimeConfig,
  updateAgentRuntimeConfig,
  agentLLMElements,
}: AgentRuntimePanelProps) {
  const [activeSection, setActiveSection] = useState<RuntimeSection>('runtime');
  const runtime = useAgentRuntimeForm(currentProject);

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="mx-auto flex max-w-6xl min-h-full">

      <RuntimeSidebar activeSection={activeSection} onSelect={setActiveSection} runtime={runtime} />

      <div className="flex-1 min-w-0">
        <div className="px-8 py-6 space-y-4">
          {activeSection === 'runtime' && (
            <RuntimeSettingsSection
              agentRuntimeConfig={agentRuntimeConfig}
              updateAgentRuntimeConfig={updateAgentRuntimeConfig}
              agentLLMElements={agentLLMElements}
            />
          )}
          {activeSection === 'config-agent' && <AgentConfigSection runtime={runtime} />}
          {activeSection === 'config-nlp' && <NlpSection runtime={runtime} />}
          {activeSection === 'config-platform-websocket' && <WebSocketSection runtime={runtime} />}
          {activeSection === 'config-platform-telegram' && <TelegramSection runtime={runtime} />}
          {activeSection === 'config-platform-github' && <GitPlatformSection runtime={runtime} platform="github" />}
          {activeSection === 'config-platform-gitlab' && <GitPlatformSection runtime={runtime} platform="gitlab" />}
          {activeSection === 'config-platform-a2a' && <A2ASection runtime={runtime} />}
          {activeSection === 'config-database' && <DatabaseSection runtime={runtime} />}
          {activeSection === 'config-custom' && <CustomYamlSection runtime={runtime} />}
          {activeSection === 'config-raw' && <RawYamlSection runtime={runtime} />}
        </div>
      </div>
    </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from '../../services/local-storage/local-storage-types';

export const AgentPersonalizationMappingPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<StoredUserProfile[]>([]);
  const [configurations, setConfigurations] = useState<StoredAgentConfiguration[]>([]);
  const [mappings, setMappings] = useState<StoredAgentProfileConfigurationMapping[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedConfigurationId, setSelectedConfigurationId] = useState('');

  const refreshData = useCallback(() => {
    const nextProfiles = LocalStorageRepository.getUserProfiles();
    const nextConfigurations = LocalStorageRepository.getAgentConfigurations();
    const nextMappings = LocalStorageRepository.getAgentProfileConfigurationMappings();

    setProfiles(nextProfiles);
    setConfigurations(nextConfigurations);
    setMappings(nextMappings);

    setSelectedProfileId((previous) => {
      if (previous && nextProfiles.some((entry) => entry.id === previous)) {
        return previous;
      }
      return nextProfiles[0]?.id || '';
    });

    setSelectedConfigurationId((previous) => {
      if (previous && nextConfigurations.some((entry) => entry.id === previous)) {
        return previous;
      }
      return nextConfigurations[0]?.id || '';
    });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const selectedProfile = useMemo(
    () => profiles.find((entry) => entry.id === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );
  const selectedConfiguration = useMemo(
    () => configurations.find((entry) => entry.id === selectedConfigurationId) || null,
    [configurations, selectedConfigurationId],
  );

  const handleCreateMapping = () => {
    if (!selectedProfile || !selectedConfiguration) {
      toast.error('Select both a user profile and an agent configuration.');
      return;
    }

    LocalStorageRepository.saveAgentProfileConfigurationMapping(selectedProfile, selectedConfiguration);
    refreshData();
    toast.success(`Saved mapping: ${selectedProfile.name} -> ${selectedConfiguration.name}`);
  };

  const handleDeleteMapping = (mappingId: string) => {
    LocalStorageRepository.deleteAgentProfileConfigurationMapping(mappingId);
    refreshData();
    toast.success('Mapping removed.');
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Personalization Mappings</CardTitle>
            <CardDescription>
              Link stored user profiles to stored agent configurations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mapping-profile">User Profile</Label>
                <select
                  id="mapping-profile"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                >
                  {profiles.length === 0 && <option value="">No stored profiles</option>}
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mapping-configuration">Agent Configuration</Label>
                <select
                  id="mapping-configuration"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedConfigurationId}
                  onChange={(event) => setSelectedConfigurationId(event.target.value)}
                >
                  {configurations.length === 0 && <option value="">No stored configurations</option>}
                  {configurations.map((configuration) => (
                    <option key={configuration.id} value={configuration.id}>
                      {configuration.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateMapping} disabled={!selectedProfile || !selectedConfiguration}>
                Save Mapping
              </Button>
              <Button variant="outline" onClick={refreshData}>
                Refresh
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              {mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved mappings yet.</p>
              ) : (
                mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{mapping.userProfileName}</span>
                      <span className="mx-1 text-muted-foreground">-&gt;</span>
                      <span>{mapping.agentConfigurationName}</span>
                      <div className="text-xs text-muted-foreground">
                        Saved {new Date(mapping.savedAt).toLocaleString()}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => handleDeleteMapping(mapping.id)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

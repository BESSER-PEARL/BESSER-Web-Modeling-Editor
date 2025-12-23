import React, { useCallback, useMemo, useState } from 'react';
import { Card, Form, Button, Row, Col, Table, Badge } from 'react-bootstrap';
import styled from 'styled-components';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from '../../services/local-storage/local-storage-types';

const PageContainer = styled.div`
  padding: 32px 40px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-y: auto;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
  h1 {
    margin: 0 0 8px 0;
    font-weight: 700;
    font-size: 2rem;
    color: var(--apollon-primary-contrast);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  p {
    margin: 0;
    color: var(--apollon-secondary);
    font-size: 1rem;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  width: 100%;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const Section = styled.div`
  background: var(--apollon-background);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const SectionTitle = styled.h5`
  color: var(--apollon-primary-contrast);
  margin: 0 0 20px 0;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '';
    width: 4px;
    height: 20px;
    background: var(--apollon-primary);
    border-radius: 2px;
  }
`;

const MappingCard = styled.div`
  background: var(--apollon-background-variant, #f8f9fa);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--apollon-primary);
  }
`;

const MappingInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MappingLabel = styled.span`
  font-weight: 600;
  color: var(--apollon-primary-contrast);
`;

const MappingSubLabel = styled.span`
  font-size: 0.85rem;
  color: var(--apollon-secondary);
`;

const AgentCard = styled.div`
  width: 100%;
  background-color: var(--apollon-background);
`;

const CardHeader = styled.div`
  display: none;
`;

const CardBody = styled.div`
  padding: 0;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const StyledButton = styled(Button)`
  padding: 10px 24px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  color: var(--apollon-secondary);
  font-style: italic;
`;

const StyledTable = styled(Table)`
  margin-bottom: 0;
  
  th {
    border-top: none;
    font-weight: 600;
    color: var(--apollon-primary-contrast);
    padding: 12px 16px;
    background: var(--apollon-background-variant, #f8f9fa);
  }
  
  td {
    padding: 12px 16px;
    vertical-align: middle;
  }
  
  tbody tr {
    transition: background 0.2s ease;
    
    &:hover {
      background: var(--apollon-background-variant, #f8f9fa);
    }
  }
`;

export const AgentPersonalizationMappingScreen: React.FC = () => {
  const initialProfiles = useMemo(() => LocalStorageRepository.getUserProfiles(), []);
  const initialConfigs = useMemo(() => LocalStorageRepository.getAgentConfigurations(), []);
  const initialMappings = useMemo(() => LocalStorageRepository.getAgentProfileConfigurationMappings(), []);

  const [profiles, setProfiles] = useState<StoredUserProfile[]>(initialProfiles);
  const [configs, setConfigs] = useState<StoredAgentConfiguration[]>(initialConfigs);
  const [mappings, setMappings] = useState<StoredAgentProfileConfigurationMapping[]>(initialMappings);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfiles[0]?.id || '');
  const [selectedConfigId, setSelectedConfigId] = useState<string>(initialConfigs[0]?.id || '');

  const canCreateMapping = Boolean(selectedProfileId && selectedConfigId);

  const refreshLists = useCallback(() => {
    const latestProfiles = LocalStorageRepository.getUserProfiles();
    setProfiles(latestProfiles);
    if (latestProfiles.length === 0) {
      setSelectedProfileId('');
    } else if (!latestProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(latestProfiles[0].id);
    }

    const latestConfigs = LocalStorageRepository.getAgentConfigurations();
    setConfigs(latestConfigs);
    if (latestConfigs.length === 0) {
      setSelectedConfigId('');
    } else if (!latestConfigs.some((config) => config.id === selectedConfigId)) {
      setSelectedConfigId(latestConfigs[0].id);
    }

    setMappings(LocalStorageRepository.getAgentProfileConfigurationMappings());
  }, [selectedProfileId, selectedConfigId]);

  const handleAddMapping = useCallback(() => {
    if (!selectedProfileId || !selectedConfigId) {
      alert('Select both a user profile and a configuration.');
      return;
    }

    const profile = profiles.find((entry) => entry.id === selectedProfileId);
    const config = configs.find((entry) => entry.id === selectedConfigId);
    if (!profile) {
      alert('Selected user profile is no longer available. Please refresh.');
      return;
    }
    if (!config) {
      alert('Selected agent configuration is no longer available. Please refresh.');
      return;
    }

    LocalStorageRepository.saveAgentProfileConfigurationMapping(profile, config);
    setMappings(LocalStorageRepository.getAgentProfileConfigurationMappings());
    alert(`${profile.name} is now linked to ${config.name}.`);
  }, [selectedProfileId, selectedConfigId, profiles, configs]);

  const handleRemoveMapping = useCallback((mappingId: string) => {
    LocalStorageRepository.deleteAgentProfileConfigurationMapping(mappingId);
    setMappings(LocalStorageRepository.getAgentProfileConfigurationMappings());
  }, []);

  const resolveProfileLabel = useCallback((mapping: StoredAgentProfileConfigurationMapping) => {
    const current = profiles.find((profile) => profile.id === mapping.userProfileId);
    return current?.name || mapping.userProfileName || 'Unknown profile';
  }, [profiles]);

  const resolveConfigurationLabel = useCallback((mapping: StoredAgentProfileConfigurationMapping) => {
    const current = configs.find((config) => config.id === mapping.agentConfigurationId);
    return current?.name || mapping.agentConfigurationName || 'Unknown configuration';
  }, [configs]);

  return (
    <PageContainer>
      <PageHeader>
        <h1>🔗 Profile Mappings</h1>
        <p>Link user profiles to agent configurations for personalized experiences</p>
      </PageHeader>
      
      <ContentGrid>
        <Section>
          <SectionTitle>Create New Mapping</SectionTitle>
          <p className="text-muted mb-4">Choose a user profile and the agent configuration it should activate.</p>
          
          <Form.Group className="mb-3">
            <Form.Label>User Profile</Form.Label>
            <Form.Select
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
              disabled={profiles.length === 0}
            >
              {profiles.length === 0 && <option value="">No user profiles saved yet</option>}
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Agent Configuration</Form.Label>
            <Form.Select
              value={selectedConfigId}
              onChange={(event) => setSelectedConfigId(event.target.value)}
              disabled={configs.length === 0}
            >
              {configs.length === 0 && <option value="">No agent configurations saved yet</option>}
              {configs.map((config) => (
                <option key={config.id} value={config.id}>{config.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <div className="d-flex gap-2 mt-4">
            <StyledButton variant="primary" onClick={handleAddMapping} disabled={!canCreateMapping}>
              Create Mapping
            </StyledButton>
            <StyledButton variant="outline-secondary" onClick={refreshLists}>
              Refresh Lists
            </StyledButton>
          </div>
        </Section>

        <Section>
          <SectionTitle>Saved Mappings</SectionTitle>
          {mappings.length === 0 ? (
            <EmptyState>No mappings stored yet. Create one to get started.</EmptyState>
          ) : (
            <>
              {mappings.map((mapping) => {
                const profileMissing = !profiles.some((profile) => profile.id === mapping.userProfileId);
                const configurationMissing = !configs.some((config) => config.id === mapping.agentConfigurationId);
                return (
                  <MappingCard key={mapping.id}>
                    <MappingInfo>
                      <MappingLabel>
                        {resolveProfileLabel(mapping)}
                        {profileMissing && (
                          <Badge bg="warning" text="dark" className="ms-2">Missing</Badge>
                        )}
                      </MappingLabel>
                      <MappingSubLabel>
                        → {resolveConfigurationLabel(mapping)}
                        {configurationMissing && (
                          <Badge bg="warning" text="dark" className="ms-2">Missing</Badge>
                        )}
                      </MappingSubLabel>
                      <MappingSubLabel style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        Updated: {new Date(mapping.savedAt).toLocaleString()}
                      </MappingSubLabel>
                    </MappingInfo>
                    <Button variant="outline-danger" size="sm" onClick={() => handleRemoveMapping(mapping.id)} style={{ borderRadius: '6px' }}>
                      Remove
                    </Button>
                  </MappingCard>
                );
              })}
            </>
          )}
        </Section>
      </ContentGrid>
    </PageContainer>
  );
};

export default AgentPersonalizationMappingScreen;

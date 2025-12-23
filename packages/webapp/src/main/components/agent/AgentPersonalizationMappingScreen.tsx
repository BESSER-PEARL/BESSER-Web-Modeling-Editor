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
  padding: 40px 20px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const AgentCard = styled(Card)`
  width: 100%;
  max-width: 900px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 16px;
  overflow: hidden;
  background-color: var(--apollon-background);
`;

const CardHeader = styled(Card.Header)`
  background: var(--apollon-primary);
  color: var(--apollon-primary-contrast);
  border: none;
  padding: 24px 32px;
  h3 {
    margin: 0;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--apollon-primary-contrast);
  }
`;

const CardBody = styled(Card.Body)`
  padding: 24px;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const SectionTitle = styled.h5`
  color: var(--apollon-primary-contrast);
  margin-bottom: 20px;
  font-weight: 600;
  border-bottom: 2px solid var(--apollon-switch-box-border-color);
  padding-bottom: 8px;
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
      <AgentCard>
        <CardHeader>
          <h3>Agent Personalization 2</h3>
        </CardHeader>
        <CardBody>
          <SectionTitle>Create Mapping</SectionTitle>
          <p className="text-muted">Choose a stored user profile and the agent configuration it should activate. The mapping is stored locally so future sessions can reuse it.</p>
          <Row className="align-items-end g-3">
            <Col md={5}>
              <Form.Group>
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
            </Col>
            <Col md={5}>
              <Form.Group>
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
            </Col>
            <Col md={2} className="d-flex flex-column gap-2">
              <Button variant="primary" onClick={handleAddMapping} disabled={!canCreateMapping}>
                Add
              </Button>
              <Button variant="outline-secondary" onClick={refreshLists}>
                Refresh
              </Button>
            </Col>
          </Row>

          <SectionTitle style={{ marginTop: 32 }}>Saved Mappings</SectionTitle>
          {mappings.length === 0 ? (
            <div className="text-muted">No mappings stored yet.</div>
          ) : (
            <Table bordered hover responsive size="sm" className="mt-3">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>User Profile</th>
                  <th style={{ width: '30%' }}>Agent Configuration</th>
                  <th style={{ width: '25%' }}>Updated</th>
                  <th style={{ width: '15%' }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const profileMissing = !profiles.some((profile) => profile.id === mapping.userProfileId);
                  const configurationMissing = !configs.some((config) => config.id === mapping.agentConfigurationId);
                  return (
                    <tr key={mapping.id}>
                      <td>
                        {resolveProfileLabel(mapping)}
                        {profileMissing && (
                          <Badge bg="warning" text="dark" className="ms-2">Missing</Badge>
                        )}
                      </td>
                      <td>
                        {resolveConfigurationLabel(mapping)}
                        {configurationMissing && (
                          <Badge bg="warning" text="dark" className="ms-2">Missing</Badge>
                        )}
                      </td>
                      <td>{new Date(mapping.savedAt).toLocaleString()}</td>
                      <td className="text-center">
                        <Button variant="outline-danger" size="sm" onClick={() => handleRemoveMapping(mapping.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardBody>
      </AgentCard>
    </PageContainer>
  );
};

export default AgentPersonalizationMappingScreen;

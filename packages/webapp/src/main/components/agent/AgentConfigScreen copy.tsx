import React, { useState } from 'react';
import { Card, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import styled from 'styled-components';

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
  max-width: 700px;
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
  padding: 32px;
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


export const AgentConfigScreen: React.FC = () => {
  // Persona (Meta-Configuration)
  const [personaRole, setPersonaRole] = useState('assistant');
  const [personaTone, setPersonaTone] = useState('friendly');
  const [personaDomain, setPersonaDomain] = useState('generalist');
  const [personaCulture, setPersonaCulture] = useState('neutral');
  const [personaConsistency, setPersonaConsistency] = useState('medium');

  // Personalization Without Changing Content
  const [textFormatting, setTextFormatting] = useState('default');
  const [voiceType, setVoiceType] = useState('natural');
  const [speechSpeed, setSpeechSpeed] = useState('normal');
  const [avatar, setAvatar] = useState('default');
  const [responseTiming, setResponseTiming] = useState('instant');
  // Modalities split into input and output
  const [inputModalities, setInputModalities] = useState(['text']);
  const [outputModalities, setOutputModalities] = useState(['text']);

  // Personalization That Changes Content
  const [simplification, setSimplification] = useState('none');
  const [integrateUserData, setIntegrateUserData] = useState(false);
  const [agentLanguage, setAgentLanguage] = useState('english');
  const [userLanguageLevel, setUserLanguageLevel] = useState('B2');
  const [agentStyle, setAgentStyle] = useState('formal');
  const [useEmojis, setUseEmojis] = useState(false);

  // Broader Configuration Options
  const [modelSelection, setModelSelection] = useState('gpt');
  const [processingMethod, setProcessingMethod] = useState('llm');
  const [agentPlatform, setAgentPlatform] = useState('streamlit');

  const handleInputModalityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputModalities(prev =>
      prev.includes(value)
        ? prev.filter(m => m !== value)
        : [...prev, value]
    );
  };

  const handleOutputModalityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOutputModalities(prev =>
      prev.includes(value)
        ? prev.filter(m => m !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save or use config values
    alert('Agent configuration saved!');
  };

  return (
    <PageContainer>
      <AgentCard>
        <CardHeader>
          <h3>Agent Configuration</h3>
        </CardHeader>
        <CardBody>
          <Form onSubmit={handleSubmit}>
            {/* Persona Section */}
            <SectionTitle>Persona (Meta-Configuration)</SectionTitle>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={personaRole} onChange={e => setPersonaRole(e.target.value)}>
                    <option value="teacher">Teacher</option>
                    <option value="coach">Coach</option>
                    <option value="assistant">Assistant</option>
                    <option value="entertainer">Entertainer</option>
                    <option value="consultant">Consultant</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Tone</Form.Label>
                  <Form.Select value={personaTone} onChange={e => setPersonaTone(e.target.value)}>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="humorous">Humorous</option>
                    <option value="empathetic">Empathetic</option>
                    <option value="neutral">Neutral</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Domain Expertise</Form.Label>
                  <Form.Select value={personaDomain} onChange={e => setPersonaDomain(e.target.value)}>
                    <option value="technical">Technical Expert</option>
                    <option value="storyteller">Storyteller</option>
                    <option value="generalist">Generalist</option>
                    <option value="motivator">Motivator</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Cultural Alignment</Form.Label>
                  <Form.Select value={personaCulture} onChange={e => setPersonaCulture(e.target.value)}>
                    <option value="neutral">Neutral</option>
                    <option value="localized">Localized</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Consistency Rules</Form.Label>
                  <Form.Select value={personaConsistency} onChange={e => setPersonaConsistency(e.target.value)}>
                    <option value="strict">Strict</option>
                    <option value="medium">Medium</option>
                    <option value="loose">Loose</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {/* Personalization Without Changing Content */}
            <SectionTitle>Personalization (No Content Change)</SectionTitle>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Text Formatting</Form.Label>
                  <Form.Select value={textFormatting} onChange={e => setTextFormatting(e.target.value)}>
                    <option value="default">Default</option>
                    <option value="large">Large Font</option>
                    <option value="bold">Bold</option>
                    <option value="italic">Italic</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Voice for Speech</Form.Label>
                  <Form.Select value={voiceType} onChange={e => setVoiceType(e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="robotic">Robotic</option>
                    <option value="natural">Natural</option>
                    <option value="regional">Regional Accent</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Speech Speed</Form.Label>
                  <Form.Select value={speechSpeed} onChange={e => setSpeechSpeed(e.target.value)}>
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Avatar</Form.Label>
                  <Form.Select value={avatar} onChange={e => setAvatar(e.target.value)}>
                    <option value="default">Default</option>
                    <option value="2d">2D Icon</option>
                    <option value="3d">3D Character</option>
                    <option value="static">Static Image</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Response Timing</Form.Label>
                  <Form.Select value={responseTiming} onChange={e => setResponseTiming(e.target.value)}>
                    <option value="instant">Instant</option>
                    <option value="delayed">Simulated Thinking</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Input Modalities</Form.Label>
                  <div>
                    <Form.Check
                      type="checkbox"
                      label="Text"
                      value="text"
                      checked={inputModalities.includes('text')}
                      onChange={handleInputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Speech"
                      value="speech"
                      checked={inputModalities.includes('speech')}
                      onChange={handleInputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Video"
                      value="video"
                      checked={inputModalities.includes('video')}
                      onChange={handleInputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Multimodal"
                      value="multimodal"
                      checked={inputModalities.includes('multimodal')}
                      onChange={handleInputModalityChange}
                    />
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Output Modalities</Form.Label>
                  <div>
                    <Form.Check
                      type="checkbox"
                      label="Text"
                      value="text"
                      checked={outputModalities.includes('text')}
                      onChange={handleOutputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Speech"
                      value="speech"
                      checked={outputModalities.includes('speech')}
                      onChange={handleOutputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Video"
                      value="video"
                      checked={outputModalities.includes('video')}
                      onChange={handleOutputModalityChange}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Multimodal"
                      value="multimodal"
                      checked={outputModalities.includes('multimodal')}
                      onChange={handleOutputModalityChange}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            {/* Personalization That Changes Content */}
            <SectionTitle>Personalization (Content Change)</SectionTitle>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Simplification of Content</Form.Label>
                  <Form.Select value={simplification} onChange={e => setSimplification(e.target.value)}>
                    <option value="none">None</option>
                    <option value="concise">Concise</option>
                    <option value="beginner">Beginner-Friendly</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Integrate User Data</Form.Label>
                  <Form.Check
                    type="checkbox"
                    label="Include personalized info"
                    checked={integrateUserData}
                    onChange={e => setIntegrateUserData(e.target.checked)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Agent Language</Form.Label>
                  <Form.Select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)}>
                    <option value="english">English</option>
                    <option value="french">French</option>
                    <option value="german">German</option>
                    <option value="spanish">Spanish</option>
                    <option value="luxembourgish">Luxembourgish</option>
                    <option value="portuguese">Portuguese</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>User Language Level</Form.Label>
                  <Form.Select value={userLanguageLevel} onChange={e => setUserLanguageLevel(e.target.value)}>
                    <option value="A1">A1 (Beginner)</option>
                    <option value="A2">A2 (Elementary)</option>
                    <option value="B1">B1 (Intermediate)</option>
                    <option value="B2">B2 (Upper Intermediate)</option>
                    <option value="C1">C1 (Advanced)</option>
                    <option value="C2">C2 (Proficient)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Agent Style</Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="Formal"
                      name="agentStyle"
                      id="agentStyleFormal"
                      value="formal"
                      checked={agentStyle === 'formal'}
                      onChange={e => setAgentStyle(e.target.value)}
                    />
                    <Form.Check
                      type="radio"
                      label="Informal"
                      name="agentStyle"
                      id="agentStyleInformal"
                      value="informal"
                      checked={agentStyle === 'informal'}
                      onChange={e => setAgentStyle(e.target.value)}
                    />
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Use Emojis/GIFs</Form.Label>
                  <Form.Check
                    type="checkbox"
                    label="Add visual/emotional context"
                    checked={useEmojis}
                    onChange={e => setUseEmojis(e.target.checked)}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Broader Configuration Options */}
            <SectionTitle>Broader Configuration Options</SectionTitle>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Model Selection</Form.Label>
                  <Form.Select value={modelSelection} onChange={e => setModelSelection(e.target.value)}>
                    <option value="gpt">GPT</option>
                    <option value="claude">Claude</option>
                    <option value="llama">LLaMA</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Processing Method</Form.Label>
                  <Form.Select value={processingMethod} onChange={e => setProcessingMethod(e.target.value)}>
                    <option value="llm">LLM-based</option>
                    <option value="nlp">Classical NLP</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Platform Integration</Form.Label>
                  <Form.Select value={agentPlatform} onChange={e => setAgentPlatform(e.target.value)}>
                    <option value="streamlit">Streamlit</option>
                    <option value="telegram">Telegram</option>
                    <option value="websocket">WebSocket</option>
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-3 mt-4">
              <Button variant="primary" type="submit">
                Save Configuration
              </Button>
            </div>
          </Form>
        </CardBody>
      </AgentCard>
    </PageContainer>
  );
};

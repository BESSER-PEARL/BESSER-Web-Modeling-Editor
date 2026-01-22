import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import posthog from 'posthog-js';

const CONSENT_KEY = 'besser_analytics_consent';
const CONSENT_VERSION = '1.0'; // Increment when privacy policy changes

export type ConsentStatus = 'pending' | 'accepted' | 'declined';

interface ConsentData {
  status: ConsentStatus;
  timestamp: string;
  version: string;
}

// Styled Components
const BannerOverlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  justify-content: center;
  padding: 16px;
  pointer-events: none;
`;

const BannerContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 480px;
  width: 100%;
  padding: 16px 20px;
  pointer-events: auto;
  animation: slideUp 0.3s ease-out;

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const BannerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;

  .icon {
    font-size: 20px;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    color: #1a202c;
    font-weight: 600;
  }
`;

const BannerContent = styled.div`
  color: #4a5568;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;

  p {
    margin: 0;
  }

  .details-toggle {
    color: #667eea;
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    cursor: pointer;
    margin-top: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    &:hover {
      text-decoration: underline;
    }
  }

  .data-list {
    background: #f7fafc;
    border-radius: 6px;
    padding: 10px 12px;
    margin-top: 10px;
    font-size: 12px;
    animation: fadeIn 0.2s ease;

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .data-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;

      .check {
        color: #48bb78;
        font-size: 11px;
      }

      .cross {
        color: #e53e3e;
        font-size: 11px;
      }
    }
  }

  .privacy-link {
    color: #667eea;
    text-decoration: none;
    font-size: 11px;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button<{ $variant: 'primary' | 'secondary' | 'outline' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          
          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
          }
        `;
      case 'secondary':
        return `
          background: #e2e8f0;
          color: #4a5568;
          border: none;
          
          &:hover {
            background: #cbd5e0;
          }
        `;
      case 'outline':
        return `
          background: transparent;
          color: #667eea;
          border: 1px solid #667eea;
          
          &:hover {
            background: rgba(102, 126, 234, 0.1);
          }
        `;
    }
  }}

  &:active {
    transform: scale(0.98);
  }
`;

// Settings Modal for managing preferences
const SettingsModal = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100000;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const SettingsContent = styled.div`
  background: white;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  .settings-header {
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 18px;
      color: #1a202c;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #a0aec0;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;

      &:hover {
        background: #f7fafc;
        color: #4a5568;
      }
    }
  }

  .settings-body {
    padding: 24px;
  }

  .settings-footer {
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
`;

const ToggleItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  background: #f7fafc;
  border-radius: 8px;
  margin-bottom: 12px;

  .toggle-info {
    flex: 1;
    padding-right: 16px;

    .toggle-title {
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;

      .required-badge {
        font-size: 10px;
        background: #e2e8f0;
        color: #718096;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
    }

    .toggle-description {
      font-size: 13px;
      color: #718096;
      line-height: 1.5;
    }
  }
`;

const Toggle = styled.button<{ $enabled: boolean; $disabled?: boolean }>`
  width: 48px;
  height: 26px;
  border-radius: 13px;
  border: none;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  background: ${props => props.$enabled ? '#48bb78' : '#cbd5e0'};
  opacity: ${props => props.$disabled ? 0.6 : 1};

  &::after {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: ${props => props.$enabled ? '24px' : '2px'};
    transition: left 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
`;

// Privacy Policy Modal
const PrivacyModal = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100001;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 20px;

  .privacy-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

    .privacy-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      background: white;
      z-index: 1;

      h3 {
        margin: 0;
        font-size: 16px;
        color: #1a202c;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #a0aec0;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;

        &:hover {
          background: #f7fafc;
          color: #4a5568;
        }
      }
    }

    .privacy-body {
      padding: 20px;
      font-size: 13px;
      line-height: 1.6;
      color: #4a5568;

      h4 {
        color: #1a202c;
        font-size: 14px;
        margin: 16px 0 8px 0;
        
        &:first-child {
          margin-top: 0;
        }
      }

      p {
        margin: 0 0 12px 0;
      }

      ul {
        margin: 8px 0;
        padding-left: 20px;

        li {
          margin: 4px 0;
        }
      }

      .contact-info {
        background: #f7fafc;
        padding: 12px;
        border-radius: 6px;
        margin-top: 16px;
        font-size: 12px;
      }
    }
  }
`;

// Utility functions
export const getConsentStatus = (): ConsentData | null => {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    
    const data: ConsentData = JSON.parse(stored);
    // Check if consent version matches current version
    if (data.version !== CONSENT_VERSION) {
      return null; // Re-ask for consent if version changed
    }
    return data;
  } catch {
    return null;
  }
};

export const setConsentStatus = (status: ConsentStatus): void => {
  const data: ConsentData = {
    status,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
};

export const hasUserConsented = (): boolean => {
  const consent = getConsentStatus();
  return consent?.status === 'accepted';
};

export const initializePostHogWithConsent = (): void => {
  if (hasUserConsented()) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
};

// Main Component
export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    const consent = getConsentStatus();
    if (!consent || consent.status === 'pending') {
      setIsVisible(true);
      // Ensure PostHog is disabled until consent is given
      posthog.opt_out_capturing();
    } else if (consent.status === 'accepted') {
      posthog.opt_in_capturing();
    }
  }, []);

  const handleAccept = () => {
    setConsentStatus('accepted');
    posthog.opt_in_capturing();
    setIsVisible(false);
  };

  const handleDecline = () => {
    setConsentStatus('declined');
    posthog.opt_out_capturing();
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    if (analyticsEnabled) {
      setConsentStatus('accepted');
      posthog.opt_in_capturing();
    } else {
      setConsentStatus('declined');
      posthog.opt_out_capturing();
    }
    setShowSettings(false);
    setIsVisible(false);
  };

  return (
    <>
      <BannerOverlay $isVisible={isVisible}>
        <BannerContainer>
          <BannerHeader>
            <span className="icon">🍪</span>
            <h3>Analytics Cookies</h3>
          </BannerHeader>

          <BannerContent>
            <p>
              We collect anonymous usage data to improve BESSER.
            </p>

            <button 
              className="details-toggle" 
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '▼ Hide details' : '▶ What we collect'}
            </button>

            {showDetails && (
              <div className="data-list">
                <div className="data-item">
                  <span className="check">✓</span>
                  <span>Code generators used (Django, SQL, etc.)</span>
                </div>
                <div className="data-item">
                  <span className="check">✓</span>
                  <span>Diagram types & model size</span>
                </div>
                <div className="data-item">
                  <span className="check">✓</span>
                  <span>AI Assistant usage (count only)</span>
                </div>
                <div className="data-item">
                  <span className="cross">✗</span>
                  <span>No screen recording or personal data</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button 
                    className="privacy-link" 
                    onClick={() => setShowPrivacy(true)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    Privacy Policy →
                  </button>
                </div>
              </div>
            )}
          </BannerContent>

          <ButtonGroup>
            <Button $variant="primary" onClick={handleAccept}>
              Accept
            </Button>
            <Button $variant="secondary" onClick={handleDecline}>
              Decline
            </Button>
            <Button $variant="outline" onClick={() => setShowSettings(true)}>
              Settings
            </Button>
          </ButtonGroup>
        </BannerContainer>
      </BannerOverlay>

      <SettingsModal $isVisible={showSettings}>
        <SettingsContent>
          <div className="settings-header">
            <h3>Privacy Settings</h3>
            <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
          </div>

          <div className="settings-body">
            <ToggleItem>
              <div className="toggle-info">
                <div className="toggle-title">
                  Essential Cookies
                  <span className="required-badge">Required</span>
                </div>
                <div className="toggle-description">
                  Required for the application to function. These include session management 
                  and user preferences stored locally in your browser.
                </div>
              </div>
              <Toggle $enabled={true} $disabled={true} />
            </ToggleItem>

            <ToggleItem>
              <div className="toggle-info">
                <div className="toggle-title">Analytics</div>
                <div className="toggle-description">
                  Help us improve BESSER by sharing anonymous usage data. We track which 
                  features are used most (generators, diagram types, AI assistant) without 
                  collecting personal information or diagram content.
                </div>
              </div>
              <Toggle 
                $enabled={analyticsEnabled} 
                onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
              />
            </ToggleItem>
          </div>

          <div className="settings-footer">
            <Button $variant="secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleSaveSettings}>
              Save Preferences
            </Button>
          </div>
        </SettingsContent>
      </SettingsModal>

      <PrivacyModal $isVisible={showPrivacy} onClick={() => setShowPrivacy(false)}>
        <div className="privacy-content" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-header">
              <h3>Privacy Policy</h3>
              <button className="close-btn" onClick={() => setShowPrivacy(false)}>×</button>
            </div>
            <div className="privacy-body">
              <section>
                <h4>About BESSER</h4>
                <p>
                  BESSER (Better Smart Software Faster) is an open-source low-code platform developed 
                  by the Software Engineering Research Group at LIST - Luxembourg Institut of Science and Technology.
                </p>
              </section>

              <section>
                <h4>Data We Collect</h4>
                <p>When you consent to analytics, we collect:</p>
                <ul>
                  <li><strong>Feature usage:</strong> Which code generators you use (Django, SQL, Flutter, etc.)</li>
                  <li><strong>Model metrics:</strong> Number of elements and relationships in your diagrams</li>
                  <li><strong>AI Assistant:</strong> Count of interactions (not the content)</li>
                  <li><strong>Session data:</strong> Anonymous session ID, timestamp</li>
                </ul>
              </section>

              <section>
                <h4>Data We Do NOT Collect</h4>
                <ul>
                  <li>Your name, email, or any personal identifiers</li>
                  <li>The content of your diagrams or models</li>
                  <li>Screen recordings or session replays</li>
                  <li>IP addresses (masked by our analytics provider)</li>
                  <li>Your diagram titles or project names</li>
                </ul>
              </section>

              <section>
                <h4>How We Use Your Data</h4>
                <p>
                  We use anonymous analytics solely to improve BESSER by understanding which 
                  features are most used and identifying areas for improvement. We never sell 
                  or share your data with third parties for marketing purposes.
                </p>
              </section>

              <section>
                <h4>Analytics Provider</h4>
                <p>
                  We use PostHog (EU-hosted) for analytics. Data is processed within the 
                  European Union in compliance with GDPR. Visit{' '}
                  <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">
                    PostHog's Privacy Policy
                  </a>{' '}
                  for more details.
                </p>
              </section>

              <section>
                <h4>Your Rights</h4>
                <p>Under GDPR, you have the right to:</p>
                <ul>
                  <li>Decline analytics at any time using the banner or settings</li>
                  <li>Request information about data we've collected</li>
                  <li>Request deletion of your data</li>
                </ul>
              </section>

              <section>
                <h4>Contact</h4>
                <div className="contact-info">
                  <p>
                    <strong>LIST - Luxembourg Institut of Science and Technology</strong><br />
                    Software Engineering Research Group<br />
                    <a href="https://github.com/BESSER-PEARL" target="_blank" rel="noopener noreferrer">
                      github.com/BESSER-PEARL
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </PrivacyModal>
    </>
  );
};

// Privacy Settings Button Component (for footer or settings page)
export const PrivacySettingsButton: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(hasUserConsented());

  const handleSave = () => {
    if (analyticsEnabled) {
      setConsentStatus('accepted');
      posthog.opt_in_capturing();
    } else {
      setConsentStatus('declined');
      posthog.opt_out_capturing();
    }
    setShowSettings(false);
  };

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#667eea',
          cursor: 'pointer',
          fontSize: '13px',
          textDecoration: 'underline',
        }}
      >
        🔒 Privacy Settings
      </button>

      <SettingsModal $isVisible={showSettings}>
        <SettingsContent>
          <div className="settings-header">
            <h3>Privacy Settings</h3>
            <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
          </div>

          <div className="settings-body">
            <ToggleItem>
              <div className="toggle-info">
                <div className="toggle-title">
                  Essential Cookies
                  <span className="required-badge">Required</span>
                </div>
                <div className="toggle-description">
                  Required for the application to function.
                </div>
              </div>
              <Toggle $enabled={true} $disabled={true} />
            </ToggleItem>

            <ToggleItem>
              <div className="toggle-info">
                <div className="toggle-title">Analytics</div>
                <div className="toggle-description">
                  Anonymous usage data to improve BESSER.
                </div>
              </div>
              <Toggle 
                $enabled={analyticsEnabled} 
                onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
              />
            </ToggleItem>
          </div>

          <div className="settings-footer">
            <Button $variant="secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button $variant="primary" onClick={handleSave}>
              Save Preferences
            </Button>
          </div>
        </SettingsContent>
      </SettingsModal>
    </>
  );
};

export default CookieConsentBanner;

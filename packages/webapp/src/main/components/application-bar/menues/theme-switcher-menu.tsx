import React, { useState, useEffect } from 'react';
import { setTheme, toggleTheme } from '../../../utils/theme-switcher';
import { LocalStorageRepository } from '../../../../main/services/local-storage/local-storage-repository';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import ThemeSwitcherIcon from 'webapp/assets/theme-switcher.svg';

export const ThemeSwitcherMenu: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [overrideUserThemePreference, setOverrideUserThemePreference] = useState<boolean>(true);

  useEffect(() => {
    updateState();
  }, []);

  const updateTheme = () => {
    toggleTheme();
    updateState();
  };

  const isDarkModeActive = (): boolean => {
    const systemTheme = LocalStorageRepository.getSystemThemePreference();
    const preferredTheme = LocalStorageRepository.getUserThemePreference();
    return (preferredTheme || systemTheme) === 'dark';
  };

  const updateState = () => {
    setIsDarkMode(isDarkModeActive());
    setOverrideUserThemePreference(!LocalStorageRepository.getUserThemePreference());
  };

  const getSystemTheme = (): string => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const handleInputChange = () => {
    if (!overrideUserThemePreference) {
      LocalStorageRepository.setSystemThemePreference(getSystemTheme());
      LocalStorageRepository.removeUserThemePreference();
      setTheme(getSystemTheme());
      updateState();
    } else {
      setOverrideUserThemePreference(false);
      LocalStorageRepository.setUserThemePreference(getSystemTheme());
    }
  };

  const onToggle = () => {
    if (!showTooltip) {
      setShowTooltip(true);
    } else {
      if (isPopoverHovered()) {
        setShowTooltip(true);
        setTimeout(onToggle, 500);
      } else {
        setShowTooltip(false);
      }
    }
  };

  const isPopoverHovered = (): boolean => {
    const elem = document.getElementById('tooltip-bottom');
    return elem?.parentElement?.querySelector(':hover') === elem;
  };

  return (
    <OverlayTrigger
      key="bottom"
      placement="bottom-start"
      show={showTooltip}
      onToggle={onToggle}
      delay={{ show: 0, hide: 0 }}
      overlay={
        <Tooltip id="tooltip-bottom">
          <div className="popover-content" id="theme-switch-popover-content">
            <div className="head">
              ☾ <span>Dark Mode</span> ☾
            </div>
            <div className="switch-box">
              Sync with Operating System
              <label className="switch">
                <input type="checkbox" checked={overrideUserThemePreference} onChange={handleInputChange} />
                <span className="slider round" />
              </label>
            </div>

            {isDarkMode && (
              <div className="description">
                <span>You can click this icon at any time to disable the dark mode if you experience problems.</span>
              </div>
            )}
            {!isDarkMode && (
              <div className="description">
                <span>Try the dark mode and relieve your eyes.</span>
              </div>
            )}
          </div>
        </Tooltip>
      }
    >
      <div onClick={updateTheme}>
        <div className={'theme-toggle' + (isDarkMode ? ' dark' : '')} id="theme-toggle">
          <ThemeSwitcherIcon />
        </div>
      </div>
    </OverlayTrigger>
  );
};

import '@testing-library/jest-dom';

// Initialise i18next before any component renders so that t() resolves to real
// (English) strings in unit tests instead of returning raw keys. Resources are
// bundled synchronously, so translations are available immediately after import.
import i18n from '../main/shared/i18n';
void i18n.changeLanguage('en');

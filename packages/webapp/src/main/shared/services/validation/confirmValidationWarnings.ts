import i18n from '../../i18n';
import { globalConfirm } from '../confirm/globalConfirm';
import { stripStatusEmoji } from './stripStatusEmoji';

/** The dialog names the first few; the warnings toast beside it lists them all. */
const MAX_LISTED_WARNINGS = 3;

/**
 * Asks whether to go on with a model whose validation passed with warnings, so
 * a user who wants to fix them first does not spend a generation. Resolves
 * true at once when there are none.
 */
export async function confirmValidationWarnings(warnings: readonly string[] | undefined): Promise<boolean> {
  if (!warnings || warnings.length === 0) return true;
  const listed = warnings.slice(0, MAX_LISTED_WARNINGS).map(stripStatusEmoji).join(' · ');
  const more = warnings.length - MAX_LISTED_WARNINGS;
  return globalConfirm({
    title: i18n.t('validation.warningsConfirm.title', { count: warnings.length }),
    description: [
      i18n.t('validation.warningsConfirm.description'),
      listed,
      more > 0 ? i18n.t('validation.warningsConfirm.more', { count: more }) : '',
    ]
      .filter(Boolean)
      .join(' '),
    confirmLabel: i18n.t('validation.warningsConfirm.confirm'),
    cancelLabel: i18n.t('validation.warningsConfirm.cancel'),
  });
}

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '../../shared/api/api-client';
import { getSdmxProviders, sdmxToDomainModel } from '../../shared/api/conversion';
import type { components } from '../../shared/api/generated/besser-openapi';

/** A preset SDMX provider, as served by the backend's `GET /sdmx-providers`. */
export type SdmxProviderOption = components['schemas']['SdmxProvider'];

type SdmxImportRequest = components['schemas']['SdmxImportRequest'];

/** What the "Statistics API (SDMX)" source of the "From Data" step collects. */
export interface SdmxSourceValue {
  /** A preset provider key, or {@link SDMX_CUSTOM_PROVIDER} for {@link SdmxSourceValue.baseUrl}; empty until loaded. */
  provider: string;
  baseUrl: string;
  dataflow: string;
}

export const SDMX_CUSTOM_PROVIDER = 'custom';
export const DEFAULT_SDMX_SOURCE: SdmxSourceValue = { provider: '', baseUrl: '', dataflow: '' };

// The backend's own checks are authoritative; these only keep the submit button honest.
const DATAFLOW_PATTERN = /^[A-Za-z0-9_@$.\-]+([,:][A-Za-z0-9_@$.\-]+)*(\([A-Za-z0-9.+~]*\))?$/;
const HTTPS_URL_PATTERN = /^https:\/\/[^\s/?#\\]+[^\s\\]*$/i;

export const isSdmxSourceComplete = (value: SdmxSourceValue): boolean => {
  const dataflow = value.dataflow.trim();
  if (!dataflow || dataflow.length > 200 || !DATAFLOW_PATTERN.test(dataflow)) {
    return false;
  }
  if (value.provider === SDMX_CUSTOM_PROVIDER) {
    return HTTPS_URL_PATTERN.test(value.baseUrl.trim());
  }
  return Boolean(value.provider);
};

/** The request body of `POST /sdmx-to-domain-model`. */
export const sdmxRequestBody = (value: SdmxSourceValue): SdmxImportRequest =>
  value.provider === SDMX_CUSTOM_PROVIDER
    ? { baseUrl: value.baseUrl.trim(), dataflow: value.dataflow.trim() }
    : { provider: value.provider, dataflow: value.dataflow.trim() };

/**
 * Ask the backend for the class diagram of an SDMX dataflow.
 *
 * Throws an `Error` whose message is the backend's own explanation (an unknown dataflow, a provider that
 * failed, a server busy with other imports), or `fallbackMessage` when the backend gave none.
 */
export async function requestSdmxDiagram(value: SdmxSourceValue, fallbackMessage: string) {
  try {
    return await sdmxToDomainModel(sdmxRequestBody(value));
  } catch (error) {
    throw new Error((error instanceof ApiError ? error.detail : undefined) ?? fallbackMessage);
  }
}

interface ProvidersState {
  providers: SdmxProviderOption[];
  customUrlAllowed: boolean;
  loading: boolean;
  /** The list could not be loaded: the backend is unreachable or too old to offer SDMX at all. */
  failed: boolean;
}

/** Loads the preset providers once the SDMX source is shown. */
export function useSdmxProviders(enabled: boolean): ProvidersState {
  const [state, setState] = useState<ProvidersState>({
    providers: [],
    customUrlAllowed: false,
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (!enabled || state.providers.length > 0) {
      return undefined;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, failed: false }));
    getSdmxProviders()
      .then((data) => {
        if (!cancelled) {
          setState({
            providers: Array.isArray(data?.providers) ? data.providers : [],
            customUrlAllowed: data?.customUrlAllowed === true,
            loading: false,
            failed: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ providers: [], customUrlAllowed: false, loading: false, failed: true });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}

interface SdmxSourceFieldsProps {
  value: SdmxSourceValue;
  onChange: (value: SdmxSourceValue) => void;
  providers: SdmxProviderOption[];
  customUrlAllowed: boolean;
  loading: boolean;
  failed?: boolean;
  disabled?: boolean;
}

/** Provider, custom API URL and dataflow fields of the "Statistics API (SDMX)" source. */
export const SdmxSourceFields: React.FC<SdmxSourceFieldsProps> = ({
  value,
  onChange,
  providers,
  customUrlAllowed,
  loading,
  failed = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const isCustom = value.provider === SDMX_CUSTOM_PROVIDER;
  const selected = providers.find((provider) => provider.key === value.provider);

  // Once the list is in, preselect its first provider (the list's order is the backend's).
  useEffect(() => {
    if (!value.provider && providers.length > 0) {
      onChange({ ...value, provider: providers[0].key });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  if (failed) {
    return (
      <p className="text-sm text-destructive" role="alert" data-testid="sdmx-providers-failed">
        {t('project.hub.spreadsheet.sdmxProvidersFailed')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('project.hub.spreadsheet.sdmxProvider')} htmlFor="sdmx-provider">
        <Select
          value={value.provider}
          onValueChange={(provider) => provider && onChange({ ...value, provider })}
          disabled={disabled || loading}
        >
          <SelectTrigger id="sdmx-provider" data-testid="sdmx-provider">
            <SelectValue placeholder={loading ? t('project.hub.spreadsheet.sdmxLoadingProviders') : undefined} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.key} value={provider.key}>
                {provider.name}
              </SelectItem>
            ))}
            {customUrlAllowed && (
              <SelectItem value={SDMX_CUSTOM_PROVIDER}>{t('project.hub.spreadsheet.sdmxCustom')}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </FormField>

      {isCustom && (
        <FormField
          label={t('project.hub.spreadsheet.sdmxBaseUrl')}
          htmlFor="sdmx-base-url"
          helperText={t('project.hub.spreadsheet.sdmxBaseUrlHint')}
          required
        >
          <Input
            id="sdmx-base-url"
            name="sdmx-base-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value.baseUrl}
            onChange={(event) => onChange({ ...value, baseUrl: event.target.value })}
            placeholder="https://example.org/sdmx/rest"
            disabled={disabled}
          />
        </FormField>
      )}

      <FormField
        label={t('project.hub.spreadsheet.sdmxDataflow')}
        htmlFor="sdmx-dataflow"
        helperText={t('project.hub.spreadsheet.sdmxDataflowHint')}
        required
      >
        <Input
          id="sdmx-dataflow"
          name="sdmx-dataflow"
          autoComplete="off"
          spellCheck={false}
          value={value.dataflow}
          onChange={(event) => onChange({ ...value, dataflow: event.target.value })}
          placeholder={selected?.key === 'ecb' ? 'EXR' : 'une_rt_m'}
          className="font-mono"
          disabled={disabled}
        />
      </FormField>
    </div>
  );
};

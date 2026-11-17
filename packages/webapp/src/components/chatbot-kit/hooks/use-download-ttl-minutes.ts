import { useEffect, useState } from "react"

import {
  archiveTtlSeconds,
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
  peekServerSpecDrivenConfig,
  type SpecDrivenConfig,
} from "@/main/shared/services/specDrivenConfig"

const toMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

export interface RunLifetimes {
  /** How long a finished run can still be modified or pushed (its workspace). */
  workspaceSeconds: number
  /** How long its download is served (never shorter than the workspace). */
  archiveSeconds: number
}

const lifetimes = (cfg: SpecDrivenConfig | null): RunLifetimes | null =>
  cfg ? { workspaceSeconds: cfg.download_ttl_seconds, archiveSeconds: archiveTtlSeconds(cfg) } : null

/**
 * The server-owned lifetimes of a finished run (`download_ttl_seconds`,
 * `archive_ttl_seconds`), or null while the server has not said: a fallback
 * guess would expire results the server still serves.
 */
export function useRunLifetimes(): RunLifetimes | null {
  const [value, setValue] = useState(() => lifetimes(peekServerSpecDrivenConfig()))
  useEffect(() => {
    let cancelled = false
    void getSpecDrivenConfig().then((cfg) => {
      if (!cancelled) setValue(lifetimes(cfg === FALLBACK_SMART_GEN_CONFIG ? null : cfg))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return value
}

/** How long the download is served, in whole minutes (at least 1); the fallback until the server says. */
export function useDownloadTtlMinutes(): number {
  return toMinutes(useRunLifetimes()?.archiveSeconds ?? archiveTtlSeconds(FALLBACK_SMART_GEN_CONFIG))
}

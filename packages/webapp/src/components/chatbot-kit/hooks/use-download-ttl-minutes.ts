import { useEffect, useState } from "react"

import {
  archiveTtlSeconds,
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
  type SpecDrivenConfig,
} from "@/main/shared/services/specDrivenConfig"

const toMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

export interface RunLifetimes {
  /** How long a finished run can still be modified or pushed (its workspace). */
  workspaceSeconds: number
  /** How long its download is served (never shorter than the workspace). */
  archiveSeconds: number
}

const lifetimes = (cfg: SpecDrivenConfig): RunLifetimes => ({
  workspaceSeconds: cfg.download_ttl_seconds,
  archiveSeconds: archiveTtlSeconds(cfg),
})

/**
 * The server-owned lifetimes of a finished run (`download_ttl_seconds`,
 * `archive_ttl_seconds`); the fallback shows until the config loads.
 */
export function useRunLifetimes(): RunLifetimes {
  const [value, setValue] = useState(() => lifetimes(FALLBACK_SMART_GEN_CONFIG))
  useEffect(() => {
    let cancelled = false
    void getSpecDrivenConfig().then((cfg) => {
      if (!cancelled) setValue(lifetimes(cfg))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return value
}

/** How long the download is served, in whole minutes (at least 1). */
export function useDownloadTtlMinutes(): number {
  return toMinutes(useRunLifetimes().archiveSeconds)
}

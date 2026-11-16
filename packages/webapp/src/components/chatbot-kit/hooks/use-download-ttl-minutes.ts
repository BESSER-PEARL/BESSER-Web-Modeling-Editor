import { useEffect, useState } from "react"

import {
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
} from "@/main/shared/services/specDrivenConfig"

const toMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

/**
 * How long the server keeps a finished run's artifact, in seconds. The TTL is
 * server-owned (`download_ttl_seconds`); the fallback shows until it loads.
 */
export function useDownloadTtlSeconds(): number {
  const [seconds, setSeconds] = useState(FALLBACK_SMART_GEN_CONFIG.download_ttl_seconds)
  useEffect(() => {
    let cancelled = false
    void getSpecDrivenConfig().then((cfg) => {
      if (!cancelled) setSeconds(cfg.download_ttl_seconds)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return seconds
}

/** `useDownloadTtlSeconds` in whole minutes (at least 1). */
export function useDownloadTtlMinutes(): number {
  return toMinutes(useDownloadTtlSeconds())
}

import { useEffect, useState } from "react"

import {
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
} from "@/main/shared/services/specDrivenConfig"

const toMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

/**
 * How long the server keeps a finished run's artifact, in minutes. The TTL is
 * server-owned (`download_ttl_seconds`); the fallback shows until it loads.
 */
export function useDownloadTtlMinutes(): number {
  const [minutes, setMinutes] = useState(() =>
    toMinutes(FALLBACK_SMART_GEN_CONFIG.download_ttl_seconds)
  )
  useEffect(() => {
    let cancelled = false
    void getSpecDrivenConfig().then((cfg) => {
      if (!cancelled) setMinutes(toMinutes(cfg.download_ttl_seconds))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return minutes
}

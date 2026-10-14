import { useEffect, useState } from "react"

/**
 * Object URL for a Blob/File, revoked when the blob changes or the component
 * unmounts. Created in an effect (not during render) so StrictMode's double
 * render cannot leak an URL; it is null for the first paint.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  return url
}

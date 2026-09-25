import { Dot } from "lucide-react"

export function TypingIndicator({ label = "Thinking…" }: { label?: string }) {
  return (
    <div className="justify-left flex space-x-1">
      <div className="flex items-center gap-1 rounded-lg bg-muted py-2 pl-2 pr-3.5">
        <div className="flex -space-x-2.5">
          <Dot className="h-5 w-5 animate-typing-dot-bounce text-primary/70" />
          <Dot className="h-5 w-5 animate-typing-dot-bounce text-primary/70 [animation-delay:90ms]" />
          <Dot className="h-5 w-5 animate-typing-dot-bounce text-primary/70 [animation-delay:180ms]" />
        </div>
        {/* Shimmering status label — a light sweep travels across the text
            while the agent works, so the wait reads as activity, not silence. */}
        <span className="animate-text-shimmer bg-gradient-to-r from-muted-foreground/60 via-foreground to-muted-foreground/60 bg-[length:200%_100%] bg-clip-text text-xs font-medium text-transparent">
          {label}
        </span>
      </div>
    </div>
  )
}

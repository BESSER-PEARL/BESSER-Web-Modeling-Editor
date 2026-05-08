interface PromptSuggestionsProps {
  label: string
  append: (message: { role: "user"; content: string }) => void
  suggestions: string[]
}

export function PromptSuggestions({
  label,
  append,
  suggestions,
}: PromptSuggestionsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-center text-2xl font-bold">{label}</h2>
      <div className="flex gap-4 text-sm">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => append({ role: "user", content: suggestion })}
            className="h-max flex-1 rounded-xl border border-border/60 bg-background p-4 text-left transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
          >
            <p className="text-foreground">{suggestion}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

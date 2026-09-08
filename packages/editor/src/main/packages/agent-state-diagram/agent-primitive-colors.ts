// Accent colors for the reasoning-primitive elements (Tool / Skill / Workspace)
// so they are distinguishable at a glance on the canvas instead of looking
// identical. The accent is used for the border and the «stereotype» label;
// the tint is a translucent fill so it reads correctly over either the light
// or dark themed background. ReasoningState carries its own accent (purple).
export const AGENT_PRIMITIVE_COLORS = {
  tool: { accent: '#3B82F6', tint: 'rgba(59, 130, 246, 0.10)', icon: '🔧' },
  skill: { accent: '#22C55E', tint: 'rgba(34, 197, 94, 0.10)', icon: '💡' },
  workspace: { accent: '#F59E0B', tint: 'rgba(245, 158, 11, 0.12)', icon: '📁' },
} as const;

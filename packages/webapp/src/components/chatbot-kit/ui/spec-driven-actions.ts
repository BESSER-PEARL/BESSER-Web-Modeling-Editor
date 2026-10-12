/**
 * Turns one agent tool call into the short `verb  target` line the run card
 * shows ("write  frontend/src/App.jsx"). The backend streams the target as
 * `detail`: space-separated `key=value` pairs built from an allow list of
 * argument keys (BESSER `pipeline/constants.py::_tool_call_detail`). Values
 * can contain spaces (`command=npm run build`), so pairs split only before a
 * known key.
 */

const VERBS: Record<string, string> = {
  read_file: "read",
  write_file: "write",
  modify_file: "edit",
  replace_file_lines: "edit",
  delete_file: "delete",
  list_files: "list",
  search_in_files: "search",
  run_command: "shell",
  install_dependencies: "install",
  test_api: "test",
  validate_app: "check",
  validate_model: "check",
  check_syntax: "check",
  task_list: "plan",
  query_class: "model",
  list_classes_with: "model",
  get_constraints_for: "model",
}

const DETAIL_KEYS = [
  "path", "file_path", "filename", "target", "action", "id", "ids",
  "text", "command", "pattern", "query", "class_name", "generator", "batched",
]

// Most useful first: a file path says more than an action name.
const TARGET_KEYS = [
  "path", "file_path", "filename", "command", "pattern", "query",
  "class_name", "target", "generator", "text",
]

const PAIR_SPLIT = new RegExp(`\\s+(?=(?:${DETAIL_KEYS.join("|")})=)`)

export function parseToolDetail(detail?: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!detail) return out
  for (const pair of detail.trim().split(PAIR_SPLIT)) {
    const eq = pair.indexOf("=")
    if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return out
}

export function describeToolCall(
  tool: string,
  detail?: string | null,
  summary?: string | null,
): { verb: string; target: string } {
  const verb = VERBS[tool] ?? (tool.startsWith("generate_") ? "generate" : tool)
  const fields = parseToolDetail(detail)
  const key = TARGET_KEYS.find((k) => fields[k])
  let target = key ? fields[key] : ""
  if (tool === "task_list") {
    // `action=update id=3` reads better as "update #3".
    const ids = fields.id || fields.ids
    target = [fields.action, ids ? `#${ids}` : "", fields.text]
      .filter(Boolean)
      .join(" ")
  } else if (tool.startsWith("generate_") && !target) {
    target = tool.slice("generate_".length)
  }
  return { verb, target: target || summary || "" }
}

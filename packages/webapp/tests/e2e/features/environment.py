"""Behave environment hooks: manage the Playwright browser lifecycle and config."""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


def _bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def before_all(context):
    ud = context.config.userdata
    context.base_url = ud.get("base_url", "http://localhost:8080")
    context.headless = _bool(ud.get("headless"), default=True)
    context.slow_mo = int(ud.get("slow_mo", "0") or 0)
    context.prompt = ud.get("prompt", "Create a database for a hospital management system.")
    context.agent_timeout = int(ud.get("agent_timeout", "420") or 420)

    root = Path(__file__).resolve().parent.parent
    context.download_dir = (root / ud.get("download_dir", "downloads")).resolve()
    context.artifacts_dir = (root / ud.get("artifacts_dir", "artifacts")).resolve()
    context.download_dir.mkdir(parents=True, exist_ok=True)
    context.artifacts_dir.mkdir(parents=True, exist_ok=True)

    context._playwright = sync_playwright().start()
    context.browser = context._playwright.chromium.launch(
        headless=context.headless, slow_mo=context.slow_mo
    )


def before_scenario(context, scenario):
    context.ctx = context.browser.new_context(accept_downloads=True)
    # Generous default so slow agent responses don't fail on incidental waits.
    context.ctx.set_default_timeout(30_000)
    context.page = context.ctx.new_page()
    context.download_path = None


def after_step(context, step):
    # Capture a screenshot when a step fails, for debugging.
    if step.status == "failed" and getattr(context, "page", None):
        safe = "".join(c if c.isalnum() else "_" for c in step.name)[:80]
        target = context.artifacts_dir / f"FAILED_{safe}.png"
        try:
            context.page.screenshot(path=str(target), full_page=True)
            print(f"[artifact] screenshot saved: {target}")
        except Exception as exc:  # pragma: no cover - best effort
            print(f"[artifact] could not save screenshot: {exc}")


def after_scenario(context, scenario):
    if getattr(context, "ctx", None):
        context.ctx.close()


def after_all(context):
    if getattr(context, "browser", None):
        context.browser.close()
    if getattr(context, "_playwright", None):
        context._playwright.stop()

"""Step definitions driving the BESSER agentic interface with Playwright."""
import time
import zipfile

from behave import given, when, then
from playwright.sync_api import expect

# Placeholder of the chat composer in the agentic interface.
COMPOSER_PLACEHOLDER = "Describe what you want to create or modify..."

SEND_SELECTOR = "button[aria-label='Send message']"
# When the spec is done the agent posts a message containing "spec is ready"
# or "model is ready" depending on the run. The exact follow-up chips vary too,
# so these text fragments are the only reliable, artifact-agnostic signal.
SPEC_READY_TEXTS = ("spec is ready", "model is ready")
# After the spec is ready the agent offers, among others, a "Generate database"
# chip (it recognises that a database is the artifact to build).
GENERATE_DB_SELECTOR = "button:has-text('Generate database')"
# Buttons that are always present (nav / editor) and are NOT agent suggestion
# chips - used to isolate the "Generate <artifact>" chip the agent proposes.
_NON_CHIP_GENERATE = {"generate", "generate django code"}
# For a web-app prompt the agent first asks how to build the GUI
# ("How would you like me to generate the GUI? 1. Auto-generate  2. AI-generated")
# before offering to generate the web app itself.
GUI_QUESTION_TEXTS = ("generate the gui", "auto-generate", "ai-generated")
# The chip that kicks off the actual web-app build once the GUI exists.
GENERATE_WEBAPP_SELECTOR = (
    "button:has-text('Generate web app'), button:has-text('Generate web application'), "
    "button:has-text('Generate application'), button:has-text('Generate app')"
)
DOWNLOAD_SELECTOR = (
    "button:has-text('Download'), a:has-text('Download'), "
    "a[download], button[aria-label*='ownload'], "
    "button:has-text('.zip'), a:has-text('.zip'), "
    "button:has-text('.sql'), a:has-text('.sql'), "
    "button:has-text('.py'), a:has-text('.py')"
)
# If generation genuinely needs a confirmation chip in some variant of the
# flow, click it; it is optional in the database path.
CONTINUE_SELECTOR = (
    "button:has-text('Continue'), button:has-text('Spec-Driven'), "
    "button:has-text('Proceed')"
)
# Extensions we accept for a generated database artifact: raw SQL, or a
# SQLAlchemy/Python model file.
VALID_EXTENSIONS = (".sql", ".py")


def _first_visible(page, selector):
    """Return the first visible locator matching selector, or None."""
    loc = page.locator(selector)
    for i in range(loc.count()):
        item = loc.nth(i)
        try:
            if item.is_visible():
                return item
        except Exception:
            continue
    return None


def _first_enabled_visible(page, selector):
    """Return the first visible AND enabled locator matching selector, or None."""
    loc = page.locator(selector)
    for i in range(loc.count()):
        item = loc.nth(i)
        try:
            if item.is_visible() and item.is_enabled():
                return item
        except Exception:
            continue
    return None


def _wait_for_selector_visible(page, selector, timeout_s):
    """Poll until any element matching selector is visible. Returns the locator."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        item = _first_visible(page, selector)
        if item is not None:
            return item
        page.wait_for_timeout(2000)
    return None


def _wait_for_gone(page, selector, timeout_s):
    """Poll until no visible element matches selector. Returns True if gone."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if _first_visible(page, selector) is None:
            return True
        page.wait_for_timeout(1000)
    return False


def _has_text(page, needle):
    """True if the (case-insensitive) text is visible anywhere on the page."""
    try:
        return page.get_by_text(needle, exact=False).first.is_visible()
    except Exception:
        return False


def _assert_no_server_error(page):
    """Fail fast with a clear message if the backend surfaced an error."""
    for marker in ("Internal server error", "Something went wrong", "Validation failed"):
        if _has_text(page, marker):
            raise AssertionError(
                f"Agent backend returned '{marker}' - generation did not complete "
                "(transient server/model issue; re-run the scenario)."
            )


def _composer_value(page):
    """Current text in the chat composer, or '' if it cannot be read."""
    try:
        return (page.get_by_placeholder(COMPOSER_PLACEHOLDER).first.input_value() or "").strip()
    except Exception:
        return ""


def _send_composer(context, text):
    """Type text into the composer and confirm it is actually submitted.

    The send button is React-driven and a programmatic ``fill`` does not always
    enable it, so a single click/Enter can silently no-op (the text just stays
    in the box). We therefore try multiple submit gestures and verify success
    by waiting for the composer to clear before returning.
    """
    page = context.page
    composer = page.get_by_placeholder(COMPOSER_PLACEHOLDER).first
    composer.click()
    composer.fill(text)
    # A real keystroke makes React register the input and enable the send button.
    composer.press("End")

    for attempt in range(4):
        send = _first_enabled_visible(page, SEND_SELECTOR)
        if send is not None:
            try:
                send.click()
            except Exception:
                pass
        else:
            # No enabled send button exposed: submit from the keyboard.
            composer.press("Enter")

        # Confirm submission: the composer empties once the message is sent.
        deadline = time.time() + 5
        while time.time() < deadline:
            if _composer_value(page) == "":
                return
            page.wait_for_timeout(500)

        # Still not sent - re-type (fill may have been cleared) and retry.
        if _composer_value(page) != text:
            composer.click()
            composer.fill(text)
            composer.press("End")

    raise AssertionError(
        f"Could not submit '{text}' to the agent - composer never cleared "
        f"(still shows: {_composer_value(page)!r})"
    )


@given("I open the BESSER agentic interface")
def step_open(context):
    context.page.goto(context.base_url, wait_until="networkidle")
    context.page.wait_for_timeout(2000)


@given("I dismiss the cookie banner")
def step_cookie(context):
    # The consent banner is aria-hidden, so it is not exposed as a button
    # role; target it by text instead. Harmless if already gone.
    banner_btn = _first_visible(context.page, "button:has-text('Accept')")
    if banner_btn is not None:
        banner_btn.click()
        context.page.wait_for_timeout(800)


@when('I choose the "{label}" natural-language option')
def step_choose_agentic(context, label):
    # On the "How do you want to build?" modal, pick the agentic /
    # natural-language card. Clicking its heading opens the create-project form.
    context.page.get_by_text(label, exact=False).first.click(timeout=15_000)
    context.page.wait_for_timeout(1000)


@when('I click "Create Project"')
def step_create_project(context):
    # The create-project form defaults to the Agentic view when reached from
    # the agentic card, so just confirm creation.
    context.page.get_by_role("button", name="Create Project").click(timeout=15_000)
    # Chat composer appears once the project is created.
    expect(
        context.page.get_by_placeholder(COMPOSER_PLACEHOLDER).first
    ).to_be_visible(timeout=20_000)


@when('I describe "{prompt}"')
def step_describe(context, prompt):
    composer = context.page.get_by_placeholder(COMPOSER_PLACEHOLDER).first
    composer.click()
    composer.fill(prompt)


@when("I submit the description")
def step_submit(context):
    send = _first_enabled_visible(context.page, SEND_SELECTOR)
    if send is not None:
        send.click()
    else:
        # Fall back to Enter if the send button is not exposed.
        context.page.get_by_placeholder(COMPOSER_PLACEHOLDER).first.press("Enter")


@then("the agent produces a spec or model")
def step_spec_ready(context):
    # The agent works for ~1-2 minutes and then posts a "... spec is ready ..."
    # message. Which follow-up chips it shows varies per run, so we key on that
    # message text (artifact-agnostic) and fail fast on a backend error.
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        if any(_has_text(context.page, t) for t in SPEC_READY_TEXTS):
            return
        context.page.wait_for_timeout(2000)
    raise AssertionError("Agent never produced a reviewable spec")


@when("I choose to generate database")
def step_generate_database(context):
    # The agent's flow is not fully deterministic: usually it offers a
    # "Generate database" chip, but it sometimes advances straight from the
    # ready spec to asking the SQL dialect. Click the chip if it appears;
    # otherwise proceed - the dialect-question step below covers both paths.
    btn = _wait_for_selector_visible(context.page, GENERATE_DB_SELECTOR, 20)
    if btn is not None:
        btn.click()
    else:
        _assert_no_server_error(context.page)
        print("[generate] no 'Generate database' chip; agent likely advanced to the dialect question")


@when("I choose to generate the suggested artifact")
def step_generate_suggested(context):
    # Artifact-agnostic: click whichever "Generate <artifact>" chip the agent
    # proposes (e.g. "Generate database", "Generate REST API", "Generate
    # application"), skipping the nav "Generate" button and "Review the spec".
    loc = context.page.locator("button")
    chosen = None
    for i in range(loc.count()):
        item = loc.nth(i)
        try:
            if not item.is_visible():
                continue
            text = item.inner_text().strip()
        except Exception:
            continue
        low = text.lower()
        if low.startswith("generate ") and low not in _NON_CHIP_GENERATE and "review" not in low:
            chosen = item
            context.generated_artifact_label = text
            break
    assert chosen is not None, "No 'Generate <artifact>' suggestion chip found"
    print(f"[generate] chose artifact chip: {context.generated_artifact_label!r}")
    chosen.click()


@then("the agent asks how to generate the GUI")
def step_asks_gui(context):
    # For a web-app prompt the agent posts, after the spec:
    #   "How would you like me to generate the GUI?
    #     1. Auto-generate - Fast & deterministic ...
    #     2. AI-generated (experimental) ..."
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        if any(_has_text(context.page, t) for t in GUI_QUESTION_TEXTS):
            return
        context.page.wait_for_timeout(2000)
    raise AssertionError("Agent never asked how to generate the GUI")


@when('I choose the "{option}" GUI option')
def step_choose_gui_option(context, option):
    # The two GUI options may be offered as clickable chips or expect a typed
    # reply; handle both. `option` is e.g. "Auto-generate".
    chip = _wait_for_selector_visible(
        context.page, f"button:has-text('{option}')", 8
    )
    if chip is not None:
        chip.click()
    else:
        _send_composer(context, option)


@then("the GUI is generated")
def step_gui_generated(context):
    # After auto-generating the GUI the agent confirms and then offers a
    # "Generate web app" action. Wait for that chip as the completion signal.
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        if _first_visible(context.page, GENERATE_WEBAPP_SELECTOR) is not None:
            return
        context.page.wait_for_timeout(2000)
    raise AssertionError(
        "GUI generation did not complete / no 'Generate web app' option appeared"
    )


@when("I choose to generate the web app")
def step_generate_webapp(context):
    btn = _wait_for_selector_visible(context.page, GENERATE_WEBAPP_SELECTOR, 30)
    if btn is not None:
        btn.click()
        return
    # Fall back to the generic "Generate <artifact>" chip logic.
    _assert_no_server_error(context.page)
    step_generate_suggested(context)


@when('I answer "{text}"')
def step_answer(context, text):
    # Generic reply to a free-text follow-up question from the agent
    # (e.g. a framework or dialect choice).
    _send_composer(context, text)


@then("the agent asks which database type to generate")
def step_asks_db_type(context):
    # The agent replies in free text, e.g.:
    #   "Which SQL dialect should I target? Options: sqlite, postgresql, ..."
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        if _has_text(context.page, "dialect") or _has_text(context.page, "sqlite"):
            return
        context.page.wait_for_timeout(2000)
    raise AssertionError("Agent never asked for the database type / SQL dialect")


@when('I answer the database type "{db_type}"')
def step_answer_db_type(context, db_type):
    _send_composer(context, db_type)


@then("the agent asks which JSON Schema mode to use")
def step_asks_json_schema_mode(context):
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        if _has_text(context.page, "json schema mode") or _has_text(context.page, "smart_data"):
            return
        context.page.wait_for_timeout(2000)
    raise AssertionError("Agent never asked for the JSON Schema mode")


@then("the code generation finishes")
def step_generation_finishes(context):
    # After answering the dialect the agent generates directly. Poll for a
    # download affordance; click an (optional) continue/proceed chip if one
    # appears, and fail fast on a backend error instead of hanging.
    deadline = time.time() + context.agent_timeout
    while time.time() < deadline:
        _assert_no_server_error(context.page)
        dl = _first_visible(context.page, DOWNLOAD_SELECTOR)
        if dl is not None:
            context.download_trigger = dl
            return
        cont = _first_visible(context.page, CONTINUE_SELECTOR)
        if cont is not None:
            cont.click()
        context.page.wait_for_timeout(2000)
    raise AssertionError("Code generation never produced a download option")


@then("I can download the generated code")
def step_download(context):
    trigger = getattr(context, "download_trigger", None) or _first_visible(
        context.page, DOWNLOAD_SELECTOR
    )
    assert trigger is not None, "No download trigger available"

    with context.page.expect_download(timeout=60_000) as download_info:
        trigger.click()
    download = download_info.value

    filename = download.suggested_filename
    target = context.download_dir / filename
    download.save_as(str(target))
    context.download_path = target

    assert target.exists(), f"Downloaded file not saved: {target}"
    assert target.stat().st_size > 0, f"Downloaded file is empty: {target}"
    print(f"[download] saved {target} ({target.stat().st_size} bytes)")


@then("the downloaded file is a .sql or .py file")
def step_verify_download_type(context):
    path = getattr(context, "download_path", None)
    assert path is not None and path.exists(), "No downloaded file to verify"

    name = path.name.lower()
    if name.endswith(".zip") or zipfile.is_zipfile(str(path)):
        # A bundle: it must contain at least one .sql or .py file.
        with zipfile.ZipFile(str(path)) as zf:
            members = [n for n in zf.namelist() if not n.endswith("/")]
        matches = [n for n in members if n.lower().endswith(VALID_EXTENSIONS)]
        assert matches, (
            f"Archive '{path.name}' contains no .sql or .py file. "
            f"Members: {members}"
        )
        print(f"[verify] archive contains {len(matches)} .sql/.py file(s): {matches[:10]}")
    else:
        # A single file: its extension must be .sql or .py.
        assert name.endswith(VALID_EXTENSIONS), (
            f"Downloaded file '{path.name}' is not a .sql or .py file"
        )
        print(f"[verify] single file OK: {path.name}")


@then("the downloaded file is a zip archive")
def step_verify_download_zip(context):
    # For multi-file artifacts (e.g. a REST API project) we only require that a
    # zip bundle was downloaded - not any particular file inside it.
    path = getattr(context, "download_path", None)
    assert path is not None and path.exists(), "No downloaded file to verify"

    is_zip = path.name.lower().endswith(".zip") or zipfile.is_zipfile(str(path))
    assert is_zip, f"Downloaded file '{path.name}' is not a .zip archive"
    print(f"[verify] zip archive OK: {path.name}")

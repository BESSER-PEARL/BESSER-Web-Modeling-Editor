import sys
import types
from pathlib import Path


def pytest_configure():
    """Ensure the ModelingAgent package and Besser stubs are available before tests import modules."""
    project_root = Path(__file__).resolve().parents[2]
    modeling_agent_dir = project_root / "ModelingAgent"

    for path in (str(project_root), str(modeling_agent_dir)):
        if path not in sys.path:
            sys.path.insert(0, path)

    _install_besser_stubs()


def _install_besser_stubs():
    """Provide lightweight stand-ins for the Besser agent framework so the bot module can import cleanly."""
    if "besser.agent.core.agent" in sys.modules:
        return

    def ensure_module(name: str, is_package: bool = True) -> types.ModuleType:
        module = sys.modules.get(name)
        if module:
            return module
        module = types.ModuleType(name)
        if is_package:
            module.__path__ = []
        sys.modules[name] = module
        return module

    # Base package hierarchy
    besser_pkg = ensure_module("besser")
    agent_pkg = ensure_module("besser.agent")
    core_pkg = ensure_module("besser.agent.core")
    library_pkg = ensure_module("besser.agent.library")
    transition_pkg = ensure_module("besser.agent.library.transition")
    events_pkg = ensure_module("besser.agent.library.transition.events")
    exceptions_pkg = ensure_module("besser.agent.exceptions")
    nlp_pkg = ensure_module("besser.agent.nlp")
    intent_pkg = ensure_module("besser.agent.nlp.intent_classifier")
    llm_pkg = ensure_module("besser.agent.nlp.llm")

    core_agent_pkg = ensure_module("besser.agent.core.agent", is_package=False)
    core_session_pkg = ensure_module("besser.agent.core.session", is_package=False)
    base_events_pkg = ensure_module("besser.agent.library.transition.events.base_events", is_package=False)
    logger_pkg = ensure_module("besser.agent.exceptions.logger", is_package=False)
    intent_config_pkg = ensure_module(
        "besser.agent.nlp.intent_classifier.intent_classifier_configuration", is_package=False
    )
    llm_openai_pkg = ensure_module("besser.agent.nlp.llm.llm_openai_api", is_package=False)

    # Wire attributes so dotted imports resolve
    besser_pkg.agent = agent_pkg
    agent_pkg.core = core_pkg
    agent_pkg.library = library_pkg
    agent_pkg.exceptions = exceptions_pkg
    agent_pkg.nlp = nlp_pkg

    core_pkg.agent = core_agent_pkg
    core_pkg.session = core_session_pkg
    library_pkg.transition = transition_pkg
    transition_pkg.events = events_pkg
    events_pkg.base_events = base_events_pkg
    exceptions_pkg.logger = logger_pkg
    nlp_pkg.intent_classifier = intent_pkg
    nlp_pkg.llm = llm_pkg
    intent_pkg.intent_classifier_configuration = intent_config_pkg
    llm_pkg.llm_openai_api = llm_openai_pkg

    # Stub implementations -------------------------------------------------
    class FakeLogger:
        def __init__(self):
            self.records = []
            self.level = None

        def info(self, message):
            self.records.append(("info", message))

        def error(self, message):
            self.records.append(("error", message))

        def warning(self, message):
            self.records.append(("warning", message))

        def setLevel(self, level):
            self.level = level

    class FakeTransitionBuilder:
        def __init__(self, state, trigger):
            self.state = state
            self.trigger = trigger
            self.conditions = []

        def with_condition(self, func, params):
            self.conditions.append(("with_condition", func, params))
            return self

        def go_to(self, target_state):
            self.state.transitions.append((self.trigger, self.conditions, target_state))
            return target_state

    class FakeIntent:
        def __init__(self, name, description=""):
            self.name = name
            self.description = description

    class FakeState:
        def __init__(self, name, initial=False):
            self.name = name
            self.initial = initial
            self.body = None
            self.transitions = []

        def set_body(self, func):
            self.body = func
            return func

        def when_intent_matched(self, intent):
            return FakeTransitionBuilder(self, ("intent", intent))

        def when_event(self, event):
            return FakeTransitionBuilder(self, ("event", event))

        def when_no_intent_matched(self):
            return FakeTransitionBuilder(self, ("no_intent", None))

        def when_condition(self, func, params):
            return FakeTransitionBuilder(self, ("condition", func, params))

    class FakeWebsocketPlatform:
        def __init__(self, use_ui=False):
            self.use_ui = use_ui

    class FakeAgent:
        def __init__(self, name):
            self.name = name
            self.states = {}
            self.intents = {}
            self.loaded_properties = None
            self.default_ic_config = None
            self.ran = False

        def load_properties(self, path):
            self.loaded_properties = path

        def use_websocket_platform(self, use_ui=False):
            return FakeWebsocketPlatform(use_ui=use_ui)

        def set_default_ic_config(self, config):
            self.default_ic_config = config

        def set_global_fallback_body(self, func):
            self.global_fallback = func

        def new_state(self, name, initial=False):
            state = FakeState(name, initial=initial)
            self.states[name] = state
            return state

        def new_intent(self, name, description=""):
            intent = FakeIntent(name, description)
            self.intents[name] = intent
            return intent

        def run(self):
            self.ran = True

    class Session:
        def __init__(self):
            self._store = {}
            self.event = None
            self.replies = []

        def get(self, key, default=None):
            return self._store.get(key, default)

        def set(self, key, value):
            self._store[key] = value

        def delete(self, key):
            self._store.pop(key, None)

        def reply(self, message):
            self.replies.append(message)

    class ReceiveJSONEvent:
        def __init__(self, message="", data=None):
            self.message = message
            self.data = data or {}

    class LLMIntentClassifierConfiguration:
        def __init__(self, **kwargs):
            self.options = kwargs

    class FakeLLM:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs
            self.responses = []
            self.default_response = "{}"

        def queue_response(self, response_text):
            self.responses.append(response_text)

        def predict(self, prompt):
            if self.responses:
                return self.responses.pop(0)
            return self.default_response

    # Export stubs through modules
    core_agent_pkg.Agent = FakeAgent
    core_session_pkg.Session = Session
    base_events_pkg.ReceiveJSONEvent = ReceiveJSONEvent
    logger_pkg.logger = FakeLogger()
    intent_config_pkg.LLMIntentClassifierConfiguration = LLMIntentClassifierConfiguration
    llm_openai_pkg.LLMOpenAI = FakeLLM

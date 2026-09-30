Feature: BESSER agentic interface end-to-end workflow
  As a user of the BESSER web modeling editor
  I want to describe a system in plain language
  So that the agent generates a spec and the artifact I asked for, and lets me download it

  # All flows share the same entry (describe -> spec). After the spec is ready
  # the flow branches by artifact type:
  #   * database  -> the agent asks for a SQL dialect, then emits a .sql/.py file
  #   * web app   -> the agent asks how to build the GUI, then emits a zip bundle
  #   * everything else -> a single "Generate <artifact>" chip -> download
  # Database and web app therefore get dedicated scenarios; the remaining types
  # share one Scenario Outline driven by the prompt.

  @e2e @agent @database
  Scenario: Generate and download a database
    Given I open the BESSER agentic interface
    And I dismiss the cookie banner
    When I choose the "AGENTIC" natural-language option
    And I click "Create Project"
    And I describe "Create a database for a hospital management system."
    And I submit the description
    Then the agent produces a spec or model
    When I choose to generate database
    Then the agent asks which database type to generate
    When I answer the database type "sqlite"
    Then the code generation finishes
    And I can download the generated code
    And the downloaded file is a .sql or .py file

  @e2e @agent @jsonschema
  Scenario: Generate and download a JSON Schema
    Given I open the BESSER agentic interface
    And I dismiss the cookie banner
    When I choose the "AGENTIC" natural-language option
    And I click "Create Project"
    And I describe "I need to design a hospital management system and generate a JSON Schema."
    And I submit the description
    Then the agent produces a spec or model
    When I choose to generate the suggested artifact
    Then the agent asks which JSON Schema mode to use
    When I answer "regular"
    Then the code generation finishes
    And I can download the generated code

  @e2e @agent @webapp
  Scenario: Generate and download a web app
    Given I open the BESSER agentic interface
    And I dismiss the cookie banner
    When I choose the "AGENTIC" natural-language option
    And I click "Create Project"
    And I describe "Build a web application for a hospital management system."
    And I submit the description
    Then the agent produces a spec or model
    Then the agent asks how to generate the GUI
    When I choose the "Auto-generate" GUI option
    Then the GUI is generated

  # Types that share the generic "pick the suggested chip -> download" flow.
  # Each Examples row runs and is reported as its own scenario.
  @e2e @agent @generic
  Scenario Outline: Generate and download <generation>
    Given I open the BESSER agentic interface
    And I dismiss the cookie banner
    When I choose the "AGENTIC" natural-language option
    And I click "Create Project"
    And I describe "<prompt>"
    And I submit the description
    Then the agent produces a spec or model
    When I choose to generate the suggested artifact
    Then the code generation finishes
    And I can download the generated code

    Examples: Generation types
      | generation        | prompt                                                         |
      | a Django app      | I need a Django application for a hospital management system.  |
      | a backend         | Create a backend for a hospital management system.             |
      | a REST API        | Create a REST API for a hospital management system.            |
      | Python classes    | I need the Python classes for a hospital management system.    |
      | Java classes      | I need to design a hospital management system and generate the java classes. |
      | Pydantic models   | I need to design a hospital management system and generate the Pydantic models. |
      | a Smart Data Model| I need to design a hospital management system and generate a Smart Data Model. |
      | an RDF vocabulary | I need to design a hospital management system and generate an RDF vocabulary. |
      | a Qiskit circuit  | Create a Qiskit quantum circuit that prepares a Bell state.    |
Traceability
============

Traceability answers *where did this come from, and is it still in step?* for a
project. When it is on, the editor keeps a **trace** of the project: who changed
which diagram element and when (you, the :doc:`AI assistant <ai-assistant>`, or
a generator such as a template load or an import), which requirements and
prompts a model came from, and which generated code came from which model
element.

The trace is made of *artifacts* (diagrams and their elements, prompts,
requirements, generated files and the fragments of them), *operations* (a
modeling session, a conversation with the assistant, a requirement extraction, a
code generation) and *trace links* between artifacts.

A **cross-artefact trace link** joins two *different* artefacts, for example a
class and the code generated from it, a requirement and the class that realizes
it, or a BPMN task and the component derived from it. Edits within one diagram
are history, not links. A link **may be out of date** when its source, its
target, or something its source was derived from changed after the link was
made: the code (or the derived model) may then no longer match.

The trace lives in your browser with the project and is never sent to a BESSER
server, except the bounded summary the assistant receives (see
`Ask the assistant about the trace`_). For what exactly is recorded, see
:doc:`../webapp/traceability-recording`.

Turn recording on
-----------------

Recording is **off** for a new project. To turn it on:

#. Open the project and choose **Traceability** in the sidebar, below the
   diagram editors.
#. In the page header, tick **Record traces for this project**. The badge next
   to it changes from *Off* to *On*.

While nothing has been recorded and recording is off, the page also shows a
**Turn recording on** button, which does the same. From then on every save of a
diagram and every generation from the Generate menu is recorded. Untick the box
to stop recording: what is already in the trace stays, and the page says
*Trace recording is off* with a **Turn recording on** button.

Recording is per project and is saved with it. Two things to know:

* Nothing is recorded retroactively. An element that existed before recording
  started shows *No edits recorded* until you change it.
* *Deploy locally* and *Deploy to GitHub* are not recorded; generate the code
  from the Generate menu to have it traced.

After a traced generation, the success message has a **View trace** link that
opens the page on that run.

The **Clear** button in the header deletes the whole trace of the project
after a confirmation. To keep a copy first, export the project and tick
*Traceability* in the export dialog.

The summary
-----------

Once something is recorded, the top of the page shows four figures. Hover or
focus the info icon next to each for what it counts:

**operations recorded**
   Everything recorded for this project: modeling sessions, conversations with
   the assistant, requirement extractions and code generations.

**artifacts**
   What the trace knows about: diagrams and their elements, prompts,
   requirements and generated files.

**cross-artefact trace links**
   Links between two different artefacts. Counted for the project *as it is
   now*: the newest run of each generator, without deleted elements.

**links may be out of date**
   The cross-artefact trace links whose source, target, or something the source
   was derived from changed after the link was made. Green with a check mark
   when it is 0, amber with a warning sign otherwise.

When generated code is out of date, a line per generator is listed under the
figures, for example *SQLAlchemy: 3 files out of date — regenerate to bring the
code generated on … up to date*, with the first file paths and a **View
coverage** button.

The views
---------

Below the summary, five tabs: **Timeline**, **Diagrams**, **Coverage**,
**Lineage** and **Requirements**. The page keeps the tab and selection in its
address, so a link (or the browser's back button) brings you back to the same
view.

Timeline
~~~~~~~~

Every operation, newest first: modeling sessions (yours, with the assistant, or
*Written by* a generator), code generations, requirement extractions and
conversations. Filter by kind (*All*, *Modeling*, *Code generation*,
*Requirements*, *Conversations*), by actor and by date, or search changes,
messages, requirements and files. Open an operation to see its changes one by
one, its files and the elements it traced.

Diagrams
~~~~~~~~

A tree of the project's diagrams on the left, with their elements and members
(a class's attributes and methods, for example) under them, sorted by name. It
has an entry for every diagram and element the trace holds:

* each diagram the trace has recorded (a diagram gets its entry with its first
  recorded edit, or when a generation reads it);
* each element of it that reaches the B-UML model, recorded when it was
  created or changed while recording was on, or read by a traced generation.
  Layout is never recorded, so moving an element changes nothing;
* deleted elements too, struck through, so their history and old code stay
  reachable.

Search the tree with *Search diagrams and elements…*. Pick a diagram or an
element to see, on the right:

* **Generated code**: the fragments generated from it, newest generation first,
  each marked *Up to date* or *Out of date*, with its lines, the template rule
  and confidence that made the link, and **Show the file**. Fragments from
  older generations are behind *Show N fragments from older generations*.
* **History**: every recorded change, by whom and when.
* **Show lineage**, which opens the Lineage view starting from it.

Coverage
~~~~~~~~

A matrix of diagrams and their elements (rows) against the newest generation
runs (columns, at most eight). Each cell is *Generated, unchanged since* (check
mark), *Out of date (changed after generation)* (amber warning sign) or *Not in
this generation*. Click a row's name to open it in the Diagrams view.

Lineage
~~~~~~~

What was derived from what, drawn left to right: diagrams, prompts and
requirements, generation runs, generated files, as cards joined by lines, one
line per trace link (or per bundle of links).

The toolbar:

* **Lineage of**: start from the whole project (the default) or from one model,
  prompt, requirement or file.
* **Show history**: *off*, only the project as it is now (the newest run of
  each generator); *on*, also older generations and deleted elements, with
  their trace links. The info icon next to it says the same.
* **Expand all** / **Collapse all**, zoom, and **Full screen** (Esc leaves it).

The legend under the toolbar explains the lines; hover or focus an entry for
its tooltip:

**Rule**
   Made by a deterministic rule of a generator's template: the same model always
   gives this link.

**AI decision (its pill says "AI")**
   Made by an AI decision (the assistant or an AI-based generator); its pill
   shows "AI" and the confidence.

**Out of date** (amber line, warning sign)
   One end of the link changed after the link was made, so the code or model
   it points to may no longer match.

**Upstream changed** (amber dashed line)
   Neither end changed, but something the source was derived from did, for
   example the diagram the source was generated from. The source may need
   regenerating, and this link with it.

**Thicker: more confident**
   The thicker the line, the more confident the link. A link below full
   confidence shows its confidence on its pill.

**Pills.** A line that has something to say carries a small pill:

* ``×12`` — the line bundles 12 links. Click the pill to show them one by one.
* ``×12 (⚠ 3 out of date)`` — of those 12 links, 3 may be out of date. The
  warning sign goes with the out-of-date count, not with the total.
* ``⚠ 0.80`` or ``AI 0.80`` — a single link: the warning sign when it may be
  out of date, "AI" for an AI decision, and its confidence.

Click a diagram or generation run to see its parts, a part to see its links,
and a line to see how its link was made: its confidence, its evidence, the
operation that made it and, when it is out of date, why (*source changed*,
*target changed* or *upstream changed*) and the changes since. With nothing
selected, the side panel gives an overview: how many cards and links, how many
links may be out of date, and the list of connectors with the same
``×N (⚠ M out of date)`` counts.

Requirements
~~~~~~~~~~~~

The requirements the assistant extracted from your requests, each with the
model elements that realize it, the generated code and a verdict. Filter by
coverage: *Not covered*, *Modeled only* (*Modeled, no code yet*) or *Generated*
(*Realized and generated*). The view fills once the assistant has extracted
requirements, which it does only while recording is on.

Realign an out-of-date project
------------------------------

When the summary shows links that may be out of date:

#. **See what is affected.** Read the amber lines under the summary: one per
   generator whose code is behind, with its files. Click **View coverage**: the
   amber cells show which elements changed after which generation.
#. **Find the cause.** Click the element's row in Coverage to open it in the
   Diagrams view; its *History* shows the changes since the generation, and
   each *Out of date* fragment says the same. In the Lineage view, select an
   amber line to see whether the *source*, the *target* or something
   *upstream* changed.
#. **Fix upstream first.** For an *Upstream changed* link, the model the
   source was derived from changed: update or derive that diagram again before
   regenerating from it, or the new code is built on a stale model.
#. **Regenerate.** Run the same generator again from the Generate menu, on the
   same diagram (recording must be on). The new run's links replace the old
   ones in the current view, so its files are up to date.
#. **Check.** The *links may be out of date* figure goes down (to 0 and green
   when everything is realigned) and the generator's amber line disappears.
   Older runs stay in the trace; turn on **Show history** in the Lineage view
   to see them.

A link from an element you deleted on purpose does not count: the current view
leaves deleted elements out.

Ask the assistant about the trace
---------------------------------

In a project that records traces and has something recorded, the
:doc:`AI assistant <ai-assistant>` can answer questions about it, such as
*"What is out of date?"*, *"Why does Book have an isbn?"* or *"Which
requirements are not covered?"*. With each message the editor sends a
bounded **trace digest**: counts, recent operations, requirements, out-of-date
links, generations, and the history and generated code of the elements your
message names. Generated file contents and prompt texts are never sent. An
answer can end with a button that opens this page on the matching view.

Asking about the element selected on the canvas, without naming it (*"What is
the impact if I change this?"*), comes with the assistant support of
WME PR #308.

Turn recording off to stop sending the digest; see *Privacy* in
:doc:`ai-assistant`.

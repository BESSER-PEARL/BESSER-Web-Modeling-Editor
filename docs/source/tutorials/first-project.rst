Tutorial: Your First Project
=============================

In this tutorial you will create a simple library model, validate it, and
generate a Python backend -- all within the BESSER Web Modeling Editor. By the
end you will understand projects, class diagrams, and code generation.

.. note::
   This tutorial uses the online editor at
   `editor.besser-pearl.org <https://editor.besser-pearl.org>`_.
   No installation is required.

Step 1: Create a Project
------------------------

1. Open the editor in your browser.
2. Click **File > New / Open / Import Project**.
3. Enter a project name (e.g., "My Library") and click **Create Project**.

You are now in the editor with an empty class diagram canvas.

Step 2: Add Classes
-------------------

Let's model a simple library with books and authors.

1. From the **Palette** on the left, drag a **Class** element onto the canvas.
2. Double-click the class to open its properties.
3. Set the name to ``Book``.
4. Add attributes (one per line):

   .. code-block:: text

      + title: str
      + pages: int
      + price: float

5. Drag another **Class** onto the canvas and name it ``Author``.
6. Add attributes:

   .. code-block:: text

      + name: str
      + birth: date

Step 3: Add a Relationship
--------------------------

1. Click on the ``Book`` class.
2. Drag from a blue connection point on ``Book`` to the ``Author`` class.
3. A relationship line appears. Double-click it to edit properties.
4. Set the **Name** to ``written_by``.
5. Set the **Type** to ``Bidirectional``.
6. Set the multiplicity: ``*`` on the Book side, ``1..*`` on the Author side
   (a book has one or more authors, an author can write many books).

Step 4: Add an Enumeration
--------------------------

1. Drag an **Enumeration** from the palette onto the canvas.
2. Double-click it and set the name to ``Genre``.
3. Add values (one per line): ``Poetry``, ``Thriller``, ``History``, ``Romance``.
4. Now open the ``Book`` class properties and add an attribute:

   .. code-block:: text

      + genre: Genre

Step 5: Validate Your Model
----------------------------

1. Click the **Quality Check** button in the top bar.
2. If your model has no errors, you will see a success message.
3. If there are issues (e.g., duplicate class names), the editor will show
   specific error messages.

Step 6: Generate Code
---------------------

1. Click the **Generate** menu in the top bar.
2. Select **Python Classes** from the dropdown.
3. A ``.py`` file is downloaded containing Python class definitions for
   ``Book``, ``Author``, and ``Genre``.

You can also try other generators:

- **SQL DDL**: Generates SQL ``CREATE TABLE`` statements.
- **Django**: Generates a full Django project with admin panel.
- **Full Web App**: Generates a React + FastAPI application (requires a GUI
  diagram -- see :doc:`../user-guide/diagrams/gui-diagram`).

Step 7: Explore Further
------------------------

Now that you have the basics, try:

- Adding **methods** to your classes (e.g., ``+ get_full_name(): str``).
- Adding **OCL constraints** (drag from palette, write rules like
  ``context Book inv: self.pages > 0``).
- Creating an **Object Diagram** to model specific instances.
- Switching to a **State Machine** or **Agent Diagram** via the left sidebar.

See :doc:`../user-guide/diagrams/index` for detailed guides on each diagram type.

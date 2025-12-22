Class Diagrams
==============

Class diagrams provide a visual representation of the :doc:`structural model <../../../buml_language/model_types/structural>` in BESSER. This diagram shows the static structure of a system by displaying classes, their attributes, methods, and the relationships between them.

Palette
-------

The palette on the left side of the editor contains various shapes and elements you can use to create your class diagram. These include **Classes** (with or without methods), **Enumerations**, and **OCL Constraints**. Other elements like **Associations**, **Generalizations**, and **Association Classes** can be added directly from the canvas.

Getting Started
---------------

Classes
~~~~~~~

To add a class to your diagram, drag and drop a class element from the left panel onto the canvas. You can open and edit the class properties by double-clicking on the class shape:

.. image:: ../../images/wme/class_diagram/class_prop.png
  :width: 310
  :alt: Class properties
  :align: center

*   **Name**: The name of the class (without spaces).
*   **Abstract**: Mark the class as abstract if it cannot be instantiated.
*   **Enumeration**: Change the type to define an Enumeration.
*   **Attributes**: Define the properties of the class.
*   **Methods**: Define the behaviors of the class.

Attribute Format
~~~~~~~~~~~~~~~~

Attributes can be defined using the following format:

``<<visibility modifier>> <<attribute_name>> : <<data_type>>``

**Visibility Modifiers:**

*   ``+`` Public (default)
*   ``-`` Private
*   ``#`` Protected

**Supported Data Types:**

``int``, ``float``, ``str`` (default), ``bool``, ``time``, ``date``, ``datetime``, ``timedelta``, ``any``. You can also use the name of an Enumeration defined in the diagram.

**Examples:**

*   ``+ age: int``
*   ``address`` (defaults to public string)
*   ``state: StateList``

Method Format
~~~~~~~~~~~~~

Methods can be defined with parameters and return types:

``<<visibility modifier>> <<method_name>>(<<parameter_name>>: <<data_type>>): <<return_type>>``

**Examples:**

*   ``+ notify(sms: str = 'message')``
*   ``- findBook(title: str): Book``
*   ``validate()``

Associations and Generalizations
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To create relationships between classes:

1.  Click the source class.
2.  Drag from a blue connection point to the target class.
3.  Double-click the relationship line to edit its properties.

.. image:: ../../images/wme/class_diagram/relationship_prop.png
  :width: 350
  :alt: Association properties
  :align: center

*   **Name**: Assign a name to the association.
*   **Type**: Unidirectional, Bidirectional, Composition, or Generalization.
*   **Multiplicity**: Define cardinality (e.g., ``1``, ``0..1``, ``*``, ``1..*``).

OCL Constraints
~~~~~~~~~~~~~~~

You can add Object Constraint Language (OCL) constraints to your model:

1.  Drag the OCL shape onto the canvas.
2.  Write constraints in the format ``Context "class_name" ...``.
3.  Link them to classes with dotted lines.
4.  Use the **Quality Check** button to validate the syntax.

**Example:**

.. code-block:: ocl

    Context "Person"
    inv: self.age >= 0 and self.age <= 120

Association Classes
~~~~~~~~~~~~~~~~~~~

To create an association class:

1.  Drag a Class shape onto the canvas.
2.  Link it to the center point of an existing association using a dotted line.
3.  Define its attributes like a regular class.

.. image:: ../../images/wme/class_diagram/asso_class.png
  :width: 400
  :alt: Association Class
  :align: center

Code Generation
~~~~~~~~~~~~~~~

Class diagrams support generation for:

*   Django
*   SQL
*   SQLAlchemy
*   Python (Pydantic)
*   Java
*   JSON Schema

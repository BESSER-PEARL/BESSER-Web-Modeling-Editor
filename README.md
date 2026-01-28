# BESSER Web Modeling Editor

BESSER Web Modeling Editor is the  version of the BESSER WME Editor for creating and editing diagrams. It can be used as graphical front-end for the [BESSER low-code platform](https://github.com/BESSER-PEARL/BESSER).

You can use this editor:
-As an online web application – Now freely available and ready-to-use at [BESSER WME Online](https://editor.besser-pearl.org), providing seamless access without installation.

It consists of following features:

## Main Features

### No account needed to use

Users can use all the features of  without the necessity of creating an account.
All you have to do is open the application and start drawing.

### Easy to use editor

The user interface of BESSER WME is simple to use.
It works just like any other office and drawing tool that most users are familiar with.

- Select the diagram type you want to draw by clicking on the `File > New` menu. This selection determines the availability of elements that the user can use while drawing their diagram, making it easier for users who are newly introduced to modeling.
- Adding the element is as easy as dragging it from the elements menu and dropping it to the canvas. So is drawing the connection between them, simply drag and connect two or multiple elements.
- The layout of the connection is drawn automatically by the editor. If you want to manually layout it, use the existing waypoints features.
- Edit or style the text or change the colors of any elements by double-clicking on them. An easy-to-use menu will allow you to do so.
- Use keyboard shortcuts to copy, paste, delete and move the elements throughout the canvas.
- Change the theme of the editor by clicking on the dark/light mode switch.

### Import and Export your diagrams

Users can easily import existing BESSER WME diagrams to any editor that uses the BESSER WME library and continue editing.

<!-- ![Import Diagram](/docs/images/Import.gif 'Import Diagram') -->

Exporting the diagrams is as easy as importing them.
Click on `File > Export` and select the format of the diagram to be exported as.
Currently, BESSER WME supports five different formats: `SVG`, `PNG (White Background)`, `PNG (Transparent Background)`, `JSON`, and `PDF`.

<!-- ![Export Diagram](/docs/images/Export.png 'Export Diagram') -->

### Create diagram from template

Users in BESSER WME  can also create a diagram from a template if they do not want to draw a diagram from scratch.
To do that, all they have to do is click on `File > Start from Template` and select one of the templates from the list of available templates.

<!-- ![Start from Template](/docs/images/StartFromTemplate.gif 'Start from Template') -->


## Under the Hood: Diagram Engine as an npm Package

BESSER WME  uses the core diagramming functionality provided by the [BESSER Web Modeling Editor (BESSER-WME)](https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor), which is integrated as an [**npm package**](https://www.npmjs.com/package/@besser/wme) .

This separation allows the  application to focus on delivering additional capabilities such as:

- Diagram sharing modes
- Template management
- Export/import/generation to multiple formats
- Hosting via application server or Docker

Meanwhile, all **diagram rendering and editing** logic is delegated to the BESSER-WME library, ensuring consistency and reusability across multiple front-ends or integrations.


## Contributing

We encourage contributions from the community and any comment is welcome!

If you are interested in contributing to this project, please read the [CONTRIBUTING.md](CONTRIBUTING.md) file.


## Code of Conduct

At BESSER, our commitment is centered on establishing and maintaining development environments that are welcoming, inclusive, safe and free from all forms of harassment. All participants are expected to voluntarily respect and support our [Code of Conduct](CODE_OF_CONDUCT.md).

## Governance

The development of this project follows the governance rules described in the [GOVERNANCE.md](GOVERNANCE.md) document.

## Contact
You can reach us at: [info@besser-pearl.org](mailto:info@besser-pearl-org)


## Build the application

### Web application only

```
# clone the repository
git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-

# install the dependencies
npm install

# set environment variable
export APPLICATION_SERVER_VERSION=0

# build the web application
npm run build:webapp

# the output can be found in build/webapp directory of the project root
```


## License

This project is licensed under the [MIT](https://mit-license.org/) license

# BESSER Web Modeling Editor

BESSER Web Modeling Editor is the  version of the BESSER WME Editor for creating and editing diagrams. It can be used as graphical front-end for the [BESSER low-code platform](https://github.com/BESSER-PEARL/BESSER).

There are two variants how you can use this editor:

1. As an online web application – Now freely available and ready-to-use at [BESSER WME Online](https://editor.besser-pearl.org), providing seamless access without installation.
2. With an application server which enables some extra features, like sharing of diagrams.

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
- Export/import/generationn to multiple formats
- Hosting via application server or Docker
- Redis-based storage

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

#### Hosting

The application can be hosted by any http server which can serve static files, e.g. nginx or aws s3.
Simply point your URL to the index.html of the web application (build/webapp/index.html) and the single
page application will be loaded.

### Web application + application server

There are two variants to set this up:

1. Manual on a linux vm
2. In a docker container

#### Manual setup (Installation of application server on linux machine)

> [!IMPORTANT]  
> Please make sure if there is any requirements regarding additional dependencies to build the node canvas package for
> your operating system! You can find instructions for installing these dependencies here:
> https://github.com/Automattic/node-canvas#compiling

```
# clone the repository
git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-

# install the dependencies
npm install

# set environment variable
export APPLICATION_SERVER_VERSION=1
export DEPLOYMENT_URL=https://editor.besser-pearl.org

# build the web application and the application server
npm run build

# the output can be found in build/webapp and build/server directory of the project root
```

Add a user for the application:

```
sudo useradd -r -s /bin/false besser_wme

# give ownage of files to application user
chown -R besser_wme path/to/application
```

Make a directory for the shared diagrams to be stored

```
# create directory where shared diagrams of users are stored
mkdir path/to/diagrams

# give ownage to application user
chown besser_wme path/to/diagrams
```

Add the path to the created directory to:

- the cronjob in delete-stale-diagrams.cronjob.txt
- in packages/server/src/main/constants.ts

#### Install as a service

Configure the besser_wme.service file so that the paths
match the paths to your installation folder

```
# After adjusting the service file, copy the service file besser_wme.service
# into the /etc/systemd/system directory service besser_wme start
cp besser_wme.service /etc/systemd/system/

# make sure the server.js file is executable by application user
cd path/to/application/build/server
chmod +x server.js

# Start the service
sudo service besser_wme_ start

# Status of the service
service besser_wme status
```

Error codes on server start:

- (code=exited, status=217/USER) -> besser_wme user does not exist
- (code=exited, status=203/USER) -> script not executable

#### Install the cronjob for deleting stale diagrams

Install the cronjob for deleting stale files

```
# create a log file for the cron job
touch /var/log/cron.log
chmod 622 /var/log/cron.log

# adjust period after which stale diagrams should be deleted
# cronjob file: delete-stale-diagrams.cronjob.txt
# default: delete stale diagrams after 12 weeks

# installs cronjob with application user
crontab -u besser_wme_ delete-stale-diagrams.cronjob.txt
```

Remove cronjob

`crontab -r -u besser_wme_`

### Docker Container

Caveat: cronjob to clean the diagrams after 12 weeks is currently not running in the container

```
# clone the repository
git clone https://github.com/yourusername/BESSER_WME_

# build docker container
docker build -t besser_wme_ .

run docker container
docker run -d --name besser_wme_ -p 8080:8080 besser_wme_

# build the web application and the application server
npm run build

# the output can be found in build/webapp and build/server directory of the project root
```

useful command to debug:

```
# start bash in running docker container to look at internal files
docker run -it --entrypoint /bin/bash besser_wme_
```

## Redis Storage

Alternative to a filesystem, the application server can use a Redis database to store the shared diagrams.
To use Redis, set the environment variable `APOLLON_REDIS_URL` to the URL of the Redis database.

> [!IMPORTANT]
> BESSER WME  requires the Redis JSON module to be enabled. [Read the documents](https://redis.io/docs/latest/develop/data-types/json/) to learn how to enable the JSON module.

```bash
APOLLON_REDIS_URL=redis://[[username]:[password]@][host][:port]
```

For example:

```bash
export APOLLON_REDIS_URL=redis://alice:foobared@awesome.redis.server:6380
```

You can also set the `APOLLON_REDIS_URL` to an empty string, in which case `localhost:6379` will be used as the default.

```bash
export APOLLON_REDIS_URL=""
```

You can also set `APOLLON_REDIS_DIAGRAM_TTL` environment variable to set the time-to-live for the shared diagrams in Redis. If not provided, shared diagrams will be stored indefinitely. The specified duration is parsed using the [ms](https://www.npmjs.com/package/ms) package, so you can use human-readable strings like `1d`, `2h`, `30m`, etc.

```bash
export APOLLON_REDIS_DIAGRAM_TTL="30d"
```

### Deploying with Redis and Docker

BESSER WME , using Redis as its storage, can be deployed using Docker. To do that, follow these steps:

#### STEP 1: Clone the code

```bash
git clone https://github.com/yourusername/BESSER_WME_.git
```

#### STEP 2: Configure the environment

> [!NOTE]
> You can skip this step for local deployment.

Add a `.env` file in the root folder of the code. Add the following variables:

```toml
# The URL of the server, e.g. the address at which
# BESSER WME  would be accessible after deployment.
DEPLOYMENT_URL=https://my.server/apollon/

# The duration for which shared diagrams will be stored
# (they will be removed afterwards)
APOLLON_REDIS_DIAGRAM_TTL=30d
```

#### STEP 3: Run using Docker Compose

```bash
docker compose up -d
```

BESSER WME  will be running on `localhost:8080`, using a private network bridge to connect to Redis, and storing shared images on a specific Docker volume.

## Developer Setup

```
# installs dependencies
npm install

# build application
npm run build:local

# create diagrams folder
mkdir diagrams

# start webpack dev server
npm start

# accessible via localhost:8888 (webpack dev server with proxy to application server)
# accesible via localhost:8080 (application server with static files)
```

### Update dependencies

```
npm install -g npm-check-updates
npm run update
```

### Link local project of BESSER WME

While developing the  project, it is often required to make changes in the BESSER WME project.
This can be achieved by executing the following workflow.

1.  In the _BESSER WME_ project: Generate a symlink by executing `npm link` command.
2.  In the __ project: Link the generated symlink of BESSER WME _(from step 1)_ by executing `npm link "@yourusername/besser-wme"` command.

For more information please refer to the [documentation](https://docs.npmjs.com/cli/v9/commands/npm-link) of npm.

> **_Note_**: While making changes in the _BESSER WME_ project, for the changes to get reflected in __, execute the following workflow:
>
> - Recompile the BESSER WME project by executing `npm run prepare`
> - Rebuild the  project by executing `npm run build`

### Using Redis in Development

To use Redis in development, you can use the following commands:

```bash
docker run -p 6379:6379 -it redis/redis-stack-server:latest
```

This runs the Redis stack, which also includes the Redis JSON module. You can now instruct
BESSER WME  to use Redis by setting the `APOLLON_REDIS_URL` environment variable.

```bash
APOLLON_REDIS_URL="" npm start
```

## License

This project is licensed under the [MIT](https://mit-license.org/) license

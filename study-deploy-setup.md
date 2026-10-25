# Study Deploy — Setup

## One-time: open port 5000 in AWS

In the EC2 security group attached to the server, add an inbound rule: **Custom TCP, port 5000, source 0.0.0.0/0**.

---

## Every time you deploy

### 1. Build and push the backend image (from the `BESSER` repo)

```bash
docker build -t artefacts.list.lu/besser/web_modeling_editor/backend:studydeployment .
docker push artefacts.list.lu/besser/web_modeling_editor/backend:studydeployment
```

### 2. Build and push the frontend image (from the `BESSER-Web-Modeling-Editor-new` repo)

```bash
docker build \
  --build-arg ENABLE_STUDY_DEPLOY=true \
  --build-arg DEPLOYMENT_URL=https://editor.besser-pearl.org \
  --build-arg BACKEND_URL=https://editor.besser-pearl.org/besser_api \
  -t artefacts.list.lu/besser/web_modeling_editor/frontend:studydeployment \
  .
docker push artefacts.list.lu/besser/web_modeling_editor/frontend:studydeployment
```

### 3. On the AWS server

```bash
docker-compose pull
docker-compose up -d
```

---

## One-time after the very first deploy: install BAF

```bash
docker exec -it $(docker-compose ps -q backend) \
  pip install --target /baf_packages "besser-agentic-framework[all]"
```

This installs into a persistent Docker volume. It survives container restarts and image updates — you never need to run it again unless you explicitly delete the volume (`docker-compose down -v`).

---

## Set environment variables on the server

The `docker-compose.yml` needs these set for the backend. Either edit the file directly or put them in a `.env` file next to it:

```dotenv
DEPLOYMENT_URL=https://editor.besser-pearl.org
OPENAI_API_KEY=sk-...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
STUDY_DEPLOY_TOKEN=<a-long-random-secret-shared-by-the-two-containers>
STUDY_FRONTEND_PUBLIC_URL=https://museum.study.besser-pearl.org
STUDY_SITE_HOST=museum.study.besser-pearl.org
```

The study deployment generates the website using BESSER's React generator, then
builds it in the existing frontend container. No separate website container or
Docker build is started for each participant. The frontend serves Base at
`/study-site/base/` and personalized versions at `/study-site/<profile>/`.
`STUDY_FRONTEND_PUBLIC_URL` must be the public origin of that frontend (without
a trailing path). Use a hostname distinct from the editor hostname for the
generated website, pointing to the same frontend service. Set `STUDY_SITE_HOST`
to that hostname; the frontend serves `/study-site/` only on that host. This
keeps participant generated pages separate from the editor's browser storage.
Configure DNS, HTTPS, and the reverse proxy to forward that hostname to the
frontend container while preserving its `Host` header.
Generated static files live in the `study_site` volume and
survive container restarts; a successful new deployment replaces them.

The frontend container needs outbound npm registry access for the first website
build of each generated dependency set. Installed dependencies are cached in
the `study_site` volume and reused for later participants. The API reports
install or build failures without replacing the previous website.

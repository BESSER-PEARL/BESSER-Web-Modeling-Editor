# Image → EC2 Deployment

Deploying containerised images on a fresh Amazon Linux 2023 instance.

---

## One-time setup

### 1. Launch EC2 instance
- AMI: Amazon Linux 2023
- Download the `.pem` key pair
- Security Group inbound rules: `22` (SSH), `80` (frontend), `9000` (backend)

### 2. Add your SSH public key
Connect via **EC2 Instance Connect** (AWS Console → instance → Connect), then:
```bash
echo "ssh-rsa AAAA... your-key" >> ~/.ssh/authorized_keys
```
> No trailing characters — a stray period or space silently breaks auth.

### 3. Fix `.pem` permissions on Windows
Run once in PowerShell before using the key with `ssh`/`scp`:
```powershell
icacls C:\path\to\key.pem /inheritance:r /grant:r "${env:USERNAME}:R"
```

### 4. Install Docker
```bash
sudo yum install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

### 5. Install Docker Compose plugin
Not available via `yum` on AL2023 — install the binary directly:
```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version  # verify
```

---

## Deploy

### 6. Create `docker-compose.yml`
Copy from your machine or create directly on the instance:
```yaml
services:
  backend:
    image: registry.example.com/backend:tag
    restart: unless-stopped
    ports:
      - "9000:9000"
    networks: [app]

  frontend:
    image: registry.example.com/frontend:tag
    restart: unless-stopped
    ports:
      - "80:8080"
    networks: [app]
    depends_on: [backend]

networks:
  app:
    driver: bridge
```

### 7. Log in to the registry
Generate an identity token in JFrog (Profile → Authentication Tokens), then:
```bash
echo "<token>" | sudo docker login registry.example.com \
  -u your@email.com --password-stdin
```

### 8. Start the stack
```bash
sudo docker compose up -d
sudo docker compose ps            # both containers should show "Up"
sudo docker compose logs --tail=20
```

Frontend: `http://<ec2-public-ip>` · Backend: `http://<ec2-public-ip>:9000`

---

## Redeploy (new image)

```bash
sudo docker compose pull
sudo docker compose up -d
```

Compose only restarts containers whose image changed — a few seconds of downtime per service.

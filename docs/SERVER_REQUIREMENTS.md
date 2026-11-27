# OnlineDars — server requirements

One server per environment (production, staging). Lesson video is served by an external video
host (Bunny Stream or Cloudflare Stream), not by this server.

## Server

|           | Start (up to ~2,000 active students)                   | Growth (2,000–10,000 active students) |
| --------- | ------------------------------------------------------ | ------------------------------------- |
| CPU       | 4 vCPU                                                 | 8 vCPU                                |
| RAM       | 8 GB                                                   | 16 GB                                 |
| Disk      | 80–160 GB NVMe SSD                                     | 160–320 GB NVMe SSD                   |
| Network   | 100 Mbps+ (1 Gbps port preferred), ~1 TB/month traffic | 1 Gbps, ~2–3 TB/month traffic         |
| Public IP | 1 static IPv4                                          | 1 static IPv4                         |

Over 10,000 active students: move PostgreSQL to its own server or a managed database.

Staging can be smaller: 2 vCPU, 4 GB RAM, 40–80 GB SSD.

## Software

- Ubuntu Server 24.04 LTS (64-bit), root or sudo SSH access
- Docker Engine + Docker Compose plugin (we install them)
- Open ports: 22 (SSH, our IPs only), 80 and 443 (HTTP/HTTPS)

## Hosting conditions

- **Data center in Uzbekistan** (personal data of students is stored here)
- Daily snapshots or backups, kept at least 7 days, plus space for our own database backups
- Connected to TAS-IX (local Uzbek traffic exchange) if available
- Domain `onlinedars.uz` DNS can point to the server

## What runs on it (for reference)

| Service                                 | RAM        |
| --------------------------------------- | ---------- |
| PostgreSQL (database)                   | 2–4 GB     |
| Web (Next.js)                           | 0.3–0.5 GB |
| API (NestJS)                            | 0.2–0.4 GB |
| Worker (certificate PDFs)               | 0.5–1 GB   |
| Redis, MinIO (files), Caddy (HTTPS), OS | ~1.5 GB    |

## Storage growth

- Database: ~1–3 MB per student
- Certificates: ~0.3 MB per PDF
- Backups: keep free space of about 2× the database size

These are estimates. Load-test before launch and adjust (see `docs/DEPLOYMENT.md`).

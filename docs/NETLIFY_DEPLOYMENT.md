# Netlify Deployment Guide with Netlify DB

This guide explains how to deploy PHAROS (paros-bmad) to Netlify using Netlify DB (Neon PostgreSQL).

## Overview

PHAROS uses:
- **Next.js 15** with Pages Router
- **Prisma ORM** with PostgreSQL
- **Netlify DB** (powered by Neon) for serverless database
- **tRPC** for type-safe API

## Prerequisites

1. **Netlify Account** - Sign up at https://app.netlify.com
2. **Node.js 20.12.2 or later** - Check with `node --version`
3. **Git Repository** - Project should be in Git (GitHub, GitLab, or Bitbucket)
4. **Neon Account** - For claiming database (optional but recommended)

## Quick Start

### 1. Install Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. Initialize Netlify DB

Run this command in your project root:

```bash
npx netlify db init
```

This will:
- Install the latest Netlify CLI
- Create a Neon database instance
- Set up required environment variables automatically
- Add database to your Netlify project

### 3. Link Your Repository

```bash
# Login to Netlify
netlify login

# Initialize your site
netlify init

# Follow the prompts to:
# - Create a new site or link to existing one
# - Select your Git provider
# - Choose the repository
# - Configure build settings (use defaults from netlify.toml)
```

### 4. Deploy to Netlify

```bash
# Deploy to production
npm run netlify:deploy

# Or deploy to preview URL
netlify deploy
```

## Environment Variables

### Automatic Variables (Set by @netlify/neon)

When you install `@netlify/neon`, these variables are automatically created:

- `DATABASE_URL` - Primary database connection string
- `NETLIFY_DB_PGHOST` - Database host
- `NETLIFY_DB_PGDATABASE` - Database name
- `NETLIFY_DB_PGUSER` - Database user
- `NETLIFY_DB_PGPASSWORD` - Database password
- `NEON_DATABASE_URL` - Alternative connection string

### Manual Variables Required

Set these in Netlify dashboard (Site Settings > Environment Variables):

```bash
# Application
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
NODE_ENV=production

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-generated-jwt-secret

# AI Provider (choose one)
AI_PROVIDER=upstage
UPSTAGE_API_KEY=your-upstage-api-key
```

### Optional: S3 Configuration

For file upload functionality, configure AWS S3:

```bash
# S3 Configuration
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

## Database Migrations

### Initial Setup

After Netlify DB is initialized, run migrations:

```bash
# Generate Prisma Client
npm run postinstall

# Push schema to Netlify DB
npm run db:push

# Seed database (optional)
npm run db:seed
```

### Production Migrations

Netlify automatically runs Prisma migrations during build if configured in `netlify.toml`:

```toml
[build]
  command = "npm run db:migrate && npm run build"
```

## Local Development with Netlify DB

### Option 1: Use Netlify Dev

```bash
# Start local development with Netlify DB
npm run netlify
```

This will:
- Start Netlify Dev server on port 3000
- Automatically provision a local database
- Set all required environment variables

### Option 2: Use Local Database

Keep using your existing local PostgreSQL:

```bash
# Standard Next.js dev server
npm run dev
```

## Claim Your Database

**Important:** Unclaimed databases expire after 7 days.

### Steps to Claim:

1. Go to **Netlify Dashboard** → Your Site → **Extensions**
2. Select **Neon database**
3. Click **Connect Neon** and authorize your Neon account
4. Click **Claim database**

Benefits of claiming:
- Database runs beyond 7-day trial
- Full production capacity unlocked
- Monitor your database in Neon console
- Upgrade to additional Neon features

## Build Configuration

The `netlify.toml` file contains all build settings:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20.12.2"
  NPM_VERSION = "10.8.2"
```

## Troubleshooting

### Database Connection Error

**Problem:** `Error: Cannot connect to database`

**Solutions:**
1. Check `DATABASE_URL` is set in Netlify environment variables
2. Verify database is claimed (not expired)
3. Check Prisma schema matches database structure

### Migration Failures

**Problem:** Migrations fail during build

**Solutions:**
1. Run `npm run db:push` locally first
2. Check Prisma client is generated: `npm run postinstall`
3. Verify `@netlify/neon` is installed

### Environment Variables Not Loading

**Problem:** Config not reading env variables

**Solutions:**
1. Check variables are set in Netlify dashboard
2. Redeploy after adding variables
3. Use `npm run netlify` to test locally

## Deployment Workflow

### Initial Deployment

```bash
# 1. Install Netlify DB package (already done)
npm install @netlify/neon

# 2. Initialize Netlify DB
npx netlify db init

# 3. Push schema to database
npm run db:push

# 4. Deploy to Netlify
npm run netlify:deploy
```

### Subsequent Deployments

```bash
# Just push to Git - Netlify auto-deploys
git push origin main

# Or manual deploy
npm run netlify:deploy
```

### With Database Changes

```bash
# 1. Update Prisma schema
# 2. Create migration
npm run db:generate

# 3. Test locally
npm run db:push

# 4. Deploy (migrations run automatically)
git push origin main
```

## Monitoring

### Netlify Dashboard

Monitor your deployment at:
- **Deploy log:** https://app.netlify.com/sites/your-site/deploys
- **Functions log:** https://app.netlify.com/sites/your-site/functions

### Neon Console

Monitor your database at:
- **Neon Console:** https://console.neon.tech/
- View connection stats, query performance, and database size

## Advanced Configuration

### Custom Domain

1. Go to **Site Settings** → **Domain Management**
2. Add custom domain
3. Update `NEXT_PUBLIC_APP_URL` in Netlify environment variables

### Branch Deployments

Enable preview deployments for different branches:

```toml
[context.production]
  command = "npm run db:migrate && npm run build"

[context.deploy-preview]
  command = "npm run build"
```

### Environment-Specific Variables

```bash
# Production
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app

# Preview Deployments
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://branch-name--your-site.netlify.app
```

## Cost and Limits

### Netlify DB Pricing

- **Free Tier:** 7-day trial (must claim database)
- **Hobbyist:** Starts at $29/month (via Neon)
- **Production:** Scales based on usage

See https://neon.tech/pricing for details.

### Netlify Pricing

- **Free:** 100GB bandwidth/month, 300 build minutes/month
- **Pro:** $19/month for enhanced features
- **Team:** Custom pricing

See https://www.netlify.com/pricing for details.

## Additional Resources

- **Netlify DB Docs:** https://docs.netlify.com/build/data-and-storage/netlify-db/
- **Neon Docs:** https://neon.tech/docs
- **Prisma Netlify Guide:** https://www.prisma.io/docs/guides/deployment/netlify
- **Next.js Netlify Deploy:** https://docs.netlify.com/integrations/frameworks/next-js/

## Support

For issues or questions:
1. Check Netlify Build logs
2. Review Neon Console for database issues
3. Check Prisma schema matches database
4. Verify all environment variables are set

---

**Last Updated:** 2026-01-15
**Maintained by:** PHAROS Development Team

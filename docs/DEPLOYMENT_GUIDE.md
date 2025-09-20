# PsyHelp Deployment Guide

## Prerequisites

Before deploying PsyHelp, ensure you have the following:

- Node.js 18+ installed
- PostgreSQL database (Neon recommended)
- Redis instance
- Google OAuth credentials
- Hugging Face API key
- Domain name and SSL certificate

## Environment Setup

### 1. Database Setup (Neon)

1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Run the database migrations:

```bash
cd backend
npm run migrate
```

### 2. Redis Setup

1. Create a Redis instance (Redis Cloud recommended)
2. Copy the connection URL
3. Test the connection:

```bash
redis-cli -u your_redis_url ping
```

### 3. Environment Variables

Create a `.env` file in the backend directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/psyhelp?sslmode=require
NEON_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/psyhelp?sslmode=require

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Admin Default Credentials
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=a1

# AI/ML Services
HUGGINGFACE_API_KEY=your_huggingface_api_key
OPENAI_API_KEY=your_openai_api_key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# File Upload (AWS S3)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_BUCKET_NAME=psyhelp-uploads
AWS_REGION=us-east-1

# Application Configuration
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Crisis Hotline Numbers
CRISIS_HOTLINE_INDIA=+91-9999-666-555
CRISIS_HOTLINE_US=988
CRISIS_HOTLINE_UK=116-123

# Feature Flags
ENABLE_AI_CHATBOT=true
ENABLE_PEER_FORUMS=true
ENABLE_ANALYTICS=true
ENABLE_CRISIS_ALERTS=true

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

## Backend Deployment

### Option 1: Railway Deployment

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize Railway project:
```bash
cd backend
railway init
```

4. Set environment variables:
```bash
railway variables set DATABASE_URL=your_database_url
railway variables set JWT_SECRET=your_jwt_secret
# ... set all other variables
```

5. Deploy:
```bash
railway up
```

### Option 2: Heroku Deployment

1. Install Heroku CLI
2. Create Heroku app:
```bash
cd backend
heroku create psyhelp-api
```

3. Set environment variables:
```bash
heroku config:set DATABASE_URL=your_database_url
heroku config:set JWT_SECRET=your_jwt_secret
# ... set all other variables
```

4. Deploy:
```bash
git push heroku main
```

### Option 3: Docker Deployment

1. Create Dockerfile in backend directory:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
```

2. Build and run:
```bash
docker build -t psyhelp-backend .
docker run -p 5000:5000 --env-file .env psyhelp-backend
```

## Frontend Deployment

### Option 1: Vercel Deployment

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create vercel.json:
```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "env": {
    "REACT_APP_BACKEND_URL": "@backend-url"
  }
}
```

3. Deploy:
```bash
cd frontend
vercel --prod
```

### Option 2: Netlify Deployment

1. Create netlify.toml:
```toml
[build]
  command = "npm run build"
  publish = "build"

[build.environment]
  REACT_APP_BACKEND_URL = "https://api.yourdomain.com"
```

2. Connect your repository to Netlify
3. Deploy automatically on git push

### Option 3: AWS S3 + CloudFront

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Upload to S3:
```bash
aws s3 sync build/ s3://your-bucket-name --delete
```

3. Configure CloudFront distribution
4. Set up custom domain and SSL

## Database Migration

### Running Migrations

1. Connect to your database
2. Run the schema:
```bash
cd backend
psql $DATABASE_URL -f database/schema.sql
```

### Seeding Initial Data

1. Run the seed script:
```bash
npm run seed
```

## SSL Certificate Setup

### Let's Encrypt (Recommended)

1. Install Certbot:
```bash
sudo apt-get install certbot
```

2. Obtain certificate:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. Auto-renewal:
```bash
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### CloudFlare SSL

1. Add your domain to CloudFlare
2. Enable SSL/TLS encryption mode: "Full (strict)"
3. Configure DNS records

## Monitoring Setup

### Sentry Error Tracking

1. Create Sentry project
2. Install Sentry SDK:
```bash
npm install @sentry/node
```

3. Configure in server.ts:
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Logging Setup

1. Configure Winston logging
2. Set up log aggregation (ELK stack or similar)
3. Configure log rotation

## Health Checks

### Backend Health Check

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Database Health Check

```bash
curl https://api.yourdomain.com/health/database
```

### Redis Health Check

```bash
curl https://api.yourdomain.com/health/redis
```

## Performance Optimization

### Database Optimization

1. Enable connection pooling:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

2. Add database indexes:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
```

### Caching Setup

1. Configure Redis caching:
```javascript
const redis = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
});
```

2. Implement API response caching
3. Set up CDN for static assets

## Security Hardening

### Environment Security

1. Use strong JWT secrets
2. Enable HTTPS everywhere
3. Set up CORS properly
4. Implement rate limiting

### Database Security

1. Use connection pooling
2. Enable SSL connections
3. Regular security updates
4. Backup encryption

### Application Security

1. Input validation
2. SQL injection prevention
3. XSS protection
4. CSRF protection

## Backup Strategy

### Database Backups

1. Automated daily backups
2. Point-in-time recovery
3. Cross-region replication
4. Backup testing

### Application Backups

1. Code repository backups
2. Configuration backups
3. Environment variable backups
4. Documentation backups

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
curl https://api.yourdomain.com/health/database
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis health
curl https://api.yourdomain.com/health/redis
```

#### Frontend Build Issues
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Log Analysis

1. Check application logs:
```bash
# Railway
railway logs

# Heroku
heroku logs --tail

# Docker
docker logs container_name
```

2. Monitor error rates
3. Check performance metrics
4. Analyze user behavior

## Scaling Considerations

### Horizontal Scaling

1. Load balancer setup
2. Multiple application instances
3. Database read replicas
4. Redis clustering

### Vertical Scaling

1. Increase server resources
2. Optimize database queries
3. Implement caching strategies
4. Monitor resource usage

## Maintenance

### Regular Tasks

1. **Daily**: Monitor system health
2. **Weekly**: Review error logs
3. **Monthly**: Update dependencies
4. **Quarterly**: Security audits

### Updates

1. **Dependencies**: Regular updates
2. **Security**: Immediate security patches
3. **Features**: Planned feature releases
4. **Database**: Schema migrations

## Support

### Documentation

- Technical Specification: `docs/TECHNICAL_SPECIFICATION.md`
- API Documentation: `docs/API_DOCUMENTATION.md`
- User Guide: `docs/USER_GUIDE.md`

### Contact

- Technical Support: tech-support@psyhelp.com
- Emergency Support: emergency@psyhelp.com
- General Inquiries: info@psyhelp.com

This deployment guide provides comprehensive instructions for deploying PsyHelp in production environments. Follow the steps carefully and ensure all security measures are in place before going live.

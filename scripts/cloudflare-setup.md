# Cloudflare Configuration Guide

> Manual setup guide for Cloudflare DNS and SSL/TLS

## Prerequisites
- Cloudflare account with `postiusgroup.com` domain
- Railway deployment URL (e.g., `github-dashboard-prod.up.railway.app`)
- Admin access to Cloudflare dashboard

---

## Step 1: Access Cloudflare Dashboard

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Log in with your credentials
3. Select **postiusgroup.com** domain
4. Navigate to **DNS** section

---

## Step 2: Add CNAME Record

### Purpose
Maps `dashboard.postiusgroup.com` to your Railway deployment URL

### Configuration

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name** | `dashboard` |
| **Target** | `<your-railway-url>` |
| **TTL** | Auto |
| **Proxy Status** | Proxied (Orange Cloud) ✅ |

### Example
```
Type:    CNAME
Name:    dashboard
Target:  github-dashboard-prod.up.railway.app
TTL:     Auto
Proxy:   Proxied ☁️
```

### Steps
1. In DNS section, click **+ Add Record**
2. Select **Type**: CNAME
3. Enter **Name**: `dashboard`
4. Enter **Target**: Your Railway deployment URL
5. Set **TTL** to Auto
6. Toggle **Proxy Status** to **Proxied** (Orange Cloud icon)
7. Click **Save**

---

## Step 3: SSL/TLS Settings

### Purpose
Ensures encrypted HTTPS connections

### Configuration Steps

1. Click **SSL/TLS** in left sidebar
2. Set **Encryption mode** to:
   - **Full** (Recommended) - Encrypts traffic between client and Cloudflare, and Cloudflare to origin
   - Or **Flexible** if Railway doesn't support HTTPS (less secure)

### HTTPS Redirect

1. Go to **Rules** → **Page Rules**
2. Create new rule:
   ```
   URL: http://dashboard.postiusgroup.com/*
   Redirect to: https://dashboard.postiusgroup.com/$1
   Code: 301 (Permanent Redirect)
   ```

### Always Use HTTPS

1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable **Always Use HTTPS**

---

## Step 4: Verify Configuration

### Test DNS Resolution
```bash
# Check CNAME record
dig dashboard.postiusgroup.com CNAME

# Should return:
# dashboard.postiusgroup.com. CNAME github-dashboard-prod.up.railway.app.
```

### Test HTTPS
```bash
# Check SSL certificate
curl -I https://dashboard.postiusgroup.com

# Should return 200 OK with SSL cert
```

### Test HTTP Redirect
```bash
# Check redirect
curl -I http://dashboard.postiusgroup.com

# Should return 301 redirect to https://
```

---

## Step 5: Security Hardening

### Additional Cloudflare Settings

#### DDoS Protection
- Go to **Security** → **DDoS**
- Ensure sensitivity is set appropriately

#### WAF (Web Application Firewall)
- Go to **Security** → **WAF**
- Enable **Cloudflare Managed Ruleset**

#### Bots
- Go to **Security** → **Bots**
- Enable **Cloudflare Bot Management** (if available)

---

## Step 6: Monitoring & Verification

### Cloudflare Analytics

1. Go to **Analytics** dashboard
2. Monitor:
   - **Requests** - Total traffic
   - **Threats** - Blocked requests
   - **Performance** - Cache hit ratio
   - **SSL/TLS** - Certificate status

### Health Checks

Create a health check in Cloudflare:

1. Go to **Reliability** → **Health Checks**
2. Click **+ Create**
3. Configure:
   ```
   Name: GitHub Dashboard Health
   Protocol: HTTPS
   Address: dashboard.postiusgroup.com
   Path: /api/health
   Interval: 60 seconds
   Timeout: 30 seconds
   Follow Redirects: Yes
   Retries: 2
   ```

---

## Troubleshooting

### 502 Bad Gateway Error

**Cause**: Application not responding properly

**Solution**:
1. Check Railway deployment status
2. Verify Railway URL is correct in CNAME
3. Ensure application is running
4. Check application logs in Railway

### DNS Not Resolving

**Cause**: DNS propagation or incorrect record

**Solution**:
1. Verify CNAME record in Cloudflare
2. Wait up to 24 hours for propagation
3. Clear local DNS cache:
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   
   # Linux
   sudo systemctl restart systemd-resolved
   ```

### SSL Certificate Errors

**Cause**: SSL certificate not valid

**Solution**:
1. Force refresh Cloudflare cache
   - Go to **Caching** → **Cache Purge**
   - Click **Purge Everything**
2. Set SSL mode to "Full"
3. Wait 5-10 minutes for certificate to propagate

### Slow Response Times

**Cause**: Poor Cloudflare caching or application performance

**Solution**:
1. Check cache hit ratio in Analytics
2. Increase TTL for static assets
3. Optimize application response time
4. Scale Railway instance if needed

---

## Cache Purge

If you need to clear cache after deployment:

1. Go to **Caching** → **Cache Purge**
2. Click **Purge Everything** (or specify URLs)
3. Wait a few moments for cache to clear

---

## Useful Cloudflare Tools

### Check DNS Status
- Use **DNS Lookup** tool in Cloudflare dashboard
- Or run: `dig dashboard.postiusgroup.com`

### Test SSL
- Use online SSL checker: https://www.sslshopper.com/ssl-checker.html
- Or run: `openssl s_client -connect dashboard.postiusgroup.com:443`

### Monitor Performance
- Cloudflare Analytics dashboard
- Railway metrics dashboard
- Browser DevTools Network tab

---

## Final Verification Checklist

- [ ] CNAME record points to Railway URL
- [ ] Proxy status is **Proxied** (orange cloud)
- [ ] SSL/TLS mode set to **Full**
- [ ] HTTPS redirect configured
- [ ] Always Use HTTPS enabled
- [ ] DNS resolves correctly
- [ ] HTTPS certificate valid
- [ ] HTTP redirects to HTTPS
- [ ] Application responds (no 502 errors)
- [ ] Analytics showing traffic

---

## Reference

- **Cloudflare Docs**: https://developers.cloudflare.com/
- **DNS Configuration**: https://developers.cloudflare.com/dns/
- **SSL/TLS**: https://developers.cloudflare.com/ssl/
- **Page Rules**: https://support.cloudflare.com/hc/en-us/articles/218411427

---

**Last Updated**: 2026-07-14  
**Domain**: dashboard.postiusgroup.com  
**Status**: Ready for Configuration

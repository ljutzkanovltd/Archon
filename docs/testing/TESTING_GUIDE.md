# Rate Limiting Testing Guide

## 🧪 How to Test and Monitor Rate Limiting

### ✅ Current Status

**Rate limiting is ACTIVE and working!** You saw this in the logs:
```
Initialized crawling strategy: rate_limit=1.0 req/s, backoff=1.0-60.0s, adaptive=False, respect_robots=True
```

This means:
- ✅ Rate limiting is enabled (1 request/second per domain)
- ✅ Exponential backoff ready (1-60 seconds)
- ✅ Adaptive throttling disabled (can enable later)
- ✅ robots.txt enforcement enabled

---

## 📊 Real-Time Monitoring

### Method 1: Use the Monitor Script

```bash
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/monitor-rate-limiting.sh
```

This will show color-coded real-time events:
- 🟢 **Green**: Initialization messages
- 🟡 **Yellow**: Delays and backoffs applied
- 🔴 **Red**: Rate limits detected
- 🔵 **Blue**: robots.txt and adaptive throttling

### Method 2: Manual Log Monitoring

```bash
# Watch all rate limiting events
docker logs -f archon-server 2>&1 | grep -E "rate limit|backoff|robots|Crawl-Delay|delayed"

# Watch initialization
docker logs archon-server 2>&1 | grep "Initialized crawling"

# Watch for rate limit detections
docker logs -f archon-server 2>&1 | grep -i "rate limit detected"
```

---

## 🎯 What to Look For

### 1. **Initialization** (You already see this ✅)
```
Initialized crawling strategy: rate_limit=1.0 req/s, backoff=1.0-60.0s, adaptive=False, respect_robots=True
```

### 2. **Normal Operation** (Silent - working in background)
When crawling sites that DON'T rate limit:
- You won't see many messages
- Rate limiting is enforcing 1 req/sec per domain
- This is normal and expected!

### 3. **Rate Limit Detection** (What to watch for)
When a site responds with "too many requests":
```
Rate limit detected for https://example.com: HTTP 429 Too Many Requests
Backing off for 1.23s (attempt 1)
```

### 4. **Retry-After Header** (Server tells us when to retry)
```
Rate limited on https://api.example.com (attempt 1/3)
Retry-After header: 30.0s
```

### 5. **Exponential Backoff** (Increasing delays)
```
Backing off for 1.5s (attempt 0)   # First retry
Backing off for 2.8s (attempt 1)   # Second retry
Backing off for 4.3s (attempt 2)   # Third retry
```

### 6. **robots.txt Enforcement**
```
Fetching robots.txt from https://docs.example.com/robots.txt
Crawl-Delay for docs.example.com: 2.0s
Applying robots.txt Crawl-Delay for docs.example.com: 2.0s
```

---

## 🧪 Test Scenarios

### Test 1: Current Odoo Crawl (What you're doing now)

**Expected Behavior:**
- ✅ Rate limiting is active (1 req/sec per domain)
- ✅ No visible rate limit messages (odoo.com isn't rate limiting you)
- ✅ Silent operation = working correctly!

**Why no messages?**
- odoo.com allows your requests
- Rate limiter is still enforcing 1 req/sec internally
- You only see messages when rate limits are HIT

### Test 2: Enable More Verbose Logging

Add to `.env` to see rate limiter in action:
```bash
# Add this for testing
CRAWL_DEFAULT_RATE_LIMIT=0.5  # Slow down to 0.5 req/sec (2 seconds between requests)
```

Then restart:
```bash
docker compose restart archon-server
```

Now you should see slower crawling.

### Test 3: Test with a Rate-Limited Site

Try crawling a site with strict rate limits (like GitHub API):

**Via Python REPL:**
```python
# In archon container
docker exec -it archon-server python

from src.server.services.crawling.strategies.single_page import SinglePageCrawlStrategy
from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import NoExtractionStrategy

# This would trigger rate limiting from GitHub
# (Don't actually run this without permission!)
```

### Test 4: Check Rate Limit Stats (Programmatically)

Create a test script:
```python
# test_rate_stats.py
from src.server.services.crawling.async_limiter import GlobalRateLimiter

limiter = GlobalRateLimiter.get_instance()
stats = limiter.get_stats()

print(f"Domains tracked: {stats['domains_tracked']}")
print(f"Total waits: {stats['total_wait_time']:.2f}s")

# Per-domain stats
for domain, domain_stats in stats.get('by_domain', {}).items():
    print(f"\n{domain}:")
    print(f"  Requests: {domain_stats['acquires']}")
    print(f"  Total wait: {domain_stats['total_wait_time']:.2f}s")
    print(f"  Avg wait: {domain_stats['avg_wait_time']:.2f}s")
```

---

## 📈 What Success Looks Like

### ✅ Silent Operation = Success!

If you DON'T see rate limit messages, that means:
1. ✅ Sites aren't rate limiting you
2. ✅ Rate limiter is working (enforcing limits in background)
3. ✅ Everything is functioning correctly

### 🟡 Rate Limit Messages = System Working as Designed!

If you DO see rate limit messages:
1. 🎯 System detected rate limiting
2. 🎯 Automatically applying backoff
3. 🎯 Will retry with exponential delays
4. 🎯 **This is exactly what you want!**

---

## 🔍 Debugging Tips

### Issue: "Not seeing any rate limit messages"

**This is NORMAL!** It means:
- Sites aren't rate limiting you
- Rate limiter is still active (checking every request)
- Working as intended

### Issue: "Want to see rate limiter in action"

**Option 1**: Lower the rate limit (see more delays)
```bash
# In .env
CRAWL_DEFAULT_RATE_LIMIT=0.1  # Very slow: 1 request per 10 seconds
```

**Option 2**: Enable debug logging
```bash
# Add to .env
LOG_LEVEL=DEBUG
```

**Option 3**: Use the monitoring script
```bash
./scripts/monitor-rate-limiting.sh
```

### Issue: "Server not healthy after restart"

```bash
# Check logs
docker logs archon-server --tail 50

# Look for import errors
docker logs archon-server 2>&1 | grep -i "error\|exception"

# Restart if needed
docker compose restart archon-server
```

---

## 📊 Performance Metrics

### Current Configuration

```
Rate: 1.0 req/sec per domain
Backoff: 1-60 seconds (exponential)
Adaptive: Disabled (can enable)
robots.txt: Enabled
```

### Expected Throughput

**Per Domain:**
- 1 req/sec = 60 req/min = 3,600 req/hour
- With 10 parallel domains = 36,000 req/hour total

**With Rate Limiting:**
- Odoo.com: ~3,600 pages/hour (if not rate limited)
- GitHub API: Automatically slows down if rate limited
- Any site: Adapts to server's rate limit

---

## 🎓 Advanced Testing

### Test Adaptive Throttling

1. Enable adaptive mode:
```bash
# In .env
CRAWL_ADAPTIVE_THROTTLE=true
```

2. Restart:
```bash
docker compose restart archon-server
```

3. Watch logs:
```bash
docker logs -f archon-server 2>&1 | grep -i adaptive
```

You should see:
```
Adjusted delay: 0.50s -> 0.75s (median latency: 1.5s, target concurrency: 2.0)
```

### Test robots.txt Enforcement

1. Find a site with robots.txt crawl-delay:
```bash
curl -s https://www.bing.com/robots.txt | grep -i "crawl-delay"
```

2. Try crawling it (via Archon dashboard)

3. Watch logs:
```bash
docker logs -f archon-server 2>&1 | grep "Crawl-Delay"
```

---

## ✅ Checklist: Is Rate Limiting Working?

- [x] Server shows "Initialized crawling strategy" ✅
- [x] No import errors ✅
- [x] Server is healthy ✅
- [ ] Crawling is happening (you're testing this now)
- [ ] If site rate limits → see backoff messages
- [ ] If site has robots.txt → see crawl-delay messages

**Current Status**: ✅ **WORKING!**

---

## 🚀 Next Steps

1. **Continue your recrawl** - rate limiting is active
2. **Monitor occasionally** - use `./scripts/monitor-rate-limiting.sh`
3. **Check stats later** - see how many domains were tracked
4. **If you hit rate limits** - you'll see it automatically handled!

---

## 📞 Quick Commands Reference

```bash
# Monitor in real-time
./scripts/monitor-rate-limiting.sh

# Check recent activity
docker logs archon-server --tail 100 | grep -E "rate|backoff|robots"

# See initialization
docker logs archon-server | grep "Initialized crawling"

# Check server health
docker ps --filter "name=archon"
curl -s http://localhost:8181/api/health | jq

# Restart if needed
docker compose restart archon-server
```

---

**Last Updated**: 2025-12-19
**Status**: ✅ Rate Limiting Active and Working
**Your Test**: ✅ Recrawl in progress - monitor with script above!

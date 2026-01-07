# Debug Stack Command - Badmintoo Training Lab

This command provides comprehensive debugging and validation for the Badmintoo Training Lab tech stack after major updates. It systematically checks all components, identifies issues, and provides actionable solutions.

## Usage

```bash
/debug-stack [--flags]
```

## Available Flags

### Scope Flags
- `--quick`: Essential 5-minute health check (default)
- `--full`: Comprehensive 15-20 minute diagnosis
- `--critical`: Only critical system components

### Component Flags
- `--services`: Focus on service connectivity (Redis, FastAPI, Supabase, Celery)
- `--api`: Test all API endpoints systematically  
- `--db`: Database schema, migrations, RLS policies validation
- `--auth`: Authentication flow and role-based access testing
- `--phase2`: Phase 2 SaaS features (products, queue, uploads, websockets)
- `--frontend`: React app, admin panel, commercial website
- `--logs`: Analyze recent error logs across all services
- `--perf`: Performance metrics and resource monitoring
- `--env`: Environment configuration validation

### Action Flags
- `--fix`: Attempt automatic fixes for common issues
- `--report`: Generate detailed diagnostic markdown report
- `--monitor`: Start real-time monitoring after diagnostics

## Command Execution Flow

### Phase 1: Environment Validation (Always Run)
1. **Project Structure Check**
   - Verify in correct directory (`/home/ljutzkanov/badmintoo-training-lab`)
   - Check for essential files (package.json, .env, requirements.txt)
   - Validate directory structure integrity

2. **Environment Files Validation** 
   - Check root `.env` file exists and has required variables
   - Verify `backend/.env` configuration
   - Validate `.env.local` overrides if present
   - Test environment variable loading

3. **Dependency Status**
   - Python virtual environment status
   - Node.js dependencies installation
   - Backend Python packages
   - Git repository status

### Phase 2: Service Connectivity (--services or --full)
1. **Redis Service**
   ```bash
   # Test Redis connectivity
   redis-cli ping
   # Check Redis memory usage
   redis-cli INFO memory
   # Test read/write operations
   redis-cli SET test_key "debug_test" && redis-cli GET test_key && redis-cli DEL test_key
   ```

2. **FastAPI Backend**
   ```bash
   # Check if backend is running
   curl -sf "http://localhost:8000/api/v1/system/info"
   # Detailed health check
   curl -sf "http://localhost:8000/api/v1/system/health-detailed"
   # Test authentication endpoint
   curl -sf "http://localhost:8000/api/v1/auth/me" -H "Authorization: Bearer test"
   ```

3. **Supabase Connectivity**
   ```bash
   # Test database connection through health endpoint
   curl -sf "http://localhost:8000/api/v1/system/health-detailed" | grep -q "supabase.*healthy"
   ```

4. **Celery Workers**
   ```bash
   # Check for running workers
   pgrep -f "celery.*worker" | wc -l
   # Test worker connectivity if backend running
   python -c "from backend.services.celery_app import app; print(app.control.inspect().active())" 2>/dev/null || echo "Celery check failed"
   ```

### Phase 3: API Endpoint Testing (--api or --full)
1. **Core System Endpoints**
   - `/api/v1/system/info` - System information
   - `/api/v1/system/health-detailed` - Comprehensive health
   - `/docs` - API documentation
   - `/openapi.json` - OpenAPI specification

2. **Authentication Endpoints**
   - `/api/v1/auth/login` - Login functionality
   - `/api/v1/auth/logout` - Logout functionality  
   - `/api/v1/auth/me` - Current user info

3. **Phase 2 SaaS Endpoints**
   - `/api/v1/products/public-stats` - Product catalog statistics
   - `/api/v1/queue/public-stats` - Queue management statistics
   - `/api/v1/uploads/health` - Upload service health
   - `/ws/health` - WebSocket service health

4. **Admin Panel Routes**
   - `/admin/login` - Admin login page
   - `/admin/dashboard` - Main dashboard
   - `/admin/users` - User management
   - `/admin/queue` - Queue management
   - `/admin/products` - Product management

### Phase 4: Database Validation (--db or --full)
1. **Migration Status**
   ```bash
   # Check current migration version
   cd backend && python -c "
   import asyncio
   from services.supabase import get_supabase_service
   async def check_migrations():
       supabase = get_supabase_service()
       result = await supabase.table('schema_migrations').select('version').order('version', desc=True).limit(1).execute()
       print(f'Latest migration: {result.data[0][\"version\"] if result.data else \"None\"}')
   asyncio.run(check_migrations())
   "
   ```

2. **Schema Validation**
   ```bash
   # Verify critical tables exist
   cd backend && python -c "
   import asyncio
   from services.supabase import get_supabase_service
   async def check_schema():
       supabase = get_supabase_service()
       tables = ['contacts', 'user_sessions', 'products', 'queue_items', 'organizations']
       for table in tables:
           try:
               result = await supabase.table(table).select('*').limit(1).execute()
               print(f'✅ Table {table}: OK')
           except Exception as e:
               print(f'❌ Table {table}: {str(e)}')
   asyncio.run(check_schema())
   "
   ```

3. **RLS Policy Check**
   ```bash
   # Check Row Level Security policies
   cd backend && python -c "
   import asyncio
   from services.supabase import get_supabase_service
   async def check_rls():
       supabase = get_supabase_service()
       # Test RLS is enabled on critical tables
       print('RLS Policy validation would go here')
   asyncio.run(check_rls())
   "
   ```

### Phase 5: Authentication Flow Testing (--auth or --full)
1. **Supabase Auth Integration**
   ```bash
   # Test JWT validation
   curl -sf "http://localhost:8000/api/v1/auth/validate-token" -H "Content-Type: application/json" -d '{"token":"test"}'
   ```

2. **Role-Based Access Control**
   ```bash
   # Test admin access
   curl -sf "http://localhost:8000/admin/dashboard" | grep -q "Unauthorized\|403\|401" && echo "❌ Admin access blocked" || echo "✅ Admin access OK"
   ```

3. **JWT Token Validation**
   - Test token parsing and validation
   - Verify role extraction from tokens
   - Check token expiration handling

### Phase 6: Phase 2 SaaS Features (--phase2 or --full)
1. **Product Catalog System**
   ```bash
   # Test product statistics
   product_stats=$(curl -s "http://localhost:8000/api/v1/products/public-stats")
   echo "$product_stats" | grep -q '"success":true' && echo "✅ Product catalog: OK" || echo "❌ Product catalog: Failed"
   ```

2. **Queue Management System**
   ```bash
   # Test queue statistics
   queue_stats=$(curl -s "http://localhost:8000/api/v1/queue/public-stats")
   echo "$queue_stats" | grep -q '"success":true' && echo "✅ Queue system: OK" || echo "❌ Queue system: Failed"
   ```

3. **Upload System**
   ```bash
   # Test upload service health
   upload_health=$(curl -s "http://localhost:8000/api/v1/uploads/health")
   echo "$upload_health" | grep -q '"status":"healthy"' && echo "✅ Upload system: OK" || echo "❌ Upload system: Failed"
   ```

4. **WebSocket System**
   ```bash
   # Test WebSocket health
   ws_health=$(curl -s "http://localhost:8000/ws/health")
   echo "$ws_health" | grep -q '"success":true' && echo "✅ WebSocket: OK" || echo "❌ WebSocket: Failed"
   ```

5. **Upload Directory Validation**
   ```bash
   # Check upload directory exists and is writable
   [ -d "/tmp/uploads" ] && [ -w "/tmp/uploads" ] && echo "✅ Upload directory: OK" || echo "❌ Upload directory: Not accessible"
   ```

### Phase 7: Frontend Applications (--frontend or --full)
1. **React Assessment App**
   ```bash
   # Test Vite dev server
   curl -sf "http://localhost:3000" >/dev/null && echo "✅ Assessment app: OK" || echo "❌ Assessment app: Not running"
   ```

2. **Next.js Commercial Website**
   ```bash
   # Test Next.js server
   curl -sf "http://localhost:3002" >/dev/null && echo "✅ Commercial website: OK" || echo "❌ Commercial website: Not running"
   ```

3. **Admin Panel Integration**
   ```bash
   # Test admin panel login page
   curl -sf "http://localhost:8000/admin/login" | grep -q "<title>" && echo "✅ Admin panel: OK" || echo "❌ Admin panel: Not accessible"
   ```

### Phase 8: Log Analysis (--logs or --full)
1. **Backend Error Logs**
   ```bash
   # Check for recent errors in backend logs
   if [ -f "logs/backend.log" ]; then
       echo "Recent backend errors:"
       tail -100 logs/backend.log | grep -E "ERROR|CRITICAL" | tail -5
   fi
   ```

2. **Frontend Error Logs**
   ```bash
   # Check for frontend build/runtime errors
   if [ -f "logs/frontend.log" ]; then
       echo "Recent frontend errors:"
       tail -100 logs/frontend.log | grep -E "ERROR|Failed" | tail -5
   fi
   ```

3. **System Service Logs**
   ```bash
   # Check Redis logs
   redis-cli LASTSAVE >/dev/null 2>&1 && echo "✅ Redis operational" || echo "❌ Redis issues detected"
   ```

### Phase 9: Performance Monitoring (--perf or --full)
1. **Response Time Testing**
   ```bash
   # Test API response times
   echo "API Response Times:"
   time curl -sf "http://localhost:8000/api/v1/system/info" >/dev/null
   time curl -sf "http://localhost:8000/api/v1/system/health-detailed" >/dev/null
   ```

2. **Resource Usage**
   ```bash
   # Check system resources
   echo "System Resources:"
   echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
   echo "Memory: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')"
   echo "Disk: $(df -h . | awk 'NR==2 {print $5}')"
   ```

3. **Service Process Monitoring**
   ```bash
   # Count running processes
   echo "Service Processes:"
   echo "Backend: $(pgrep -f uvicorn | wc -l)"
   echo "Celery: $(pgrep -f celery | wc -l)" 
   echo "Redis: $(pgrep redis-server | wc -l)"
   echo "Node: $(pgrep node | wc -l)"
   ```

### Phase 10: Automatic Fix Attempts (--fix)
1. **Common Service Fixes**
   ```bash
   # Restart failed services
   # Clear Redis cache if corrupted
   # Restart backend if health check fails
   # Clear node_modules and reinstall if frontend issues
   ```

2. **Environment Fixes**
   ```bash
   # Recreate missing directories
   mkdir -p logs pids /tmp/uploads
   # Fix permissions
   chmod 755 /tmp/uploads
   ```

3. **Database Connection Fixes**
   ```bash
   # Test connection and suggest fixes
   # Check for migration conflicts
   ```

## Output Format

### Success Status
```
🚀 Badmintoo Training Lab - Stack Diagnostics
═══════════════════════════════════════════

✅ Environment Validation    [PASSED]
✅ Service Connectivity      [PASSED] 
✅ API Endpoints            [PASSED]
✅ Database Validation      [PASSED]
✅ Authentication Flow      [PASSED]
✅ Phase 2 SaaS Features   [PASSED]
✅ Frontend Applications    [PASSED]

🎉 All systems operational!
```

### Issues Detected
```
🚀 Badmintoo Training Lab - Stack Diagnostics
═══════════════════════════════════════════

✅ Environment Validation    [PASSED]
❌ Service Connectivity      [FAILED]
   • Redis connection timeout
   • Celery workers not running
⚠️  API Endpoints            [WARNINGS]
   • /api/v1/queue/stats returns 422
✅ Database Validation      [PASSED]

🔧 Suggested Fixes:
1. Start Redis: redis-server --daemonize yes
2. Start Celery: ./start-celery.sh
3. Check queue endpoint authentication
```

### Performance Summary
```
📊 Performance Metrics:
• API Response: avg 150ms
• Database: avg 45ms  
• Memory Usage: 68%
• CPU Load: 23%
• Active Connections: 12
```

## Integration with Existing Tools

This command integrates with existing monitoring tools:
- Uses `start-all-services.sh` health check functions
- Leverages `logs/monitor-services.sh` real-time monitoring
- Integrates with existing environment validation

## Post-Execution Actions

After running diagnostics:
1. **If --report flag used**: Generate `logs/diagnostic-report-YYYYMMDD-HHMMSS.md`
2. **If --monitor flag used**: Start real-time monitoring via `logs/monitor-services.sh`  
3. **If --fix flag used**: Log all attempted fixes to `logs/auto-fixes.log`

## Usage Examples

```bash
# Quick health check after update
/debug-stack --quick

# Full comprehensive diagnosis
/debug-stack --full --report

# Focus on specific components
/debug-stack --services --api --db

# Debug Phase 2 features specifically  
/debug-stack --phase2 --logs --perf

# Attempt automatic fixes
/debug-stack --quick --fix

# Generate detailed report
/debug-stack --full --report --monitor
```

This command serves as the definitive post-update validation tool for the Badmintoo Training Lab tech stack, ensuring all components are operational and identifying any issues requiring attention.
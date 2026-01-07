#!/usr/bin/env python3
"""
Debug Stack Command - Badmintoo Training Lab
Comprehensive debugging and validation for the tech stack
"""

import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Check if rich is installed, if not, use basic output
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.table import Table
    from rich.text import Text
    RICH_AVAILABLE = True
    console = Console()
except ImportError:
    RICH_AVAILABLE = False
    class Console:
        def print(self, *args, **kwargs):
            print(*args)
    console = Console()

# Check if click is installed
try:
    import click
    CLICK_AVAILABLE = True
except ImportError:
    CLICK_AVAILABLE = False

# Check if httpx is installed
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    # Fallback to requests if available
    try:
        import requests
        REQUESTS_AVAILABLE = True
    except ImportError:
        REQUESTS_AVAILABLE = False

class StackDebugger:
    def __init__(self, flags: Dict[str, bool]):
        self.flags = flags
        self.results = {}
        self.issues = []
        self.fixes = []
        self.start_time = time.time()
        
    async def run(self):
        """Run the complete diagnostic process"""
        if RICH_AVAILABLE:
            console.print(Panel.fit("🚀 Badmintoo Training Lab - Stack Diagnostics", style="bold cyan"))
        else:
            console.print("🚀 Badmintoo Training Lab - Stack Diagnostics")
        console.print("═" * 50)
        
        # Always run environment validation
        await self.phase_environment_validation()
        
        # Run component-specific checks based on flags
        if self.flags.get('services', False) or self.flags.get('full', False):
            await self.phase_service_connectivity()
            
        if self.flags.get('api', False) or self.flags.get('full', False):
            await self.phase_api_testing()
            
        if self.flags.get('db', False) or self.flags.get('full', False):
            await self.phase_database_validation()
            
        if self.flags.get('auth', False) or self.flags.get('full', False):
            await self.phase_auth_testing()
            
        if self.flags.get('phase2', False) or self.flags.get('full', False):
            await self.phase_saas_features()
            
        if self.flags.get('frontend', False) or self.flags.get('full', False):
            await self.phase_frontend_apps()
            
        if self.flags.get('logs', False) or self.flags.get('full', False):
            await self.phase_log_analysis()
            
        if self.flags.get('perf', False) or self.flags.get('full', False):
            await self.phase_performance()
            
        # Apply fixes if requested
        if self.flags.get('fix', False):
            await self.apply_fixes()
            
        # Generate report if requested
        if self.flags.get('report', False):
            self.generate_report()
            
        # Show summary
        self.show_summary()
        
        # Start monitoring if requested
        if self.flags.get('monitor', False):
            await self.start_monitoring()
    
    async def phase_environment_validation(self):
        """Phase 1: Environment Validation"""
        console.print("[bold blue]Validating environment...[/bold blue]")
        
        results = {
            'project_structure': await self.check_project_structure(),
            'environment_files': await self.check_environment_files(),
            'dependencies': await self.check_dependencies(),
            'git_status': await self.check_git_status()
        }
        
        self.results['environment'] = results
    
    async def check_project_structure(self) -> Dict:
        """Check if we're in the correct directory with required files"""
        cwd = os.getcwd()
        required_files = ['package.json', 'README.md', 'backend/requirements.txt']
        required_dirs = ['src', 'backend', 'migrations', 'docs']
        
        issues = []
        if not cwd.endswith('badmintoo-training-lab'):
            issues.append("Not in badmintoo-training-lab directory")
            
        for file in required_files:
            if not os.path.exists(file):
                issues.append(f"Missing required file: {file}")
                
        for dir in required_dirs:
            if not os.path.isdir(dir):
                issues.append(f"Missing required directory: {dir}")
        
        return {
            'status': 'OK' if not issues else 'FAILED',
            'issues': issues,
            'cwd': cwd
        }
    
    async def check_environment_files(self) -> Dict:
        """Check environment configuration files"""
        env_files = {
            '.env': 'Root environment file',
            'backend/.env': 'Backend environment file',
            '.env.local': 'Local overrides (optional)'
        }
        
        results = {}
        for file, desc in env_files.items():
            exists = os.path.exists(file)
            results[file] = {
                'exists': exists,
                'description': desc,
                'required': file != '.env.local'
            }
            
            if exists and file.endswith('.env'):
                # Check for required variables
                with open(file, 'r') as f:
                    content = f.read()
                    required_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'REDIS_URL']
                    missing = [var for var in required_vars if var not in content]
                    if missing:
                        results[file]['missing_vars'] = missing
        
        return results
    
    async def check_dependencies(self) -> Dict:
        """Check if dependencies are installed"""
        results = {}
        
        # Check Node dependencies
        node_modules_exists = os.path.exists('node_modules')
        results['node_modules'] = {
            'installed': node_modules_exists,
            'package_lock': os.path.exists('package-lock.json')
        }
        
        # Check Python environment
        venv_paths = ['venv', '.venv', 'env', '.env']
        venv_exists = any(os.path.exists(p) for p in venv_paths)
        results['python_venv'] = {
            'exists': venv_exists,
            'activated': 'VIRTUAL_ENV' in os.environ
        }
        
        return results
    
    async def check_git_status(self) -> Dict:
        """Check git repository status"""
        try:
            # Get current branch
            branch = subprocess.check_output(['git', 'branch', '--show-current'], 
                                           text=True).strip()
            
            # Get uncommitted changes count
            status = subprocess.check_output(['git', 'status', '--porcelain'], 
                                           text=True)
            uncommitted = len(status.strip().split('\n')) if status.strip() else 0
            
            return {
                'branch': branch,
                'uncommitted_changes': uncommitted,
                'status': 'OK'
            }
        except Exception as e:
            return {
                'status': 'ERROR',
                'error': str(e)
            }
    
    async def phase_service_connectivity(self):
        """Phase 2: Service Connectivity"""
        console.print("[bold blue]Checking services...[/bold blue]")
        
        results = {
            'redis': await self.check_redis(),
            'fastapi': await self.check_fastapi(),
            'supabase': await self.check_supabase(),
            'celery': await self.check_celery()
        }
        
        self.results['services'] = results
    
    async def check_redis(self) -> Dict:
        """Check Redis connectivity"""
        try:
            # Test basic connectivity
            result = subprocess.run(['redis-cli', 'ping'], 
                                  capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout.strip() == 'PONG':
                # Test read/write
                test_key = 'debug_test_' + str(int(time.time()))
                subprocess.run(['redis-cli', 'SET', test_key, 'test_value'])
                get_result = subprocess.run(['redis-cli', 'GET', test_key], 
                                          capture_output=True, text=True)
                subprocess.run(['redis-cli', 'DEL', test_key])
                
                # Get memory info
                info_result = subprocess.run(['redis-cli', 'INFO', 'memory'], 
                                           capture_output=True, text=True)
                memory_used = None
                if info_result.returncode == 0:
                    for line in info_result.stdout.split('\n'):
                        if line.startswith('used_memory_human:'):
                            memory_used = line.split(':')[1].strip()
                
                return {
                    'status': 'OK',
                    'read_write': get_result.stdout.strip() == 'test_value',
                    'memory_used': memory_used
                }
            else:
                self.issues.append("Redis not responding to ping")
                self.fixes.append("Start Redis: redis-server --daemonize yes")
                return {'status': 'FAILED', 'error': 'Not responding'}
        except FileNotFoundError:
            self.issues.append("Redis CLI not found")
            self.fixes.append("Install Redis: sudo apt-get install redis-server")
            return {'status': 'FAILED', 'error': 'redis-cli not found'}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_fastapi(self) -> Dict:
        """Check FastAPI backend connectivity"""
        if HTTPX_AVAILABLE:
            async with httpx.AsyncClient() as client:
                try:
                    # Basic health check
                    response = await client.get("http://localhost:8000/api/v1/system/info")
                    if response.status_code == 200:
                        # Detailed health check
                        health_response = await client.get("http://localhost:8000/api/v1/system/health-detailed")
                        
                        return {
                            'status': 'OK',
                            'version': response.json().get('version'),
                            'health': health_response.json() if health_response.status_code == 200 else None
                        }
                    else:
                        self.issues.append(f"FastAPI returned status {response.status_code}")
                        return {'status': 'FAILED', 'status_code': response.status_code}
                except httpx.ConnectError:
                    self.issues.append("FastAPI backend not running")
                    self.fixes.append("Start backend: ./start_backend.sh")
                    return {'status': 'FAILED', 'error': 'Connection refused'}
                except Exception as e:
                    return {'status': 'ERROR', 'error': str(e)}
        elif REQUESTS_AVAILABLE:
            # Fallback to requests
            try:
                response = requests.get("http://localhost:8000/api/v1/system/info")
                if response.status_code == 200:
                    health_response = requests.get("http://localhost:8000/api/v1/system/health-detailed")
                    
                    return {
                        'status': 'OK',
                        'version': response.json().get('version'),
                        'health': health_response.json() if health_response.status_code == 200 else None
                    }
                else:
                    self.issues.append(f"FastAPI returned status {response.status_code}")
                    return {'status': 'FAILED', 'status_code': response.status_code}
            except requests.ConnectionError:
                self.issues.append("FastAPI backend not running")
                self.fixes.append("Start backend: ./start_backend.sh")
                return {'status': 'FAILED', 'error': 'Connection refused'}
            except Exception as e:
                return {'status': 'ERROR', 'error': str(e)}
        else:
            return {'status': 'SKIPPED', 'error': 'No HTTP client available (install httpx or requests)'}
    
    async def check_supabase(self) -> Dict:
        """Check Supabase connectivity through backend"""
        if HTTPX_AVAILABLE:
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get("http://localhost:8000/api/v1/system/health-detailed")
                    if response.status_code == 200:
                        health_data = response.json()
                        supabase_health = health_data.get('details', {}).get('supabase', {})
                        return {
                            'status': 'OK' if supabase_health.get('healthy') else 'FAILED',
                            'details': supabase_health
                        }
                    else:
                        return {'status': 'UNKNOWN', 'error': 'Could not check through backend'}
                except Exception as e:
                    return {'status': 'ERROR', 'error': str(e)}
        elif REQUESTS_AVAILABLE:
            try:
                response = requests.get("http://localhost:8000/api/v1/system/health-detailed")
                if response.status_code == 200:
                    health_data = response.json()
                    supabase_health = health_data.get('details', {}).get('supabase', {})
                    return {
                        'status': 'OK' if supabase_health.get('healthy') else 'FAILED',
                        'details': supabase_health
                    }
                else:
                    return {'status': 'UNKNOWN', 'error': 'Could not check through backend'}
            except Exception as e:
                return {'status': 'ERROR', 'error': str(e)}
        else:
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
    
    async def check_celery(self) -> Dict:
        """Check Celery workers"""
        try:
            # Check for running workers
            result = subprocess.run(['pgrep', '-f', 'celery.*worker'], 
                                  capture_output=True, text=True)
            worker_count = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0
            
            if worker_count > 0:
                return {
                    'status': 'OK',
                    'worker_count': worker_count
                }
            else:
                self.issues.append("No Celery workers running")
                self.fixes.append("Start Celery: ./start-celery.sh")
                return {'status': 'FAILED', 'worker_count': 0}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def phase_api_testing(self):
        """Phase 3: API Endpoint Testing"""
        console.print("[bold blue]Testing API endpoints...[/bold blue]")
        
        endpoints = {
            'system': [
                ('/api/v1/system/info', 'GET', None),
                ('/api/v1/system/health-detailed', 'GET', None),
                ('/docs', 'GET', None),
                ('/openapi.json', 'GET', None)
            ],
            'auth': [
                ('/api/v1/auth/me', 'GET', {'headers': {'Authorization': 'Bearer test'}}),
            ],
            'phase2': [
                ('/api/v1/products/public-stats', 'GET', None),
                ('/api/v1/queue/public-stats', 'GET', None),
                ('/api/v1/uploads/health', 'GET', None),
                ('/ws/health', 'GET', None)
            ],
            'admin': [
                ('/admin/login', 'GET', None),
                ('/admin/dashboard', 'GET', None)
            ]
        }
        
        results = {}
        
        if HTTPX_AVAILABLE or REQUESTS_AVAILABLE:
            for category, endpoint_list in endpoints.items():
                if self.flags.get('quick', True) and category not in ['system', 'phase2']:
                    continue
                    
                category_results = []
                for path, method, options in endpoint_list:
                    url = f"http://localhost:8000{path}"
                    try:
                        if HTTPX_AVAILABLE:
                            async with httpx.AsyncClient() as client:
                                if method == 'GET':
                                    response = await client.get(url, **(options or {}))
                                else:
                                    response = await client.request(method, url, **(options or {}))
                        else:
                            if method == 'GET':
                                response = requests.get(url, **(options or {}))
                            else:
                                response = requests.request(method, url, **(options or {}))
                        
                        status = 'OK' if response.status_code in [200, 401, 403] else 'FAILED'
                        if response.status_code == 422:
                            self.issues.append(f"{path} returns 422 validation error")
                            status = 'WARNING'
                            
                        category_results.append({
                            'path': path,
                            'status': status,
                            'status_code': response.status_code
                        })
                    except Exception as e:
                        category_results.append({
                            'path': path,
                            'status': 'ERROR',
                            'error': str(e)
                        })
                
                results[category] = category_results
        else:
            results['error'] = 'No HTTP client available'
        
        self.results['api'] = results
    
    async def phase_database_validation(self):
        """Phase 4: Database Validation"""
        console.print("[bold blue]Validating database...[/bold blue]")
        
        results = {
            'migrations': await self.check_migrations(),
            'schema': await self.check_schema(),
            'rls': await self.check_rls()
        }
        
        self.results['database'] = results
    
    async def check_migrations(self) -> Dict:
        """Check migration status"""
        try:
            # Change to backend directory
            orig_dir = os.getcwd()
            os.chdir('backend')
            
            # Run Python script to check migrations
            script = """
import asyncio
import sys
sys.path.insert(0, '.')

try:
    from services.supabase import get_supabase_service
    
    async def check():
        try:
            supabase = get_supabase_service()
            result = await supabase.table('schema_migrations').select('version').order('version', desc=True).limit(1).execute()
            if result.data:
                print(f"LATEST:{result.data[0]['version']}")
            else:
                print("LATEST:None")
        except Exception as e:
            print(f"ERROR:{str(e)}")
    
    asyncio.run(check())
except ImportError as e:
    print(f"ERROR:Import failed - {str(e)}")
"""
            result = subprocess.run([sys.executable, '-c', script], 
                                  capture_output=True, text=True)
            
            os.chdir(orig_dir)  # Return to project root
            
            if result.stdout.startswith('LATEST:'):
                latest = result.stdout.strip().split(':')[1]
                return {
                    'status': 'OK',
                    'latest_migration': latest
                }
            elif result.stdout.startswith('ERROR:'):
                error = result.stdout.strip().split(':', 1)[1]
                return {
                    'status': 'FAILED',
                    'error': error
                }
            else:
                return {
                    'status': 'UNKNOWN',
                    'output': result.stdout + result.stderr
                }
        except Exception as e:
            if 'orig_dir' in locals():
                os.chdir(orig_dir)  # Ensure we return to project root
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_schema(self) -> Dict:
        """Check if critical tables exist"""
        try:
            orig_dir = os.getcwd()
            os.chdir('backend')
            
            script = """
import asyncio
import sys
sys.path.insert(0, '.')

try:
    from services.supabase import get_supabase_service
    
    async def check():
        supabase = get_supabase_service()
        tables = ['contacts', 'user_sessions', 'products', 'queue_items', 'organizations']
        results = []
        
        for table in tables:
            try:
                result = await supabase.table(table).select('*').limit(1).execute()
                results.append(f"{table}:OK")
            except Exception as e:
                results.append(f"{table}:FAILED:{str(e)}")
        
        for r in results:
            print(r)
    
    asyncio.run(check())
except ImportError as e:
    print(f"ERROR:Import failed - {str(e)}")
"""
            result = subprocess.run([sys.executable, '-c', script], 
                                  capture_output=True, text=True)
            
            os.chdir(orig_dir)
            
            table_results = {}
            for line in result.stdout.strip().split('\n'):
                if ':' in line:
                    parts = line.split(':', 2)
                    table = parts[0]
                    status = parts[1]
                    error = parts[2] if len(parts) > 2 else None
                    
                    table_results[table] = {
                        'status': status,
                        'error': error
                    }
                    
                    if status == 'FAILED':
                        self.issues.append(f"Table {table} not accessible")
            
            return {
                'status': 'OK' if all(t['status'] == 'OK' for t in table_results.values()) else 'FAILED',
                'tables': table_results
            }
        except Exception as e:
            if 'orig_dir' in locals():
                os.chdir(orig_dir)
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_rls(self) -> Dict:
        """Check Row Level Security policies"""
        # This is a placeholder - actual RLS checking would require more complex queries
        return {
            'status': 'SKIPPED',
            'message': 'RLS checking not implemented in quick mode'
        }
    
    async def phase_auth_testing(self):
        """Phase 5: Authentication Flow Testing"""
        console.print("[bold blue]Testing authentication...[/bold blue]")
        
        results = {
            'jwt_validation': await self.check_jwt_validation(),
            'rbac': await self.check_rbac(),
            'admin_access': await self.check_admin_access()
        }
        
        self.results['auth'] = results
    
    async def check_jwt_validation(self) -> Dict:
        """Test JWT validation"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/api/v1/auth/validate-token"
            data = {"token": "invalid_token"}
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, json=data)
            else:
                response = requests.post(url, json=data)
            
            return {
                'status': 'OK' if response.status_code in [401, 422] else 'FAILED',
                'response_code': response.status_code
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_rbac(self) -> Dict:
        """Test role-based access control"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/api/v1/auth/me"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            return {
                'status': 'OK',
                'endpoint_exists': response.status_code in [401, 403]
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_admin_access(self) -> Dict:
        """Test admin panel access"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/admin/dashboard"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            # Admin should redirect to login if not authenticated
            is_protected = response.status_code in [401, 403, 302]
            
            return {
                'status': 'OK' if is_protected else 'WARNING',
                'protected': is_protected,
                'status_code': response.status_code
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def phase_saas_features(self):
        """Phase 6: Phase 2 SaaS Features"""
        console.print("[bold blue]Testing SaaS features...[/bold blue]")
        
        results = {
            'products': await self.check_products(),
            'queue': await self.check_queue(),
            'uploads': await self.check_uploads(),
            'websockets': await self.check_websockets()
        }
        
        self.results['phase2'] = results
    
    async def check_products(self) -> Dict:
        """Test product catalog system"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/api/v1/products/public-stats"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'OK' if data.get('success') else 'FAILED',
                    'data': data
                }
            else:
                self.issues.append(f"Product stats returned {response.status_code}")
                return {
                    'status': 'FAILED',
                    'status_code': response.status_code
                }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_queue(self) -> Dict:
        """Test queue management system"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/api/v1/queue/public-stats"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'OK' if data.get('success') else 'FAILED',
                    'data': data
                }
            else:
                self.issues.append(f"Queue stats returned {response.status_code}")
                return {
                    'status': 'FAILED',
                    'status_code': response.status_code
                }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_uploads(self) -> Dict:
        """Test upload system"""
        # Check upload directory
        upload_dir = Path('/tmp/uploads')
        dir_exists = upload_dir.exists()
        dir_writable = os.access('/tmp/uploads', os.W_OK) if dir_exists else False
        
        if not dir_exists:
            self.fixes.append("Create upload directory: mkdir -p /tmp/uploads")
        elif not dir_writable:
            self.fixes.append("Fix upload directory permissions: chmod 755 /tmp/uploads")
        
        # Check upload health endpoint
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {
                'status': 'PARTIAL',
                'directory_exists': dir_exists,
                'directory_writable': dir_writable,
                'endpoint_status': 'SKIPPED'
            }
            
        try:
            url = "http://localhost:8000/api/v1/uploads/health"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            return {
                'status': 'OK' if response.status_code == 200 and dir_exists and dir_writable else 'FAILED',
                'directory_exists': dir_exists,
                'directory_writable': dir_writable,
                'endpoint_status': response.status_code
            }
        except Exception as e:
            return {
                'status': 'ERROR',
                'directory_exists': dir_exists,
                'directory_writable': dir_writable,
                'error': str(e)
            }
    
    async def check_websockets(self) -> Dict:
        """Test WebSocket system"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/ws/health"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            return {
                'status': 'OK' if response.status_code == 200 else 'FAILED',
                'status_code': response.status_code
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def phase_frontend_apps(self):
        """Phase 7: Frontend Applications"""
        console.print("[bold blue]Checking frontend apps...[/bold blue]")
        
        results = {
            'assessment_app': await self.check_assessment_app(),
            'commercial_website': await self.check_commercial_website(),
            'admin_panel': await self.check_admin_panel()
        }
        
        self.results['frontend'] = results
    
    async def check_assessment_app(self) -> Dict:
        """Check React assessment app"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:3000"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
                
            return {
                'status': 'OK' if response.status_code == 200 else 'FAILED',
                'running': response.status_code == 200
            }
        except (httpx.ConnectError if HTTPX_AVAILABLE else requests.ConnectionError):
            self.issues.append("Assessment app not running")
            self.fixes.append("Start assessment app: npm run dev")
            return {'status': 'FAILED', 'running': False}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_commercial_website(self) -> Dict:
        """Check Next.js commercial website"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:3002"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
                
            return {
                'status': 'OK' if response.status_code == 200 else 'FAILED',
                'running': response.status_code == 200
            }
        except (httpx.ConnectError if HTTPX_AVAILABLE else requests.ConnectionError):
            self.issues.append("Commercial website not running")
            self.fixes.append("Start commercial website: cd apps/commercial-website && npm run dev")
            return {'status': 'FAILED', 'running': False}
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_admin_panel(self) -> Dict:
        """Check admin panel integration"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        try:
            url = "http://localhost:8000/admin/login"
            
            if HTTPX_AVAILABLE:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
            else:
                response = requests.get(url)
            
            # Check if HTML is returned
            is_html = 'text/html' in response.headers.get('content-type', '')
            
            return {
                'status': 'OK' if response.status_code == 200 and is_html else 'FAILED',
                'accessible': response.status_code == 200,
                'is_html': is_html
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def phase_log_analysis(self):
        """Phase 8: Log Analysis"""
        console.print("[bold blue]Analyzing logs...[/bold blue]")
        
        results = {
            'backend_errors': await self.analyze_backend_logs(),
            'frontend_errors': await self.analyze_frontend_logs(),
            'service_logs': await self.analyze_service_logs()
        }
        
        self.results['logs'] = results
    
    async def analyze_backend_logs(self) -> Dict:
        """Analyze backend error logs"""
        log_file = Path('logs/backend.log')
        if not log_file.exists():
            return {'status': 'NO_LOGS', 'message': 'No backend log file found'}
        
        try:
            # Get last 100 lines and look for errors
            result = subprocess.run(['tail', '-100', str(log_file)], 
                                  capture_output=True, text=True)
            
            error_lines = []
            for line in result.stdout.split('\n'):
                if 'ERROR' in line or 'CRITICAL' in line:
                    error_lines.append(line)
            
            recent_errors = error_lines[-5:] if error_lines else []
            
            return {
                'status': 'OK' if not error_lines else 'WARNINGS',
                'error_count': len(error_lines),
                'recent_errors': recent_errors
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def analyze_frontend_logs(self) -> Dict:
        """Analyze frontend error logs"""
        # Frontend logs might be in browser console, so check build logs
        return {
            'status': 'SKIPPED',
            'message': 'Frontend logs are in browser console'
        }
    
    async def analyze_service_logs(self) -> Dict:
        """Analyze service logs"""
        try:
            # Quick Redis check
            result = subprocess.run(['redis-cli', 'LASTSAVE'], 
                                  capture_output=True, text=True)
            
            redis_ok = result.returncode == 0
            
            return {
                'status': 'OK' if redis_ok else 'WARNINGS',
                'redis_operational': redis_ok
            }
        except Exception:
            return {'status': 'ERROR', 'redis_operational': False}
    
    async def phase_performance(self):
        """Phase 9: Performance Monitoring"""
        console.print("[bold blue]Checking performance...[/bold blue]")
        
        results = {
            'response_times': await self.check_response_times(),
            'resource_usage': await self.check_resource_usage(),
            'process_count': await self.check_process_count()
        }
        
        self.results['performance'] = results
    
    async def check_response_times(self) -> Dict:
        """Test API response times"""
        if not (HTTPX_AVAILABLE or REQUESTS_AVAILABLE):
            return {'status': 'SKIPPED', 'error': 'No HTTP client available'}
            
        endpoints = [
            '/api/v1/system/info',
            '/api/v1/system/health-detailed'
        ]
        
        results = {}
        
        for endpoint in endpoints:
            try:
                url = f"http://localhost:8000{endpoint}"
                start = time.time()
                
                if HTTPX_AVAILABLE:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(url)
                else:
                    response = requests.get(url)
                    
                elapsed = (time.time() - start) * 1000  # Convert to ms
                
                results[endpoint] = {
                    'time_ms': round(elapsed, 2),
                    'status_code': response.status_code
                }
            except Exception as e:
                results[endpoint] = {
                    'error': str(e)
                }
        
        return results
    
    async def check_resource_usage(self) -> Dict:
        """Check system resource usage"""
        try:
            # CPU usage
            cpu_result = subprocess.run(['top', '-bn1'], 
                                      capture_output=True, text=True)
            cpu_line = next((line for line in cpu_result.stdout.split('\n') 
                            if 'Cpu(s)' in line), None)
            cpu_usage = None
            if cpu_line:
                # Extract CPU usage percentage
                parts = cpu_line.split()
                for part in parts:
                    if part.endswith('%us,'):
                        cpu_usage = part[:-4]
                        break
            
            # Memory usage
            mem_result = subprocess.run(['free', '-m'], 
                                      capture_output=True, text=True)
            mem_lines = mem_result.stdout.split('\n')
            memory_usage = None
            if len(mem_lines) > 1:
                mem_parts = mem_lines[1].split()
                if len(mem_parts) >= 3:
                    total = float(mem_parts[1])
                    used = float(mem_parts[2])
                    memory_usage = round((used / total) * 100, 1)
            
            # Disk usage
            disk_result = subprocess.run(['df', '-h', '.'], 
                                       capture_output=True, text=True)
            disk_lines = disk_result.stdout.split('\n')
            disk_usage = None
            if len(disk_lines) > 1:
                disk_parts = disk_lines[1].split()
                if len(disk_parts) >= 5:
                    disk_usage = disk_parts[4]
            
            return {
                'cpu_usage': cpu_usage,
                'memory_usage_percent': memory_usage,
                'disk_usage': disk_usage
            }
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def check_process_count(self) -> Dict:
        """Count running service processes"""
        try:
            processes = {}
            
            # Check backend
            try:
                result = subprocess.check_output(['pgrep', '-f', 'uvicorn'], text=True)
                processes['backend'] = len(result.strip().split('\n')) if result.strip() else 0
            except subprocess.CalledProcessError:
                processes['backend'] = 0
            
            # Check celery
            try:
                result = subprocess.check_output(['pgrep', '-f', 'celery'], text=True)
                processes['celery'] = len(result.strip().split('\n')) if result.strip() else 0
            except subprocess.CalledProcessError:
                processes['celery'] = 0
            
            # Check redis
            try:
                result = subprocess.check_output(['pgrep', 'redis-server'], text=True)
                processes['redis'] = len(result.strip().split('\n')) if result.strip() else 0
            except subprocess.CalledProcessError:
                processes['redis'] = 0
            
            # Check node
            try:
                result = subprocess.check_output(['pgrep', 'node'], text=True)
                processes['node'] = len(result.strip().split('\n')) if result.strip() else 0
            except subprocess.CalledProcessError:
                processes['node'] = 0
            
            return processes
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    async def apply_fixes(self):
        """Apply automatic fixes for common issues"""
        if not self.fixes:
            return
        
        console.print("\n[bold yellow]Applying fixes...[/bold yellow]")
        
        for fix in self.fixes:
            console.print(f"  • {fix}")
            
            # Implement automatic fixes
            if "mkdir -p" in fix:
                try:
                    subprocess.run(fix.split(), check=True)
                    console.print(f"    ✅ Created directory")
                except:
                    console.print(f"    ❌ Failed to create directory")
            elif "chmod" in fix:
                try:
                    subprocess.run(fix.split(), check=True)
                    console.print(f"    ✅ Fixed permissions")
                except:
                    console.print(f"    ❌ Failed to fix permissions")
            else:
                console.print(f"    ⚠️  Manual fix required")
    
    def generate_report(self):
        """Generate detailed diagnostic report"""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        report_file = f"logs/diagnostic-report-{timestamp}.md"
        
        os.makedirs('logs', exist_ok=True)
        
        with open(report_file, 'w') as f:
            f.write("# Badmintoo Training Lab - Diagnostic Report\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Duration: {time.time() - self.start_time:.2f} seconds\n\n")
            
            # Write results
            f.write("## Results\n\n")
            f.write("```json\n")
            f.write(json.dumps(self.results, indent=2))
            f.write("\n```\n\n")
            
            # Write issues
            if self.issues:
                f.write("## Issues Found\n\n")
                for issue in self.issues:
                    f.write(f"- {issue}\n")
                f.write("\n")
            
            # Write suggested fixes
            if self.fixes:
                f.write("## Suggested Fixes\n\n")
                for fix in self.fixes:
                    f.write(f"- {fix}\n")
        
        console.print(f"\n📄 Report saved to: {report_file}")
    
    def show_summary(self):
        """Show summary of diagnostic results"""
        console.print("\n" + "═" * 50)
        
        if RICH_AVAILABLE:
            # Create summary table
            table = Table(title="Diagnostic Summary")
            table.add_column("Component", style="cyan")
            table.add_column("Status", style="green")
            table.add_column("Details", style="white")
            
            # Add rows for each component
            status_symbols = {
                'OK': '✅',
                'FAILED': '❌',
                'WARNING': '⚠️',
                'SKIPPED': '⏭️',
                'ERROR': '🔥'
            }
            
            for phase, results in self.results.items():
                phase_status = self._get_phase_status(results)
                symbol = status_symbols.get(phase_status, '❓')
                
                details = self._get_phase_details(phase, results)
                
                table.add_row(
                    phase.replace('_', ' ').title(),
                    f"{symbol} {phase_status}",
                    details
                )
            
            console.print(table)
        else:
            # Basic text output
            console.print("Diagnostic Summary")
            console.print("-" * 30)
            
            for phase, results in self.results.items():
                phase_status = self._get_phase_status(results)
                details = self._get_phase_details(phase, results)
                console.print(f"{phase.replace('_', ' ').title()}: {phase_status} - {details}")
        
        # Show issues summary
        if self.issues:
            console.print(f"\n🔧 {len(self.issues)} issues found")
            for i, issue in enumerate(self.issues[:5], 1):
                console.print(f"  {i}. {issue}")
            if len(self.issues) > 5:
                console.print(f"  ... and {len(self.issues) - 5} more")
        else:
            console.print("\n🎉 All systems operational!")
        
        # Show performance metrics if available
        if 'performance' in self.results:
            perf = self.results['performance']
            if 'response_times' in perf:
                console.print("\n📊 Performance Metrics:")
                for endpoint, data in perf['response_times'].items():
                    if 'time_ms' in data:
                        console.print(f"  • {endpoint}: {data['time_ms']}ms")
    
    def _get_phase_status(self, results: Dict) -> str:
        """Determine overall status for a phase"""
        if isinstance(results, dict):
            statuses = []
            for key, value in results.items():
                if isinstance(value, dict) and 'status' in value:
                    statuses.append(value['status'])
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and 'status' in item:
                            statuses.append(item['status'])
            
            if not statuses:
                return 'UNKNOWN'
            elif any(s == 'FAILED' for s in statuses):
                return 'FAILED'
            elif any(s == 'ERROR' for s in statuses):
                return 'ERROR'
            elif any(s == 'WARNING' for s in statuses):
                return 'WARNING'
            elif all(s == 'OK' for s in statuses):
                return 'OK'
            else:
                return 'MIXED'
        return 'UNKNOWN'
    
    def _get_phase_details(self, phase: str, results: Dict) -> str:
        """Get summary details for a phase"""
        if phase == 'environment':
            issues = results.get('project_structure', {}).get('issues', [])
            if issues:
                return f"{len(issues)} structure issues"
            return "All files present"
        
        elif phase == 'services':
            running = []
            not_running = []
            for service, data in results.items():
                if data.get('status') == 'OK':
                    running.append(service)
                else:
                    not_running.append(service)
            
            if not_running:
                return f"Not running: {', '.join(not_running)}"
            return f"All {len(running)} services running"
        
        elif phase == 'api':
            total = sum(len(endpoints) for endpoints in results.values() if isinstance(endpoints, list))
            failed = sum(1 for cat in results.values() if isinstance(cat, list) for ep in cat 
                        if ep.get('status') != 'OK')
            if failed:
                return f"{failed}/{total} endpoints failed"
            return f"All {total} endpoints OK"
        
        elif phase == 'database':
            if 'schema' in results:
                tables = results['schema'].get('tables', {})
                ok_tables = sum(1 for t in tables.values() if t.get('status') == 'OK')
                return f"{ok_tables}/{len(tables)} tables accessible"
            return "Check completed"
        
        elif phase == 'phase2':
            features = []
            for feature, data in results.items():
                if data.get('status') == 'OK':
                    features.append(f"{feature} ✓")
                else:
                    features.append(f"{feature} ✗")
            return ", ".join(features)
        
        elif phase == 'performance':
            if 'resource_usage' in results:
                res = results['resource_usage']
                parts = []
                if res.get('cpu_usage'):
                    parts.append(f"CPU: {res['cpu_usage']}%")
                if res.get('memory_usage_percent'):
                    parts.append(f"Memory: {res['memory_usage_percent']}%")
                return ", ".join(parts) if parts else "Metrics collected"
            return "Metrics collected"
        
        return "Completed"
    
    async def start_monitoring(self):
        """Start real-time monitoring after diagnostics"""
        console.print("\n[bold cyan]Starting real-time monitoring...[/bold cyan]")
        console.print("Press Ctrl+C to stop\n")
        
        # Launch monitoring script if available
        monitor_script = Path('logs/monitor-services.sh')
        if monitor_script.exists():
            subprocess.run(['bash', str(monitor_script)])
        else:
            console.print("[yellow]Monitoring script not found[/yellow]")
            console.print("Manual monitoring: watch 'ps aux | grep -E \"(uvicorn|celery|redis|node)\"'")


def main():
    """Badmintoo Training Lab - Comprehensive Stack Diagnostics"""
    
    # Parse command line arguments
    args = sys.argv[1:]
    
    flags = {
        'quick': '--quick' in args or not any(arg.startswith('--') for arg in args),
        'full': '--full' in args,
        'critical': '--critical' in args,
        'services': '--services' in args,
        'api': '--api' in args,
        'db': '--db' in args,
        'auth': '--auth' in args,
        'phase2': '--phase2' in args,
        'frontend': '--frontend' in args,
        'logs': '--logs' in args,
        'perf': '--perf' in args,
        'env': '--env' in args,
        'fix': '--fix' in args,
        'report': '--report' in args,
        'monitor': '--monitor' in args,
    }
    
    # Show help if requested
    if '--help' in args or '-h' in args:
        print("""
Badmintoo Training Lab - Stack Diagnostics

Usage: python debug-stack.py [--flags]

Available Flags:

Scope Flags:
  --quick     Essential 5-minute health check (default)
  --full      Comprehensive 15-20 minute diagnosis
  --critical  Only critical system components

Component Flags:
  --services  Focus on service connectivity (Redis, FastAPI, Supabase, Celery)
  --api       Test all API endpoints systematically
  --db        Database schema, migrations, RLS policies validation
  --auth      Authentication flow and role-based access testing
  --phase2    Phase 2 SaaS features (products, queue, uploads, websockets)
  --frontend  React app, admin panel, commercial website
  --logs      Analyze recent error logs across all services
  --perf      Performance metrics and resource monitoring
  --env       Environment configuration validation

Action Flags:
  --fix       Attempt automatic fixes for common issues
  --report    Generate detailed diagnostic markdown report
  --monitor   Start real-time monitoring after diagnostics
""")
        return
    
    # Check for missing dependencies
    missing_deps = []
    if not RICH_AVAILABLE:
        missing_deps.append("rich")
    if not HTTPX_AVAILABLE and not REQUESTS_AVAILABLE:
        missing_deps.append("httpx or requests")
    
    if missing_deps:
        console.print(f"⚠️  Missing optional dependencies: {', '.join(missing_deps)}")
        console.print("Install them for better experience: pip install rich httpx")
        console.print("")
    
    # Create debugger instance and run
    debugger = StackDebugger(flags)
    
    try:
        asyncio.run(debugger.run())
    except KeyboardInterrupt:
        console.print("\n[yellow]Diagnostic interrupted[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[bold red]Error: {str(e)}[/bold red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
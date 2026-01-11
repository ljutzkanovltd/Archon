# Simple Migration Approach - Install PG17 on Host

**Status:** Simplest solution - no Docker complexity
**Time:** 45-50 minutes total

---

## ✅ **ULTRA-SIMPLE PLAN**

### **Step 1: Install PostgreSQL 17 Client on Host** (3 minutes)

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import signing key
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg

# Update and install
sudo apt update
sudo apt install -y postgresql-client-17

# Verify
/usr/lib/postgresql/17/bin/pg_dump --version
```

---

### **Step 2: Run Migration** (40-45 minutes)

```bash
cd ~/Documents/Projects/archon
./scripts/migrate-cloud-to-local-v2.sh
```

---

### **Step 3: Start Archon & Test** (2 minutes)

```bash
./start-archon.sh --skip-nextjs

# Test
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"API","match_count":5}' | jq
```

---

## 🎯 **Why This Works**

- ✅ No Docker build complexity
- ✅ PostgreSQL official repo (reliable)
- ✅ Works on Ubuntu 24.04
- ✅ Already have script ready (migrate-cloud-to-local-v2.sh)

---

## 📊 **Timeline**

| Step | Duration |
|------|----------|
| Install PG17 client | 3 min |
| Export from cloud | 5-15 min |
| Import to local | 10-20 min |
| Create index | 15-25 min |
| Verify | 2 min |
| **TOTAL** | **35-65 min** |

---

## 🚀 **EXECUTE (Copy-Paste)**

```bash
# Step 1: Install PG17 client (3 min)
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' && \
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg && \
sudo apt update && \
sudo apt install -y postgresql-client-17 && \
/usr/lib/postgresql/17/bin/pg_dump --version

# Step 2: Run migration (40-45 min)
cd ~/Documents/Projects/archon && \
./scripts/migrate-cloud-to-local-v2.sh

# Step 3: Start Archon
./start-archon.sh --skip-nextjs
```

---

**Ready? Just run the commands above!** 🚀

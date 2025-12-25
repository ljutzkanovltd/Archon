#!/usr/bin/env python3
"""
Extended Library Catalog for Archon, SportERP, and Local AI Projects
Includes Azure services for hybrid Odoo deployment
This catalog will be used by the batch crawling orchestrator
"""

LIBRARY_CATALOG = {
    "archon": {
        "backend_frameworks": [
            {"name": "FastAPI", "version": "0.104.0 - 0.119.1", "url": "https://fastapi.tiangolo.com/", "priority": 1},
            {"name": "Uvicorn", "version": "0.24.0 - 0.38.0", "url": "https://www.uvicorn.org/", "priority": 2},
            {"name": "Pydantic", "version": "2.0+", "url": "https://docs.pydantic.dev/", "priority": 1},
            {"name": "SQLAlchemy", "version": "2.0.27", "url": "https://docs.sqlalchemy.org/", "priority": 2},
        ],
        "frontend_frameworks": [
            {"name": "React", "version": "18.3.1", "url": "https://react.dev/", "priority": 1},
            {"name": "Vite", "version": "5.2.0", "url": "https://vitejs.dev/", "priority": 2},
            {"name": "TypeScript", "version": "5.5.4", "url": "https://www.typescriptlang.org/docs/", "priority": 1},
            {"name": "TanStack Query", "version": "5.85.8", "url": "https://tanstack.com/query/latest", "priority": 1},
            {"name": "Zustand", "version": "5.0.8", "url": "https://zustand-demo.pmnd.rs/", "priority": 2},
            {"name": "React Router", "version": "6.26.2", "url": "https://reactrouter.com/", "priority": 2},
        ],
        "ui_libraries": [
            {"name": "Tailwind CSS", "version": "4.1.2", "url": "https://tailwindcss.com/docs", "priority": 1},
            {"name": "Radix UI", "version": "Latest", "url": "https://www.radix-ui.com/primitives/docs/overview/introduction", "priority": 2},
            {"name": "Framer Motion", "version": "11.5.4", "url": "https://www.framer.com/motion/", "priority": 3},
            {"name": "Lucide React", "version": "0.441.0", "url": "https://lucide.dev/", "priority": 3},
        ],
        "ai_ml": [
            {"name": "OpenAI Python", "version": "1.71.0", "url": "https://platform.openai.com/docs/", "priority": 1},
            {"name": "PydanticAI", "version": "0.0.13", "url": "https://ai.pydantic.dev/", "priority": 1},
            {"name": "Model Context Protocol", "version": "1.12.2", "url": "https://modelcontextprotocol.io/", "priority": 1},
            {"name": "crawl4ai", "version": "0.7.4", "url": "https://crawl4ai.com/mkdocs/", "priority": 2},
        ],
        "database": [
            {"name": "PostgreSQL", "version": "15+", "url": "https://www.postgresql.org/docs/15/", "priority": 1},
            {"name": "pgvector", "version": "Latest", "url": "https://github.com/pgvector/pgvector", "priority": 2},
            {"name": "Supabase Python", "version": "2.15.1", "url": "https://supabase.com/docs/reference/python/introduction", "priority": 1},
            {"name": "asyncpg", "version": "0.29.0", "url": "https://magicstack.github.io/asyncpg/", "priority": 2},
        ],
        "testing_quality": [
            {"name": "pytest", "version": "8.0+", "url": "https://docs.pytest.org/", "priority": 2},
            {"name": "Ruff", "version": "0.12.5+", "url": "https://docs.astral.sh/ruff/", "priority": 2},
            {"name": "Vitest", "version": "1.6.0", "url": "https://vitest.dev/", "priority": 2},
            {"name": "Biome", "version": "2.2.2", "url": "https://biomejs.dev/", "priority": 3},
        ],
    },

    "sporterp": {
        "frontend_frameworks": [
            {"name": "Next.js", "version": "15.5.6", "url": "https://nextjs.org/docs", "priority": 1},
            {"name": "React", "version": "18.3.1", "url": "https://react.dev/", "priority": 1},
            {"name": "TypeScript", "version": "5.8.3", "url": "https://www.typescriptlang.org/docs/", "priority": 1},
        ],
        "ui_libraries": [
            {"name": "Tailwind CSS", "version": "4.1.1", "url": "https://tailwindcss.com/docs", "priority": 1},
            {"name": "Flowbite React", "version": "0.12.13", "url": "https://flowbite-react.com/", "priority": 1},
            {"name": "Styled Components", "version": "6.1.19", "url": "https://styled-components.com/docs", "priority": 2},
            {"name": "Framer Motion", "version": "12.22.0", "url": "https://www.framer.com/motion/", "priority": 2},
        ],
        "state_management": [
            {"name": "Zustand", "version": "5.0.5", "url": "https://zustand-demo.pmnd.rs/", "priority": 2},
            {"name": "Redux Toolkit", "version": "2.8.2", "url": "https://redux-toolkit.js.org/", "priority": 2},
        ],
        "forms_validation": [
            {"name": "React Hook Form", "version": "7.58.1", "url": "https://react-hook-form.com/", "priority": 2},
            {"name": "Yup", "version": "1.6.1", "url": "https://github.com/jquense/yup", "priority": 3},
        ],
        "data_visualization": [
            {"name": "D3.js", "version": "7.9.0", "url": "https://d3js.org/", "priority": 2},
            {"name": "Recharts", "version": "2.15.3", "url": "https://recharts.org/", "priority": 2},
        ],
        "ai_integration": [
            {"name": "CopilotKit", "version": "1.50.0", "url": "https://docs.copilotkit.ai/", "priority": 2},
            {"name": "OpenAI Node", "version": "4.104.0", "url": "https://platform.openai.com/docs/", "priority": 1},
        ],
        "payment_auth": [
            {"name": "Stripe JS", "version": "7.4.0", "url": "https://stripe.com/docs/stripe-js", "priority": 2},
            {"name": "Stripe React", "version": "3.7.0", "url": "https://stripe.com/docs/stripe-js/react", "priority": 2},
            {"name": "Google OAuth", "version": "0.12.2", "url": "https://developers.google.com/identity/protocols/oauth2", "priority": 3},
        ],
        "cloud_services": [
            # Azure services for hybrid Odoo deployment
            {"name": "Azure Storage Blob", "version": "12.29.1", "url": "https://learn.microsoft.com/en-us/azure/storage/blobs/", "priority": 1, "tags": ["azure", "storage"]},
            {"name": "Azure Functions", "version": "Latest", "url": "https://learn.microsoft.com/en-us/azure/azure-functions/", "priority": 2, "tags": ["azure", "serverless"]},
            {"name": "Azure App Service", "version": "Latest", "url": "https://learn.microsoft.com/en-us/azure/app-service/", "priority": 2, "tags": ["azure", "hosting"]},
            {"name": "Azure PostgreSQL", "version": "Latest", "url": "https://learn.microsoft.com/en-us/azure/postgresql/", "priority": 2, "tags": ["azure", "database"]},
            {"name": "Azure Virtual Networks", "version": "Latest", "url": "https://learn.microsoft.com/en-us/azure/virtual-network/", "priority": 3, "tags": ["azure", "networking"]},
            {"name": "Azure AI Foundry", "version": "Latest", "url": "https://learn.microsoft.com/en-us/azure/ai-foundry/", "priority": 2, "tags": ["azure", "ai"]},
        ],
        "backend_api": [
            {"name": "FastAPI", "version": "0.109.0", "url": "https://fastapi.tiangolo.com/", "priority": 1},
            {"name": "SQLAlchemy", "version": "2.0.27", "url": "https://docs.sqlalchemy.org/", "priority": 2},
            {"name": "psycopg2", "version": "2.9.9", "url": "https://www.psycopg.org/docs/", "priority": 2},
            {"name": "HTTPX", "version": "0.27.0", "url": "https://www.python-httpx.org/", "priority": 2},
        ],
        "backend_utilities": [
            {"name": "python-jose", "version": "3.3.0", "url": "https://python-jose.readthedocs.io/", "priority": 3},
            {"name": "Sentry Python", "version": "2.11.0", "url": "https://docs.sentry.io/platforms/python/", "priority": 3},
        ],
        "erp_odoo": [
            {"name": "Odoo", "version": "16.0", "url": "https://www.odoo.com/documentation/16.0/", "priority": 1},
            {"name": "Werkzeug", "version": "2.0.2", "url": "https://werkzeug.palletsprojects.com/", "priority": 3},
            {"name": "Jinja2", "version": "3.1.2", "url": "https://jinja.palletsprojects.com/", "priority": 3},
        ],
    },

    "local_ai": {
        "llm_inference": [
            {"name": "Ollama", "version": "Latest", "url": "https://github.com/ollama/ollama/blob/main/docs/api.md", "priority": 1},
            {"name": "llama.cpp", "version": "Latest", "url": "https://github.com/ggerganov/llama.cpp", "priority": 1},
            {"name": "Vulkan SDK", "version": "Latest", "url": "https://vulkan.lunarg.com/doc/sdk", "priority": 3},
            {"name": "ROCm", "version": "6.2.4", "url": "https://rocm.docs.amd.com/", "priority": 3},
        ],
        "workflow_automation": [
            {"name": "n8n", "version": "1.118.2", "url": "https://docs.n8n.io/", "priority": 1},
            {"name": "Flowise", "version": "Latest", "url": "https://docs.flowiseai.com/", "priority": 2},
        ],
        "vector_databases": [
            {"name": "Qdrant", "version": "1.11.0", "url": "https://qdrant.tech/documentation/", "priority": 1},
            {"name": "Supabase", "version": "Latest", "url": "https://supabase.com/docs", "priority": 1},
            {"name": "pgvector", "version": "Latest", "url": "https://github.com/pgvector/pgvector", "priority": 2},
        ],
        "knowledge_graphs": [
            {"name": "Neo4j", "version": "2025", "url": "https://neo4j.com/docs/", "priority": 2},
        ],
        "observability": [
            {"name": "Langfuse", "version": "3", "url": "https://langfuse.com/docs", "priority": 2},
            {"name": "ClickHouse", "version": "Latest", "url": "https://clickhouse.com/docs/", "priority": 3},
        ],
        "infrastructure": [
            {"name": "Docker Compose", "version": "2+", "url": "https://docs.docker.com/compose/", "priority": 2},
            {"name": "Caddy", "version": "2", "url": "https://caddyserver.com/docs/", "priority": 3},
            {"name": "PostgreSQL", "version": "15.8.1", "url": "https://www.postgresql.org/docs/15/", "priority": 2},
        ],
        "supabase_stack": [
            {"name": "Supabase", "version": "Latest", "url": "https://supabase.com/docs", "priority": 1},
            {"name": "Kong", "version": "2.8.1", "url": "https://docs.konghq.com/", "priority": 3},
            {"name": "PostgREST", "version": "14.1", "url": "https://postgrest.org/", "priority": 2},
            {"name": "GoTrue", "version": "Latest", "url": "https://github.com/supabase/gotrue", "priority": 3},
        ],
        "ui_services": [
            {"name": "Open WebUI", "version": "Latest", "url": "https://docs.openwebui.com/", "priority": 2},
        ],
    },

    "computer_vision": {
        "opencv_foundation": [
            {"name": "OpenCV Docs 4.x", "version": "4.x", "url": "https://docs.opencv.org/4.x/", "priority": 1, "tags": ["opencv", "cv", "foundation"]},
            {"name": "OpenCV Docs Master", "version": "master", "url": "https://docs.opencv.org/master/", "priority": 2, "tags": ["opencv", "cv", "foundation"]},
            {"name": "OpenCV Python", "version": "4.x", "url": "https://docs.opencv.org/master/d6/d00/tutorial_py_root.html", "priority": 1, "tags": ["opencv", "python", "cv"]},
            {"name": "OpenCV.js", "version": "4.x", "url": "https://docs.opencv.org/4.x/d4/da1/tutorial_js_setup.html", "priority": 2, "tags": ["opencv", "javascript", "browser"]},
            {"name": "OpenCV GitHub", "version": "Latest", "url": "https://github.com/opencv/opencv", "priority": 1, "tags": ["opencv", "source"]},
            {"name": "OpenCV Contrib", "version": "Latest", "url": "https://github.com/opencv/opencv_contrib", "priority": 2, "tags": ["opencv", "source"]},
            {"name": "OpenCV Python Package", "version": "Latest", "url": "https://github.com/opencv/opencv-python", "priority": 2, "tags": ["opencv", "python", "package"]},
            {"name": "OpenCV Official Site", "version": "Latest", "url": "https://opencv.org/", "priority": 2, "tags": ["opencv", "homepage"]},
        ],
        "segmentation": [
            {"name": "SAM2", "version": "Latest", "url": "https://github.com/facebookresearch/sam2", "priority": 1, "tags": ["segmentation", "meta", "foundation"]},
            {"name": "SAM3", "version": "Latest", "url": "https://github.com/facebookresearch/sam3", "priority": 1, "tags": ["segmentation", "meta", "foundation"]},
        ],
        "detection": [
            {"name": "YOLOX", "version": "Latest", "url": "https://github.com/Megvii-BaseDetection/YOLOX", "priority": 1, "tags": ["detection", "yolo", "real-time"]},
            {"name": "Detectron2", "version": "Latest", "url": "https://github.com/facebookresearch/detectron2", "priority": 2, "tags": ["detection", "meta", "framework"]},
            {"name": "MMDetection", "version": "Latest", "url": "https://github.com/open-mmlab/mmdetection", "priority": 2, "tags": ["detection", "framework", "openmmlab"]},
        ],
        "tracking": [
            {"name": "ByteTrack", "version": "Latest", "url": "https://github.com/FoundationVision/ByteTrack", "priority": 1, "tags": ["tracking", "mot", "real-time"]},
            {"name": "Norfair", "version": "Latest", "url": "https://github.com/tryolabs/norfair", "priority": 2, "tags": ["tracking", "lightweight"]},
        ],
        "field_registration": [
            {"name": "KpSFR", "version": "Latest", "url": "https://github.com/ericsujw/KpSFR", "priority": 1, "tags": ["field", "homography", "sports"]},
        ],
        "pose_estimation": [
            {"name": "MediaPipe", "version": "Latest", "url": "https://github.com/google-ai-edge/mediapipe", "priority": 1, "tags": ["pose", "google", "edge"]},
            {"name": "MediaPipe Docs", "version": "Latest", "url": "https://ai.google.dev/edge/mediapipe/framework", "priority": 1, "tags": ["pose", "google", "documentation"]},
        ],
        "inference_edge": [
            {"name": "ONNXRuntime", "version": "Latest", "url": "https://github.com/microsoft/onnxruntime", "priority": 1, "tags": ["onnx", "inference", "edge"]},
            {"name": "ONNXRuntime Docs", "version": "Latest", "url": "https://onnxruntime.ai/docs/", "priority": 1, "tags": ["onnx", "inference", "documentation"]},
            {"name": "ONNXRuntime Mobile", "version": "Latest", "url": "https://onnxruntime.ai/docs/get-started/with-mobile.html", "priority": 1, "tags": ["onnx", "mobile", "edge"]},
            {"name": "ONNXRuntime WebGPU", "version": "Latest", "url": "https://onnxruntime.ai/docs/execution-providers/WebGPU-ExecutionProvider.html", "priority": 1, "tags": ["onnx", "webgpu", "browser"]},
        ],
        "utilities": [
            {"name": "Roboflow Supervision", "version": "Latest", "url": "https://github.com/roboflow/supervision", "priority": 2, "tags": ["roboflow", "utilities", "pipeline"]},
            {"name": "Roboflow Notebooks", "version": "Latest", "url": "https://github.com/roboflow/notebooks", "priority": 3, "tags": ["roboflow", "examples", "notebooks"]},
        ],
        "sports_research": [
            {"name": "SoccerNet", "version": "Latest", "url": "https://www.soccer-net.org/", "priority": 2, "tags": ["football", "research", "benchmark"]},
        ],
    },
}

def get_all_libraries():
    """Extract all unique libraries across all projects"""
    all_libs = {}

    for project, categories in LIBRARY_CATALOG.items():
        for category, libraries in categories.items():
            for lib in libraries:
                key = lib["name"]
                if key not in all_libs:
                    all_libs[key] = {
                        "name": lib["name"],
                        "versions": [lib["version"]],
                        "url": lib["url"],
                        "priority": lib["priority"],
                        "projects": [project],
                        "categories": [category],
                        "tags": lib.get("tags", []),
                    }
                else:
                    # Merge information
                    if lib["version"] not in all_libs[key]["versions"]:
                        all_libs[key]["versions"].append(lib["version"])
                    if project not in all_libs[key]["projects"]:
                        all_libs[key]["projects"].append(project)
                    if category not in all_libs[key]["categories"]:
                        all_libs[key]["categories"].append(category)
                    # Merge tags
                    for tag in lib.get("tags", []):
                        if tag not in all_libs[key]["tags"]:
                            all_libs[key]["tags"].append(tag)
                    # Use highest priority
                    all_libs[key]["priority"] = min(all_libs[key]["priority"], lib["priority"])

    return list(all_libs.values())

def get_libraries_by_project(project_name):
    """Get all libraries for a specific project"""
    if project_name not in LIBRARY_CATALOG:
        return []

    libs = []
    for category, libraries in LIBRARY_CATALOG[project_name].items():
        for lib in libraries:
            libs.append({
                **lib,
                "project": project_name,
                "category": category
            })

    return libs

def get_libraries_by_priority(priority: int):
    """Get all libraries with specified priority"""
    all_libs = get_all_libraries()
    return [lib for lib in all_libs if lib["priority"] == priority]

def get_libraries_by_tag(tag: str):
    """Get all libraries with specified tag (e.g., 'azure')"""
    all_libs = get_all_libraries()
    return [lib for lib in all_libs if tag in lib.get("tags", [])]

if __name__ == "__main__":
    # Print statistics
    all_libs = get_all_libraries()
    print(f"Total unique libraries: {len(all_libs)}")
    print(f"\nArchon libraries: {sum(len(cats) for cats in LIBRARY_CATALOG['archon'].values())}")
    print(f"SportERP libraries: {sum(len(cats) for cats in LIBRARY_CATALOG['sporterp'].values())}")
    print(f"Local AI libraries: {sum(len(cats) for cats in LIBRARY_CATALOG['local_ai'].values())}")
    print(f"Computer Vision libraries: {sum(len(cats) for cats in LIBRARY_CATALOG['computer_vision'].values())}")

    # Priority breakdown
    priority_1 = sum(1 for lib in all_libs if lib["priority"] == 1)
    priority_2 = sum(1 for lib in all_libs if lib["priority"] == 2)
    priority_3 = sum(1 for lib in all_libs if lib["priority"] == 3)

    print(f"\nPriority 1 (Critical): {priority_1}")
    print(f"Priority 2 (High): {priority_2}")
    print(f"Priority 3 (Medium): {priority_3}")

    # Azure services
    azure_libs = get_libraries_by_tag("azure")
    print(f"\nAzure services: {len(azure_libs)}")
    for lib in azure_libs:
        print(f"  - {lib['name']} (Priority {lib['priority']})")

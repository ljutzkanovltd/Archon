"""
MCP Client Wrapper Usage Examples

Demonstrates how to use the MCPClient wrapper for robust MCP interactions.

Run with:
    python -m examples.mcp_client_usage
"""

import asyncio
import logging
from src.mcp_server.utils.mcp_client_wrapper import MCPClient, call_mcp_tool, check_mcp_health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def example_context_manager():
    """
    Example 1: Using MCPClient with context manager (recommended).

    The context manager automatically handles:
    - Session initialization
    - Resource cleanup
    - Connection closure
    """
    logger.info("=" * 60)
    logger.info("Example 1: Context Manager Pattern")
    logger.info("=" * 60)

    async with MCPClient() as client:
        # Check server health
        health = await client.health_check()
        logger.info(f"Server health: {health}")

        # List available tools
        tools = await client.list_tools()
        logger.info(f"Available tools: {len(tools.get('tools', []))}")

        # Call a specific tool
        result = await client.call_tool(
            "find_projects",
            arguments={"query": "MCP"}
        )
        logger.info(f"Search result: {result}")


async def example_manual_lifecycle():
    """
    Example 2: Manual session lifecycle management.

    Use this when you need explicit control over session lifecycle.
    """
    logger.info("=" * 60)
    logger.info("Example 2: Manual Lifecycle Management")
    logger.info("=" * 60)

    client = MCPClient()

    try:
        # Initialize session
        init_result = await client.initialize()
        logger.info(f"Session initialized: {init_result}")

        # Make multiple tool calls with same session
        for i in range(3):
            result = await client.call_tool("health_check")
            logger.info(f"Health check {i + 1}: {result}")

    finally:
        # Always close to cleanup resources
        await client.close()


async def example_convenience_functions():
    """
    Example 3: Using convenience functions for one-off calls.

    Best for quick, one-time tool calls where you don't need
    to maintain a persistent session.
    """
    logger.info("=" * 60)
    logger.info("Example 3: Convenience Functions")
    logger.info("=" * 60)

    # Quick health check
    is_healthy = await check_mcp_health()
    logger.info(f"Server healthy: {is_healthy}")

    # One-off tool call
    tasks = await call_mcp_tool(
        "find_tasks",
        arguments={
            "filter_by": "status",
            "filter_value": "todo"
        }
    )
    logger.info(f"Found {len(tasks.get('tasks', []))} tasks")


async def example_error_handling():
    """
    Example 4: Proper error handling patterns.

    Demonstrates how to handle connection errors, session errors,
    and retry logic.
    """
    logger.info("=" * 60)
    logger.info("Example 4: Error Handling")
    logger.info("=" * 60)

    try:
        async with MCPClient(max_retries=5, retry_delay=2.0) as client:
            # This will automatically retry on transient failures
            result = await client.call_tool("find_projects")
            logger.info(f"Result: {result}")

    except Exception as e:
        logger.error(f"Operation failed after retries: {e}")
        # Handle error appropriately (e.g., fallback logic, user notification)


async def example_session_persistence():
    """
    Example 5: Maintaining session across multiple operations.

    Useful for workflows that require multiple related operations
    with consistent session state.
    """
    logger.info("=" * 60)
    logger.info("Example 5: Session Persistence")
    logger.info("=" * 60)

    async with MCPClient() as client:
        # Create a project
        project = await client.call_tool(
            "manage_project",
            arguments={
                "action": "create",
                "title": "Test Project",
                "description": "Created via MCP client wrapper"
            }
        )
        logger.info(f"Created project: {project}")

        project_id = project.get("project", {}).get("id")

        if project_id:
            # Create a task in the same session
            task = await client.call_tool(
                "manage_task",
                arguments={
                    "action": "create",
                    "project_id": project_id,
                    "title": "Test Task",
                    "description": "Task created in same session",
                    "estimated_hours": 1.0
                }
            )
            logger.info(f"Created task: {task}")

            # List tasks for the project
            tasks = await client.call_tool(
                "find_tasks",
                arguments={"project_id": project_id}
            )
            logger.info(f"Project has {len(tasks.get('tasks', []))} tasks")


async def example_custom_configuration():
    """
    Example 6: Custom client configuration.

    Shows how to configure timeout, retries, and client identification.
    """
    logger.info("=" * 60)
    logger.info("Example 6: Custom Configuration")
    logger.info("=" * 60)

    # Custom configuration
    client = MCPClient(
        base_url="http://localhost:8051",
        timeout=60.0,  # 60 second timeout
        max_retries=5,  # 5 retry attempts
        retry_delay=3.0,  # 3 seconds between retries
        client_name="CustomWorkflowClient",
        client_version="2.0.0"
    )

    try:
        await client.initialize()

        result = await client.call_tool("health_check")
        logger.info(f"Custom client result: {result}")

    finally:
        await client.close()


async def main():
    """Run all examples."""
    logger.info("\n" + "=" * 60)
    logger.info("MCP Client Wrapper Usage Examples")
    logger.info("=" * 60 + "\n")

    # Run examples
    await example_context_manager()
    await asyncio.sleep(1)

    await example_manual_lifecycle()
    await asyncio.sleep(1)

    await example_convenience_functions()
    await asyncio.sleep(1)

    await example_error_handling()
    await asyncio.sleep(1)

    # Skip session persistence example if you don't want to create test data
    # await example_session_persistence()

    await example_custom_configuration()

    logger.info("\n" + "=" * 60)
    logger.info("All examples completed!")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

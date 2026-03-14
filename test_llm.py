import asyncio
import os
from engine.groq_client import query_agent, API_KEY, API_URL

async def test():
    print(f"Testing with API URL: {API_URL}")
    try:
        res = await query_agent(
            "You are an AI that assesses policy impacts. Return JSON exactly like: {\"delta\": -0.15, \"confidence\": 0.85, \"reasoning\": \"Transit reduces emissions by 15%.\"}",
            "If we make public transit free, what is the impact on emissions?"
        )
        print("Success!", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())

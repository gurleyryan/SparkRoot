import asyncio
import json
import os
import sys
import structlog
import redis.asyncio as aioredis
from structlog.types import EventDict
from typing import Any
from deckgen import generate_commander_deck
from deck_analysis import analyze_deck_quality
from dotenv import load_dotenv
load_dotenv()


def flush_stdout(_: Any, __: Any, event_dict: EventDict) -> EventDict:
    sys.stdout.flush()
    return event_dict

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
        flush_stdout,  # <-- Add this to flush after every log
    ]
)

logger = structlog.get_logger()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client: aioredis.Redis = aioredis.from_url(REDIS_URL, decode_responses=True) # type: ignore



async def process_job(job_id: str, job_data: dict[str, Any]):
    logger.info(f"Processing job {job_id}")
    try:
        request = job_data["request"]
        # You may want to validate/parse request here
        # For now, assume DeckAnalysisRequest-like dict
        commander_id = request.get("commander_id")
        card_pool = request.get("collection", [])
        bracket = request.get("bracket", 2)
        house_rules = request.get("house_rules", False)
        salt_threshold = request.get("salt_threshold", 0)
        # TODO: fetch commander object from card_pool if needed
        commander = next((c for c in card_pool if c.get("id") == commander_id), None)
        if not commander:
            logger.error(f"Commander with id {commander_id} not found in card pool for job {job_id}")
            await redis_client.set(f"deckjob:{job_id}:result", json.dumps({"success": False, "error": f"Commander with id {commander_id} not found in card pool."}), ex=120)
            await redis_client.set(f"deckjob:{job_id}:status", "failed", ex=120)
            return

        # Run deckgen
        deck_gen = generate_commander_deck(
            commander,
            card_pool,
            bracket=bracket,
            house_rules=house_rules,
            salt_threshold=salt_threshold,
        )
        # If generator, exhaust it to get deck_data and stream progress
        deck_data: dict[str, Any] = {}
        step_logs: list[dict[str, Any]] = []
        if hasattr(deck_gen, '__iter__') and not isinstance(deck_gen, dict):
            # Synchronous generator: stream progress to Redis in real time
            try:
                while True:
                    step = next(deck_gen)
                    try:
                        step_obj = json.loads(step)
                    except Exception:
                        step_obj = {"message": step}
                    if isinstance(step_obj, dict):
                        step_logs.append(step_obj)  # type: ignore
                    await redis_client.rpush(f"deckjob:{job_id}:progress", step) # type: ignore
            except StopIteration as e:
                # The generator's return value is in e.value
                if e.value:
                    try:
                        final_obj = json.loads(e.value)
                        # Remove 'success' key if present
                        if "success" in final_obj:
                            final_obj.pop("success")
                        if "deck" in final_obj:
                            deck_data = final_obj["deck"]
                        else:
                            deck_data = final_obj
                    except Exception:
                        deck_data = {}
        elif isinstance(deck_gen, dict):
            deck_data = deck_gen
        else:
            deck_data = {}

        # Robustly check for 'cards' key before analysis
        if not deck_data or "cards" not in deck_data:
            logger.error(f"Deck generation failed for job {job_id}: No 'cards' key in result.")
            await redis_client.set(f"deckjob:{job_id}:result", json.dumps({"success": False, "error": "Deck generation failed: No 'cards' key in result."}), ex=120)
            await redis_client.set(f"deckjob:{job_id}:status", "failed", ex=120)
            return

        deck_analysis = analyze_deck_quality(deck_data)
        # Save result (do not include 'success' key)
        result: dict[str, Any] = {
            **deck_data,
            "analysis": deck_analysis,
            "bracket": bracket,
            "status": "complete"
        }
        await redis_client.set(f"deckjob:{job_id}:result", json.dumps(result), ex=120)
        await redis_client.set(f"deckjob:{job_id}:status", "complete", ex=120)
        logger.info(f"Job {job_id} complete")
        # Cleanup only the main job key immediately; leave result/status for frontend polling
        await redis_client.delete(f"deckjob:{job_id}")
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        await redis_client.set(f"deckjob:{job_id}:result", json.dumps({"success": False, "error": str(e)}), ex=120)
        await redis_client.set(f"deckjob:{job_id}:status", "failed", ex=120)
        # Cleanup only the main job key immediately; leave result/status for frontend polling
        await redis_client.delete(f"deckjob:{job_id}")

async def worker_loop():
    logger.info("Worker started, polling for jobs...")
    while True:
        # Scan for pending jobs
        keys: list[str] = await redis_client.keys("deckjob:*")  # type: ignore
        for key in keys:
            # Only process job keys matching deckjob:<job_id> (not progress/result/status)
            if not key.startswith("deckjob:") or any(s in key for s in [":progress", ":result", ":status"]):
                continue
            job_id = key.split(":")[1] if ":" in key else key[8:]
            # Check job status before processing
            status_key = f"deckjob:{job_id}:status"
            status = await redis_client.get(status_key)
            if status in ("complete", "failed"):
                logger.info(f"Cleaning up job {job_id}: status is {status}")
                await redis_client.delete(f"deckjob:{job_id}")
                await redis_client.delete(f"deckjob:{job_id}:result")
                await redis_client.delete(f"deckjob:{job_id}:status")
                continue
            # Load job data
            job_data_raw = await redis_client.get(key)
            if not job_data_raw:
                logger.warning(f"No job data found for job {job_id}")
                continue
            try:
                job_data = json.loads(job_data_raw)
            except Exception as e:
                logger.error(f"Failed to parse job data for job {job_id}: {e}")
                continue
            # Mark job as processing
            await redis_client.set(status_key, "processing", ex=120)
            await process_job(job_id, job_data)
        await asyncio.sleep(2)  # Poll interval

if __name__ == "__main__":
    asyncio.run(worker_loop())

"""Shared OpenAI structured-output helper."""
import json
import os
from pydantic import BaseModel


async def call_json(model_cls: type[BaseModel], system: str, user_json: dict, max_retries: int = 1):
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    last_error = None
    for _ in range(max_retries + 1):
        try:
            response = await client.responses.parse(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                input=[{"role": "system", "content": system},
                       {"role": "user", "content": json.dumps(user_json, ensure_ascii=False)}],
                text_format=model_cls,
            )
            parsed = response.output_parsed
            if parsed is None:
                raise ValueError("Model returned no structured output")
            return parsed
        except Exception as exc:
            last_error = exc
    raise ValueError("Structured output failed") from last_error

"""Application settings loaded from environment variables.

Uses pydantic-settings to validate and type-check env vars at startup.
If OPENAI_API_KEY is missing, the app fails fast with a clear error
rather than silently breaking on the first LLM call.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

"""Application settings loaded from environment variables.

Uses pydantic-settings to validate and type-check env vars at startup.
If OPENAI_API_KEY is missing, the app fails fast with a clear error
rather than silently breaking on the first LLM call.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_extract_model: str = ""
    frontend_url: str = "http://localhost:5173"

    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    langgraph_memory_fallback: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def extract_model(self) -> str:
        return (self.openai_extract_model or "").strip() or self.openai_model

    @property
    def use_postgres(self) -> bool:
        return bool(self.database_url.strip())


settings = Settings()

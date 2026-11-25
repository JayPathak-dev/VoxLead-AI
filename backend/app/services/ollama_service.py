"""Local Ollama HTTP client service with connection reuse, health checks, and retries."""

import time
from typing import Any, Optional
import httpx

from app.config import get_settings


class OllamaError(Exception):
    """Raised when Ollama is unreachable or the requested model is unavailable."""

    def __init__(self, message: str, code: str = "ollama_unavailable") -> None:
        super().__init__(message)
        self.code = code


class OllamaService:
    """Manages persistent HTTP communication with the Dockerized Ollama server."""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        settings = get_settings()
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.ollama_base_url.rstrip("/"),
                timeout=httpx.Timeout(settings.ollama_timeout_seconds, connect=5.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
        return self._client

    async def close(self) -> None:
        """Close persistent HTTP client on shutdown."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    @staticmethod
    def _model_matches(installed_names: list[str], target_model: str) -> bool:
        target = target_model.strip().lower()
        for name in installed_names:
            norm = name.strip().lower()
            if norm == target:
                return True
            if ":" not in target and norm == f"{target}:latest":
                return True
            if norm.startswith(f"{target}-") or norm == f"{target}:latest":
                return True
        return False

    async def check_health(self) -> dict[str, Any]:
        """Verify Ollama server connectivity and configured model availability."""
        settings = get_settings()
        target_model = settings.ollama_model
        install_cmd = (
            "docker compose up -d ollama && "
            f"docker exec -it voxlead-ollama ollama pull {target_model}"
        )
        try:
            client = self._get_client()
            resp = await client.get("/api/tags", timeout=5.0)
            resp.raise_for_status()
            payload = resp.json()
            models = [m.get("name", "") for m in payload.get("models", []) if isinstance(m, dict)]
            available = self._model_matches(models, target_model)
            return {
                "ollama_status": "connected" if available else "model_missing",
                "model_name": target_model,
                "model_available": available,
                "installed_models": models,
                "error_detail": None
                if available
                else f"Model '{target_model}' was not found in the Ollama container.",
                "install_instructions": None if available else install_cmd,
            }
        except httpx.ConnectError:
            return {
                "ollama_status": "disconnected",
                "model_name": target_model,
                "model_available": False,
                "installed_models": [],
                "error_detail": (
                    f"Cannot connect to Ollama at {settings.ollama_base_url}. "
                    "Ensure the Docker container 'voxlead-ollama' is running."
                ),
                "install_instructions": install_cmd,
            }
        except httpx.TimeoutException:
            return {
                "ollama_status": "disconnected",
                "model_name": target_model,
                "model_available": False,
                "installed_models": [],
                "error_detail": f"Timed out connecting to Ollama at {settings.ollama_base_url}.",
                "install_instructions": install_cmd,
            }
        except Exception as exc:
            return {
                "ollama_status": "disconnected",
                "model_name": target_model,
                "model_available": False,
                "installed_models": [],
                "error_detail": str(exc),
                "install_instructions": install_cmd,
            }

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.4,
        format_json: bool = False,
        num_predict: int = 350,
    ) -> dict[str, Any]:
        """Send a non-streaming chat completion request to local Ollama with limited retry."""
        settings = get_settings()
        body: dict[str, Any] = {
            "model": settings.ollama_model,
            "messages": messages,
            "stream": False,
            "keep_alive": "15m",
            "options": {
                "temperature": temperature,
                "num_ctx": 4096,
                "num_predict": num_predict,
            },
        }
        if format_json:
            body["format"] = "json"

        client = self._get_client()
        last_exc: Optional[Exception] = None
        started = time.perf_counter()

        for attempt in range(2):
            try:
                resp = await client.post("/api/chat", json=body)
                if resp.status_code == 404:
                    raise OllamaError(
                        f"Model '{settings.ollama_model}' is not installed in Ollama. "
                        f"Run: docker exec -it voxlead-ollama ollama pull {settings.ollama_model}",
                        code="model_missing",
                    )
                resp.raise_for_status()
                data = resp.json()
                content = (data.get("message") or {}).get("content", "").strip()
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                return {
                    "content": content,
                    "latency_ms": elapsed_ms,
                    "eval_count": data.get("eval_count"),
                    "prompt_eval_count": data.get("prompt_eval_count"),
                }
            except OllamaError:
                raise
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
                last_exc = exc
                if attempt == 0:
                    continue
                raise OllamaError(
                    f"Ollama inference failed after retry: {exc}",
                    code="ollama_unavailable",
                ) from exc
            except httpx.HTTPStatusError as exc:
                raise OllamaError(
                    f"Ollama HTTP {exc.response.status_code}: {exc.response.text[:300]}",
                    code="ollama_error",
                ) from exc

        raise OllamaError(f"Ollama unavailable: {last_exc}", code="ollama_unavailable")

    async def warm_up(self) -> bool:
        """Keep the model loaded in Ollama memory on startup if available."""
        health = await self.check_health()
        if not health.get("model_available"):
            return False
        try:
            await self.chat(
                messages=[{"role": "user", "content": "Reply with OK."}],
                temperature=0.0,
                num_predict=8,
            )
            return True
        except Exception:
            return False


ollama_service = OllamaService()

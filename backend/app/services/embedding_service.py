"""Singleton SentenceTransformer embedding service using all-MiniLM-L6-v2."""

import threading
from typing import Optional
import numpy as np

from app.config import get_settings


class EmbeddingService:
    """Loads and caches the local sentence-transformer model once per process."""

    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()
        self._status = "uninitialized"
        self._error: Optional[str] = None

    @property
    def status(self) -> str:
        return self._status

    @property
    def error(self) -> Optional[str]:
        return self._error

    def load_model(self):
        """Load SentenceTransformer once in a thread-safe manner."""
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            settings = get_settings()
            self._status = "loading"
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(settings.embedding_model)
                self._status = "ready"
                self._error = None
                return self._model
            except Exception as exc:
                self._status = "error"
                self._error = str(exc)
                raise

    def encode(self, texts: list[str]) -> np.ndarray:
        """Encode a list of strings into L2-normalized float32 embeddings."""
        if not texts:
            return np.empty((0, 384), dtype=np.float32)
        model = self.load_model()
        vectors = model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)


embedding_service = EmbeddingService()

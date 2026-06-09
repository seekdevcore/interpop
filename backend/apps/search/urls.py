"""URL routing do app de busca (ADR-023).

Montado sob ``/api/v1/search/`` em ``config/urls.py``:

    /api/v1/search/articles/   → SearchArticlesView

Futuros endpoints encaixam aqui: ``/search/comments/``, ``/search/suggest/``.
"""
from __future__ import annotations

from django.urls import path

from .views import SearchArticlesView


app_name = 'search'

urlpatterns = [
    path('articles/', SearchArticlesView.as_view(), name='articles'),
]

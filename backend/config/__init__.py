"""
Garante que o Celery app seja importado quando Django sobe — pré-requisito
para que `@shared_task` em apps/<app>/tasks.py se vinculem ao app correto.

Sem este import, @shared_task em modo lazy registra tasks num app default
que nunca executa.
"""
from .celery import app as celery_app

__all__ = ('celery_app',)

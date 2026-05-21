"""
Celery app instance + autodiscovery de tasks.

Padrão Django + Celery 5.x: arquivo no mesmo dir do settings, importado
pelo `__init__.py` do pacote config pra que `from celery import current_app`
funcione em qualquer lugar.

Tasks vivem em `apps/<app>/tasks.py` — autodiscover_tasks() encontra
automaticamente por convenção.

Decisão A20 do Improvement-system §11.2 (Celery, não ThreadPool).
ADR-009 hard-gate: nenhum email síncrono em produção.
"""
from __future__ import annotations

import os

from celery import Celery

# Default usa development; production override no deploy via env.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('interpop')

# Lê config Celery do Django settings (qualquer chave começando com CELERY_).
# namespace='CELERY' significa: settings 'CELERY_BROKER_URL', etc. viram
# `app.conf.broker_url` etc.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Cada apps/<app>/tasks.py registrado automaticamente.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Sanity task — `celery -A config call config.celery.debug_task`
    confirma que worker está vivo. Não usar em código de prod."""
    print(f'Request: {self.request!r}')

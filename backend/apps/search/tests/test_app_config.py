"""Testes do bootstrap do app ``apps.search`` (Task T30.1.1).

Asserções TDD para garantir que:
    - O app está registrado em ``INSTALLED_APPS``.
    - ``AppConfig`` foi carregado com nome correto.
    - Os módulos esqueleto (models, services, dto, signals) importam sem erro.
    - Os models ``SearchIndex`` e ``SearchLog`` têm ``Meta.managed = False``
      (a tabela é controlada por SQL puro nas migrations — ADR-018, ADR-019,
      ADR-030-DB).
"""
from __future__ import annotations

import importlib

from django.apps import apps


def test_search_app_registered() -> None:
    """T30.1.1 — apps.search deve aparecer em INSTALLED_APPS após registro."""
    assert apps.is_installed('apps.search'), (
        'apps.search precisa estar registrado em INSTALLED_APPS '
        '(config/settings/base.py LOCAL_APPS).'
    )


def test_search_appconfig_loaded() -> None:
    """T30.1.1 — SearchConfig deve carregar com nome e label corretos."""
    app_config = apps.get_app_config('search')
    assert app_config.name == 'apps.search'
    assert app_config.verbose_name == 'Busca editorial'


def test_skeleton_modules_importable() -> None:
    """T30.1.2 — services, dto, signals devem importar sem erro (mesmo stubs)."""
    for mod in ('services', 'dto', 'signals'):
        importlib.import_module(f'apps.search.{mod}')


def test_search_index_model_is_unmanaged() -> None:
    """ADR-018 — schema é controlado por SQL puro; ORM não pode achar que é dono."""
    from apps.search.models import SearchIndex

    assert SearchIndex._meta.managed is False, (
        'SearchIndex.Meta.managed deve ser False — schema é controlado por '
        'RunSQL (extensions, configuration, trigger, GIN). Ver ADR-018/019.'
    )
    assert SearchIndex._meta.db_table == 'search_index'


def test_search_log_model_is_unmanaged() -> None:
    """SearchLog também é criado por RunSQL na migration 0001."""
    from apps.search.models import SearchLog

    assert SearchLog._meta.managed is False
    assert SearchLog._meta.db_table == 'search_log'


def test_search_index_author_id_is_uuid() -> None:
    """Bug 1 do specialist DB — User.id é UUID, não BIGINT.

    DESIGN §2.2 corrige author_id BIGINT → UUID. Quebrar este test = regressão.
    """
    from django.db import models as dj_models

    from apps.search.models import SearchIndex

    author_field = SearchIndex._meta.get_field('author_id')
    assert isinstance(author_field, dj_models.UUIDField), (
        f'author_id deveria ser UUIDField (User.id é UUID), '
        f'mas é {type(author_field).__name__}.'
    )


def test_search_index_category_id_is_bigint_nullable() -> None:
    """category_id continua BIGINT (Category usa BigAutoField padrão) e é NULL-able."""
    from django.db import models as dj_models

    from apps.search.models import SearchIndex

    cat_field = SearchIndex._meta.get_field('category_id')
    assert isinstance(cat_field, dj_models.BigIntegerField)
    assert cat_field.null is True

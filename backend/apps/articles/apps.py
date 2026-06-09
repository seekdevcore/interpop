from django.apps import AppConfig


class ArticlesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.articles'
    verbose_name = 'Artigos'

    def ready(self) -> None:
        # Wire up signals that auto-notify newsletter subscribers
        # when an article is published.
        from . import signals  # noqa: F401

        # Registra o conversor de URL 'uslug' (slug unicode) uma única vez no
        # boot do app. Antes articles/urls.py e comments/urls.py registravam
        # cada um → 2ª chamada disparava RemovedInDjango60Warning.
        from . import converters  # noqa: F401

from django.apps import AppConfig


class ModerationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.moderation'
    verbose_name = 'Moderação'

    def ready(self) -> None:
        # Email aos admins quando nova BanRequest entra em PENDING.
        from . import signals  # noqa: F401

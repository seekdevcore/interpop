from django.apps import AppConfig


class SearchConfig(AppConfig):
    """Configuração do app de busca editorial.

    ``default_auto_field`` segue o padrão do projeto (BigAutoField), embora
    ``SearchIndex`` use chave primária composta por ``article_id UUID`` (ver
    migration ``0001_initial``). A escolha de BigAutoField é apenas o default
    para qualquer model auxiliar que venha a surgir (ex.: ``SearchLog``).
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.search'
    verbose_name = 'Busca editorial'

    def ready(self) -> None:
        # Importa signals para registrá-los no boot do app.
        # NOTA: o signal só faz invalidação de cache Redis. A sincronia
        # Article → SearchIndex é feita por TRIGGER POSTGRES (ADR-018).
        from . import signals  # noqa: F401

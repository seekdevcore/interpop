"""apps.search — Postgres FTS read-projection for the editorial search.

Bounded context (ADR-015): owns SearchIndex (read-projection of Article) and
SearchService. SearchIndex is kept in sync with Article via Postgres trigger
(fonte de verdade — ADR-018); the Django signal in :mod:`apps.search.signals`
only invalidates the Redis cache.
"""

default_app_config = 'apps.search.apps.SearchConfig'

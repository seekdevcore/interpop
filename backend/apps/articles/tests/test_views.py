"""
Testes E2E do CRUD de Article + permissões + C4 (view_count rate-limit) +
C2 (signal de email único).

Cobertura prioritária:
- IsPublisherOrReadOnly: leitor anon pode GET; criação requer publisher
  (admin/dev/editor); reader autenticado é negado em POST.
- Visibilidade: anon vê só `status=published`; editorial vê drafts.
- Edição/exclusão: dono OU admin (IsOwnerOrAdmin).
- C4 regression: view_count NÃO dobra com 2 POSTs do mesmo IP em <5min.
- C2 regression: publish dispara EXATAMENTE 1 chamada a
  _dispatch_article_notification_sync (não 2 — o signal de newsletter foi
  removido em 1d7d3eb).
"""
from __future__ import annotations

import pytest
from django.core.cache import cache
from unittest.mock import patch

from apps.articles.models import Article, Category


ARTICLES_URL = '/api/v1/articles/'  # ADR-010 aplicado


# ── Fixtures locais ───────────────────────────────────────────────────────────

@pytest.fixture
def category(db):
    """get_or_create porque data migration pode já ter populado as
    categorias canônicas (Cinema, Música, etc.)."""
    obj, _ = Category.objects.get_or_create(
        slug='test-cinema', defaults={'name': 'Test Cinema'},
    )
    return obj


@pytest.fixture
def make_article(db, category):
    """Factory inline pra evitar setup factory_boy só por isso. Retorna
    callable pra criar Article com defaults razoáveis."""
    def _make(author, status=Article.Status.PUBLISHED, title='Test Article', **kw):
        return Article.objects.create(
            author=author,
            category=category,
            title=title,
            slug=kw.pop('slug', None) or f"{title.lower().replace(' ', '-')}-{author.pk.hex[:6]}",
            excerpt=kw.pop('excerpt', 'A short excerpt for testing purposes.'),
            body=kw.pop('body', 'Body content used in tests, long enough to be plausible.'),
            status=status,
            **kw,
        )
    return _make


@pytest.fixture
def tiny_image():
    """SimpleUploadedFile com PNG 1x1 válido — ImageField (Pillow) exige
    imagem real, não bytes arbitrários. Usado nos testes de create que agora
    exigem cover_image obrigatória."""
    from django.core.files.uploadedfile import SimpleUploadedFile
    import io
    from PIL import Image

    buf = io.BytesIO()
    Image.new('RGB', (16, 9), color=(20, 20, 76)).save(buf, format='PNG')
    return SimpleUploadedFile('cover.png', buf.getvalue(), content_type='image/png')


@pytest.fixture(autouse=True)
def _clear_cache():
    """View_count usa cache.add — limpa entre testes pra evitar contaminação."""
    cache.clear()
    yield
    cache.clear()


# ── List view (anon + authed) ─────────────────────────────────────────────────

def test_list_articles_anon_returns_only_published(make_article, reader_user, editor_user, client):
    make_article(editor_user, status='published', title='Pub 1')
    make_article(editor_user, status='draft',     title='Draft 1')

    resp = client.get(ARTICLES_URL)
    assert resp.status_code == 200
    titles = [a['title'] for a in resp.json()['results']]
    assert 'Pub 1' in titles
    assert 'Draft 1' not in titles


def test_list_articles_editor_sees_drafts(
    make_article, editor_user, authed_client_factory,
):
    make_article(editor_user, status='published', title='Pub')
    make_article(editor_user, status='draft',     title='Draft')

    client = authed_client_factory(editor_user)
    resp = client.get(ARTICLES_URL)
    titles = [a['title'] for a in resp.json()['results']]
    assert 'Pub' in titles and 'Draft' in titles


def test_list_articles_reader_does_not_see_drafts(
    make_article, editor_user, reader_user, authed_client_factory,
):
    """Reader autenticado NÃO é publisher → continua sem ver drafts."""
    make_article(editor_user, status='draft', title='Draft Only')

    client = authed_client_factory(reader_user)
    resp = client.get(ARTICLES_URL)
    assert 'Draft Only' not in [a['title'] for a in resp.json()['results']]


# ── Create (POST) — permissions matrix ────────────────────────────────────────

@pytest.mark.parametrize('fixture_name, expected_status', [
    (None,           401),   # anon
    ('reader_user',  403),   # autenticado mas não publisher
    ('editor_user',  201),   # publisher
    ('admin_user',   201),
    ('dev_user',     201),
])
def test_create_article_permission_matrix(
    request, category, api_client, authed_client_factory,
    tiny_image, fixture_name, expected_status,
):
    if fixture_name:
        user = request.getfixturevalue(fixture_name)
        client = authed_client_factory(user)
    else:
        client = api_client  # anon

    resp = client.post(ARTICLES_URL, data={
        'title': 'New Article',
        'excerpt': 'An excerpt long enough.',
        'body': 'A reasonably sized body for the test to pass any min-length validation.',
        'category_id': category.id,
        'status': 'draft',
        'cover_caption': 'Foto: Agência Teste',  # agora obrigatória
        'cover_image': tiny_image,               # agora obrigatória no create
    }, format='multipart')
    assert resp.status_code == expected_status, (
        f'{fixture_name or "anon"} → expected {expected_status}, got {resp.status_code}: '
        f'{resp.content[:200]}'
    )


# ── Validação obrigatória: cover_caption + cover_image (create) ───────────────

def test_create_article_requires_cover_caption(
    category, editor_user, authed_client_factory, tiny_image,
):
    """Legenda da capa é obrigatória na criação (padrão G1/Folha — crédito
    da foto). POST sem cover_caption → 400."""
    client = authed_client_factory(editor_user)
    resp = client.post(ARTICLES_URL, data={
        'title': 'Sem legenda',
        'excerpt': 'Excerpt.',
        'body': 'Body suficiente para passar validação.',
        'category_id': category.id,
        'status': 'draft',
        'cover_image': tiny_image,
        # cover_caption ausente
    }, format='multipart')
    assert resp.status_code == 400
    assert 'cover_caption' in resp.json()


def test_create_article_rejects_blank_cover_caption(
    category, editor_user, authed_client_factory, tiny_image,
):
    """Legenda em branco (string vazia) também é rejeitada — não basta o
    campo existir, precisa ter conteúdo."""
    client = authed_client_factory(editor_user)
    resp = client.post(ARTICLES_URL, data={
        'title': 'Legenda vazia',
        'excerpt': 'Excerpt.',
        'body': 'Body suficiente para passar validação.',
        'category_id': category.id,
        'status': 'draft',
        'cover_caption': '   ',  # só espaços
        'cover_image': tiny_image,
    }, format='multipart')
    assert resp.status_code == 400
    assert 'cover_caption' in resp.json()


def test_create_article_requires_cover_image(
    category, editor_user, authed_client_factory,
):
    """Imagem de capa obrigatória na criação — legenda sem imagem é
    incoerente. POST sem cover_image → 400."""
    client = authed_client_factory(editor_user)
    resp = client.post(ARTICLES_URL, data={
        'title': 'Sem capa',
        'excerpt': 'Excerpt.',
        'body': 'Body suficiente para passar validação.',
        'category_id': category.id,
        'status': 'draft',
        'cover_caption': 'Foto: Agência',
        # cover_image ausente
    }, format='multipart')
    assert resp.status_code == 400
    assert 'cover_image' in resp.json()


def test_update_article_does_not_require_cover_image_resend(
    make_article, editor_user, authed_client_factory,
):
    """REGRESSÃO: editar artigo existente NÃO deve exigir reenvio da imagem
    (a capa já existe). PATCH só do título deve passar."""
    art = make_article(editor_user, title='Para editar', cover_caption='Foto: X')
    client = authed_client_factory(editor_user)
    resp = client.patch(
        f'/api/v1/articles/{art.slug}/',
        data={'title': 'Título editado'},
        format='multipart',
    )
    assert resp.status_code == 200, resp.content[:200]


# ── is_featured: destaque único ───────────────────────────────────────────────

def test_marking_article_featured_unsets_previous(make_article, editor_user):
    """Padrão NYT/Substack — só 1 hero. Marcar um novo artigo como featured
    desmarca o anterior automaticamente (model.save)."""
    first = make_article(editor_user, title='Primeiro destaque', is_featured=True)
    assert first.is_featured is True

    second = make_article(editor_user, title='Segundo destaque', is_featured=True)

    first.refresh_from_db()
    assert first.is_featured is False, 'destaque antigo deveria ter sido desmarcado'
    assert second.is_featured is True


def test_only_one_featured_after_multiple_marks(make_article, editor_user):
    """Invariante dura: nunca mais de 1 featured no banco, mesmo após N marcações."""
    for i in range(5):
        make_article(editor_user, title=f'Art {i}', is_featured=True)
    assert Article.objects.filter(is_featured=True).count() == 1


# ── Update + Delete (object-level: dono ou admin) ─────────────────────────────

def test_editor_can_update_own_article(
    make_article, editor_user, authed_client_factory,
):
    art = make_article(editor_user, title='Mine')
    client = authed_client_factory(editor_user)
    resp = client.patch(
        f'/api/v1/articles/{art.slug}/',
        data={'title': 'Mine Updated'},
        format='json',
    )
    assert resp.status_code == 200
    art.refresh_from_db()
    assert art.title == 'Mine Updated'


def test_editor_cannot_update_other_editors_article(
    make_article, editor_user, db, authed_client_factory,
):
    """SEGURANÇA: Editor B NÃO pode editar artigo de Editor A — só dono ou
    admin/dev. Antes, IsPublisherOrReadOnly só restringia a nível de view
    (qualquer publisher fazia PATCH) e a proteção owner-only existia APENAS
    no frontend — trivial de burlar via curl. Fix: IsOwnerOrAdmin no
    ArticleDetailView (object-level). Este teste é a regression do escalonamento."""
    from apps.users.models import User
    other_editor = User.objects.create_user(
        username='outro.editor', email='outro@interpop.test',
        password='SenhaForte!2026', first_name='Outro', last_name='Editor',
        role=User.Role.EDITOR,
    )
    art = make_article(other_editor, title='Not Mine')

    client = authed_client_factory(editor_user)
    resp = client.patch(
        f'/api/v1/articles/{art.slug}/',
        data={'title': 'Edit by other editor'},
        format='json',
    )
    assert resp.status_code == 403, (
        'ESCALONAMENTO: editor conseguiu editar artigo de outro editor. '
        'IsOwnerOrAdmin deveria bloquear (403).'
    )
    art.refresh_from_db()
    assert art.title == 'Not Mine', 'título não deveria ter mudado'


def test_editor_cannot_delete_other_editors_article(
    make_article, editor_user, db, authed_client_factory,
):
    """Mesma proteção no DELETE — editor não apaga artigo alheio."""
    from apps.users.models import User
    other = User.objects.create_user(
        username='outro2.editor', email='outro2@interpop.test',
        password='SenhaForte!2026', first_name='Outro2', last_name='Editor',
        role=User.Role.EDITOR,
    )
    art = make_article(other, title='Keep Mine')
    client = authed_client_factory(editor_user)
    resp = client.delete(f'/api/v1/articles/{art.slug}/')
    assert resp.status_code == 403
    assert Article.objects.filter(pk=art.pk).exists()


def test_admin_can_update_any_article(
    make_article, editor_user, admin_user, authed_client_factory,
):
    art = make_article(editor_user, title='Editor Article')
    client = authed_client_factory(admin_user)
    resp = client.patch(
        f'/api/v1/articles/{art.slug}/',
        data={'title': 'Admin Edit'},
        format='json',
    )
    assert resp.status_code == 200


# ── C4 regression: view_count rate-limit por (slug, IP) ───────────────────────

def test_view_count_incremented_once_per_5min_window(
    make_article, editor_user, client,
):
    """C4 regression (e49ea6a): mesmo IP batendo 2x no /view/ em <5min
    incrementa view_count EXATAMENTE 1x. Sem o cache bucket, qualquer
    anon poderia inflar contador em loop."""
    art = make_article(editor_user, status='published', title='Viewed')
    assert art.view_count == 0

    url = f'/api/v1/articles/{art.slug}/view/'
    r1 = client.post(url)
    r2 = client.post(url)
    r3 = client.post(url)

    assert r1.status_code == 204
    assert r2.status_code == 204
    assert r3.status_code == 204

    art.refresh_from_db()
    assert art.view_count == 1, (
        f'C4 REGRESSION: 3 POSTs no /view/ do mesmo IP em <5min '
        f'incrementaram view_count em {art.view_count} (esperado 1). '
        f'Verificar ArticleViewCountView em apps/articles/views.py.'
    )


def test_view_count_different_slugs_independent(
    make_article, editor_user, client,
):
    """Bucket é por (slug, IP). Slugs diferentes contam separado."""
    a = make_article(editor_user, title='Article A', slug='article-a')
    b = make_article(editor_user, title='Article B', slug='article-b')

    client.post(f'/api/v1/articles/{a.slug}/view/')
    client.post(f'/api/v1/articles/{b.slug}/view/')

    a.refresh_from_db()
    b.refresh_from_db()
    assert a.view_count == 1
    assert b.view_count == 1


def test_view_count_unpublished_article_not_incremented(
    make_article, editor_user, client,
):
    """Draft não conta view — só published (filtro no .update())."""
    art = make_article(editor_user, status='draft', title='Draft')
    client.post(f'/api/v1/articles/{art.slug}/view/')
    art.refresh_from_db()
    assert art.view_count == 0


# ── C2 regression: 1 task de email por publish, não 2 ────────────────────────

def test_article_publish_triggers_send_article_notification_once(
    make_article, editor_user,
):
    """C2 regression (1d7d3eb): antes do delete de apps/newsletter/signals.py,
    publicar disparava 2 emails (signal pre_save em newsletter + signal
    post_save em articles). Agora deve ser EXATAMENTE 1 chamada a
    _dispatch_article_notification_sync (a task wrapper síncrona).
    Estratégia: criar draft, depois transição draft→published, contar
    chamadas mockadas ao send."""
    with patch('apps.newsletter.services._dispatch_article_notification_sync') as mock_send:
        mock_send.return_value = (0, 0)
        art = make_article(editor_user, status='draft', title='To Publish')
        # Transition: draft → published
        art.status = Article.Status.PUBLISHED
        art.save()

        assert mock_send.call_count == 1, (
            f'C2 REGRESSION: send_article_notification chamado '
            f'{mock_send.call_count} vezes (esperado 1). Verificar se '
            f'apps/newsletter/signals.py voltou a existir junto com '
            f'apps/articles/signals.py — só este último deve permanecer.'
        )


def test_draft_save_does_not_trigger_notification(
    make_article, editor_user,
):
    """Salvar draft sem transição não dispara notificação."""
    with patch('apps.newsletter.services._dispatch_article_notification_sync') as mock_send:
        art = make_article(editor_user, status='draft', title='Draft Stay')
        art.body = 'Updated body still draft'
        art.save()
        assert mock_send.call_count == 0

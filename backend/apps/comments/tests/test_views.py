"""
Testes E2E do app comments — CRUD via API + permissões + edge cases.

Cobertura prioritária (D1 do reorganization-proposal):
- GET listagem: anônimo OK, somente artigos publicados, soft-deleted oculto.
- POST top-level: requer auth, bloqueia banned, recusa em draft article.
- POST reply: valida parent_id pertence ao mesmo artigo.
- DELETE: soft-delete (não físico), respeita IsOwnerOrAdmin.
- LIKE toggle: idempotente por user, contador correto, unique constraint.

Regressões previnidas:
- Top-level com parent_id de outro artigo = 400 (não 500 nem leak).
- Banned user com cookie válido = 403 (defesa em profundidade da S8 IsNotBanned).
- Like duplicado pelo mesmo user = unlike (toggle), não erro 409.
"""
from __future__ import annotations

import pytest

from apps.articles.models import Article
from apps.comments.models import Comment, CommentLike


# Endpoint paths (ADR-010: /api/v1/ prefix)
def _comments_url(slug: str) -> str:
    return f'/api/v1/articles/{slug}/comments/'


def _comment_detail_url(pk) -> str:
    return f'/api/v1/comments/{pk}/'


def _like_url(pk) -> str:
    return f'/api/v1/comments/{pk}/like/'


# ── GET listagem (anon + authed) ─────────────────────────────────────────────


def test_list_comments_anon_returns_empty_when_none(article, client):
    resp = client.get(_comments_url(article.slug))
    assert resp.status_code == 200
    assert resp.json()['results'] == []


def test_list_comments_returns_top_level_only_with_replies_prefetched(
    article, reader_user, authed_client_factory,
):
    """API retorna comentários top-level (parent=None) com replies prefetchadas
    embutidas, NÃO replies em flat list — evita N+1 no frontend."""
    api = authed_client_factory(reader_user)
    top = Comment.objects.create(article=article, author=reader_user, content='Top-level')
    Comment.objects.create(article=article, author=reader_user, content='Reply 1', parent=top)
    Comment.objects.create(article=article, author=reader_user, content='Reply 2', parent=top)

    resp = api.get(_comments_url(article.slug))
    assert resp.status_code == 200
    results = resp.json()['results']
    # Só 1 top-level
    assert len(results) == 1
    assert results[0]['content'] == 'Top-level'
    # 2 replies vêm dentro dele
    assert results[0]['replies_count'] == 2
    assert len(results[0]['replies']) == 2


def test_list_comments_hides_soft_deleted(article, reader_user, client):
    """Soft-deleted comments NÃO aparecem na listagem pública.
    is_deleted=True é tombstone — preserva audit trail no DB."""
    Comment.objects.create(article=article, author=reader_user, content='Vivo')
    Comment.objects.create(
        article=article, author=reader_user, content='Morto', is_deleted=True,
    )
    resp = client.get(_comments_url(article.slug))
    assert resp.status_code == 200
    contents = [c['content'] for c in resp.json()['results']]
    assert 'Vivo' in contents
    assert 'Morto' not in contents


def test_list_comments_404_for_draft_article(make_article, editor_user, client):
    """Artigo em draft não tem comments públicos. View filtra status='published'."""
    draft = make_article(editor_user, status=Article.Status.DRAFT, title='Draft Article')
    resp = client.get(_comments_url(draft.slug))
    assert resp.status_code == 404


def test_list_comments_is_liked_annotated_for_authed_user(
    article, reader_user, authed_client_factory,
):
    """Reader autenticado vê is_liked=True nos comentários que curtiu, False nos outros."""
    c1 = Comment.objects.create(article=article, author=reader_user, content='Comment 1')
    c2 = Comment.objects.create(article=article, author=reader_user, content='Comment 2')
    CommentLike.objects.create(comment=c1, user=reader_user)

    api = authed_client_factory(reader_user)
    resp = api.get(_comments_url(article.slug))
    by_content = {c['content']: c for c in resp.json()['results']}
    assert by_content['Comment 1']['is_liked'] is True
    assert by_content['Comment 2']['is_liked'] is False


# ── POST create top-level ────────────────────────────────────────────────────


def test_create_comment_anon_returns_401(article, client):
    resp = client.post(_comments_url(article.slug), {'content': 'X'}, content_type='application/json')
    assert resp.status_code == 401


def test_create_comment_authed_creates_and_returns_201(
    article, reader_user, authed_client_factory,
):
    api = authed_client_factory(reader_user)
    resp = api.post(_comments_url(article.slug), {'content': 'Hello'}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['content'] == 'Hello'
    # Foi salvo
    assert Comment.objects.filter(article=article, author=reader_user).count() == 1


def test_create_comment_banned_user_returns_403(
    article, reader_user, authed_client_factory,
):
    """S8 defense in depth: banned user com cookie ainda válido NÃO pode comentar."""
    reader_user.is_banned = True
    reader_user.save()
    api = authed_client_factory(reader_user)
    resp = api.post(_comments_url(article.slug), {'content': 'spam'}, format='json')
    assert resp.status_code == 403


def test_create_comment_on_draft_article_returns_404(
    make_article, editor_user, reader_user, authed_client_factory,
):
    """Não dá pra comentar em draft. View resolve article com status=published."""
    draft = make_article(editor_user, status=Article.Status.DRAFT, title='Hidden Draft')
    api = authed_client_factory(reader_user)
    resp = api.post(_comments_url(draft.slug), {'content': 'X'}, format='json')
    assert resp.status_code == 404


def test_create_comment_validates_content_max_length(
    article, reader_user, authed_client_factory,
):
    api = authed_client_factory(reader_user)
    resp = api.post(
        _comments_url(article.slug),
        {'content': 'x' * 2001},  # max_length=2000
        format='json',
    )
    assert resp.status_code == 400


# ── POST reply ───────────────────────────────────────────────────────────────


def test_create_reply_with_valid_parent_id_succeeds(
    article, reader_user, authed_client_factory,
):
    parent = Comment.objects.create(article=article, author=reader_user, content='Top')
    api = authed_client_factory(reader_user)
    resp = api.post(
        _comments_url(article.slug),
        {'content': 'Reply!', 'parent_id': str(parent.pk)},
        format='json',
    )
    assert resp.status_code == 201
    # Reply foi criado com parent setado
    assert Comment.objects.filter(parent=parent).count() == 1


def test_create_reply_with_parent_from_other_article_returns_400(
    make_article, article, reader_user, editor_user, authed_client_factory,
):
    """REGRESSÃO: parent_id de comment em outro artigo deve falhar com 400,
    não 500 nem criar comment órfão. validate_parent_id no serializer."""
    other_article = make_article(editor_user, title='Other Article')
    other_parent = Comment.objects.create(article=other_article, author=reader_user, content='Outro')

    api = authed_client_factory(reader_user)
    resp = api.post(
        _comments_url(article.slug),
        {'content': 'Reply cruzada', 'parent_id': str(other_parent.pk)},
        format='json',
    )
    assert resp.status_code == 400


def test_create_reply_to_nonexistent_parent_returns_400(
    article, reader_user, authed_client_factory,
):
    import uuid
    api = authed_client_factory(reader_user)
    resp = api.post(
        _comments_url(article.slug),
        {'content': 'Phantom', 'parent_id': str(uuid.uuid4())},
        format='json',
    )
    assert resp.status_code == 400


# ── DELETE (soft-delete) ─────────────────────────────────────────────────────


def test_delete_own_comment_soft_deletes(
    article, reader_user, authed_client_factory,
):
    """REGRESSÃO: DELETE não apaga fisicamente — marca is_deleted=True +
    deleted_at + deleted_by. Preserva audit trail."""
    c = Comment.objects.create(article=article, author=reader_user, content='To delete')
    api = authed_client_factory(reader_user)
    resp = api.delete(_comment_detail_url(c.pk))
    assert resp.status_code == 204

    # Físico ainda existe no DB
    c.refresh_from_db()
    assert c.is_deleted is True
    assert c.deleted_at is not None
    assert c.deleted_by == reader_user


def test_delete_other_users_comment_returns_403(
    article, reader_user, editor_user, authed_client_factory,
):
    """IsOwnerOrAdmin: leitor não-dono não pode apagar comment de outro."""
    c = Comment.objects.create(article=article, author=editor_user, content='Not yours')
    api = authed_client_factory(reader_user)
    resp = api.delete(_comment_detail_url(c.pk))
    assert resp.status_code == 403
    c.refresh_from_db()
    assert c.is_deleted is False


def test_delete_admin_can_delete_any_comment(
    article, reader_user, admin_user, authed_client_factory,
):
    """Admin pode deletar comment de qualquer usuário (moderação)."""
    c = Comment.objects.create(article=article, author=reader_user, content='Spam')
    api = authed_client_factory(admin_user)
    resp = api.delete(_comment_detail_url(c.pk))
    assert resp.status_code == 204
    c.refresh_from_db()
    assert c.is_deleted is True
    assert c.deleted_by == admin_user


def test_delete_anon_returns_401(article, reader_user, client):
    c = Comment.objects.create(article=article, author=reader_user, content='Anon delete attempt')
    resp = client.delete(_comment_detail_url(c.pk))
    assert resp.status_code == 401


# ── POST /like/ toggle ───────────────────────────────────────────────────────


def test_like_toggle_first_call_creates_like(
    article, reader_user, authed_client_factory,
):
    c = Comment.objects.create(article=article, author=reader_user, content='Likeable')
    api = authed_client_factory(reader_user)
    resp = api.post(_like_url(c.pk))
    assert resp.status_code == 200
    body = resp.json()
    assert body['liked'] is True
    assert body['likes_count'] == 1
    assert CommentLike.objects.filter(comment=c, user=reader_user).exists()


def test_like_toggle_second_call_unlikes(
    article, reader_user, authed_client_factory,
):
    """REGRESSÃO: segundo POST do MESMO user remove o like (toggle),
    NÃO retorna 409 nem cria duplicado (unique_together)."""
    c = Comment.objects.create(article=article, author=reader_user, content='Toggle me')
    CommentLike.objects.create(comment=c, user=reader_user)
    api = authed_client_factory(reader_user)
    resp = api.post(_like_url(c.pk))
    assert resp.status_code == 200
    body = resp.json()
    assert body['liked'] is False
    assert body['likes_count'] == 0
    assert not CommentLike.objects.filter(comment=c, user=reader_user).exists()


def test_like_count_correct_with_multiple_users(
    article, reader_user, editor_user, admin_user, authed_client_factory,
):
    c = Comment.objects.create(article=article, author=reader_user, content='Popular')
    # 3 usuários curtem
    for u in (reader_user, editor_user, admin_user):
        api = authed_client_factory(u)
        api.post(_like_url(c.pk))
    # Estado final
    assert CommentLike.objects.filter(comment=c).count() == 3
    # Próxima query de like retorna count correto
    api = authed_client_factory(reader_user)
    api.post(_like_url(c.pk))  # reader unlike
    api = authed_client_factory(reader_user)
    resp = api.post(_like_url(c.pk))  # reader relike
    assert resp.json()['likes_count'] == 3


def test_like_anon_returns_401(article, reader_user, client):
    c = Comment.objects.create(article=article, author=reader_user, content='Anon like attempt')
    resp = client.post(_like_url(c.pk))
    assert resp.status_code == 401


def test_like_banned_user_returns_403(
    article, reader_user, authed_client_factory,
):
    """S8 defense in depth: banned user com cookie ainda válido NÃO curte."""
    reader_user.is_banned = True
    reader_user.save()
    c = Comment.objects.create(article=article, author=reader_user, content='Hate')
    api = authed_client_factory(reader_user)
    resp = api.post(_like_url(c.pk))
    assert resp.status_code == 403


def test_like_on_soft_deleted_comment_returns_404(
    article, reader_user, authed_client_factory,
):
    """View filtra is_deleted=False — não dá pra curtir comment apagado."""
    c = Comment.objects.create(
        article=article, author=reader_user, content='Dead', is_deleted=True,
    )
    api = authed_client_factory(reader_user)
    resp = api.post(_like_url(c.pk))
    assert resp.status_code == 404

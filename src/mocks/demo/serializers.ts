/**
 * Saída da API do demo no formato dos serializers do DRF
 * (backend/apps/{users,articles,comments,moderation}/serializers.py).
 */
import type { DemoDb } from './db';
import type {
  DemoArticle,
  DemoBan,
  DemoBanRequest,
  DemoComment,
  DemoUser,
} from './fixtures';

/** `User.full_name` / `User.avatar_initial` (users/models.py). */
export const fullName = (u: DemoUser) =>
  `${u.first_name} ${u.last_name}`.trim();
export const avatarInitial = (u: DemoUser) =>
  (u.first_name.slice(0, 1) || u.email.slice(0, 1)).toUpperCase();

/** UserPublicSerializer. */
export function publicUser(u: DemoUser) {
  return {
    id: u.id,
    username: u.username,
    full_name: fullName(u),
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    bio: u.bio,
    avatar: u.avatar,
    avatar_initial: avatarInitial(u),
    date_joined: u.date_joined,
    is_banned: u.is_banned,
  };
}

const publicUserOrNull = (db: DemoDb, id: string | null) => {
  const u = id ? db.findUser(id) : null;
  return u ? publicUser(u) : null;
};

/** UserAdminSerializer: + e-mail e contagens (publicados / não apagados). */
export function adminUser(db: DemoDb, u: DemoUser) {
  const { articles, comments } = db.state;
  return {
    ...publicUser(u),
    email: u.email,
    last_login: u.last_login,
    updated_at: u.updated_at,
    article_count: articles.filter(
      (a) => a.author_id === u.id && a.status === 'published',
    ).length,
    comment_count: comments.filter((c) => c.author_id === u.id && !c.is_deleted)
      .length,
  };
}

/** ArticleListSerializer (sem body; comment_count conta respostas também). */
export function articleListItem(db: DemoDb, a: DemoArticle) {
  const author = db.findUser(a.author_id);
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_image: a.cover_image,
    author: author ? publicUser(author) : null,
    category: db.state.categories.find((c) => c.id === a.category_id) ?? null,
    status: a.status,
    is_featured: a.is_featured,
    view_count: a.view_count,
    comment_count: db.state.comments.filter(
      (c) => c.article_id === a.id && !c.is_deleted,
    ).length,
    published_at: a.published_at,
    created_at: a.created_at,
  };
}

/** ArticleDetailSerializer. */
export function articleDetail(db: DemoDb, a: DemoArticle) {
  return {
    ...articleListItem(db, a),
    body: a.body,
    cover_caption: a.cover_caption,
    updated_at: a.updated_at,
  };
}

const byCreatedAsc = (x: DemoComment, y: DemoComment) =>
  x.created_at.localeCompare(y.created_at);

/** ReplySerializer: sem parent_id (write_only), sem replies. */
function replyOut(db: DemoDb, c: DemoComment, viewer: DemoUser | null) {
  const author = db.findUser(c.author_id);
  return {
    id: c.id,
    author: author ? publicUser(author) : null,
    content: c.content,
    created_at: c.created_at,
    likes_count: c.liked_by.length,
    is_liked: viewer ? c.liked_by.includes(viewer.id) : false,
  };
}

/** CommentSerializer: respostas não apagadas, mais antigas primeiro. */
export function commentOut(
  db: DemoDb,
  c: DemoComment,
  viewer: DemoUser | null,
) {
  const replies = db.state.comments
    .filter((r) => r.parent_id === c.id && !r.is_deleted)
    .sort(byCreatedAsc)
    .map((r) => replyOut(db, r, viewer));
  return {
    ...replyOut(db, c, viewer),
    replies_count: replies.length,
    replies,
  };
}

/** BanSerializer. */
export function banOut(db: DemoDb, b: DemoBan) {
  return {
    id: b.id,
    user: publicUserOrNull(db, b.user_id),
    banned_by: publicUserOrNull(db, b.banned_by_id),
    unbanned_by: publicUserOrNull(db, b.unbanned_by_id),
    reason: b.reason,
    trigger_message: b.trigger_message,
    created_at: b.created_at,
    expires_at: b.expires_at,
    is_active: b.is_active,
    unbanned_at: b.unbanned_at,
  };
}

/** BanRequestSerializer. */
export function banRequestOut(db: DemoDb, r: DemoBanRequest) {
  return {
    id: r.id,
    target: publicUserOrNull(db, r.target_id),
    requested_by: publicUserOrNull(db, r.requested_by_id),
    reason: r.reason,
    trigger_message: r.trigger_message,
    status: r.status,
    decided_by: publicUserOrNull(db, r.decided_by_id),
    decided_at: r.decided_at,
    decision_note: r.decision_note,
    created_at: r.created_at,
  };
}

from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS


class IsAdminUser(BasePermission):
    """Allows access only to users with role='admin'."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrReadOnly(BasePermission):
    """Read-only for anyone; write requires admin role.

    Mantido para endpoints exclusivos de admin (banimentos diretos, etc).
    Para publicação de artigos, usar IsPublisherOrReadOnly (admin + editor).
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsPublisherOrReadOnly(BasePermission):
    """Read-only for anyone; write requires admin OR editor role.

    Editores podem criar/editar artigos. Admin tem todas as permissões
    de editor + banimento direto + aprovar/rejeitar BanRequest.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.can_publish)


class IsOwnerOrAdmin(BasePermission):
    """Object-level: owner or admin may modify."""
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user.is_authenticated:
            return False
        return getattr(obj, 'author_id', None) == user.pk or user.is_admin


class IsNotBanned(BasePermission):
    """Bloqueia requests de usuários autenticados banidos. Permite anônimos
    (que devem ser tratados por IsAuthenticated quando login for exigido).

    Adequada para `DEFAULT_PERMISSION_CLASSES` — endpoints públicos (AllowAny)
    continuam permitindo anon mesmo com IsNotBanned no default, pois o
    `permission_classes = [AllowAny]` no view sobrescreve o default inteiro.

    S8 do Improvement-system §11.6 — defense in depth: além do bloqueio em
    LoginSerializer e da imunidade de dev/admin, qualquer banned authenticated
    é cortado no nível da request.
    """
    message = 'Sua conta foi suspensa.'

    def has_permission(self, request, view):
        user = request.user
        return not (user.is_authenticated and user.is_banned)


class IsEditorOrAdmin(IsAuthenticated):
    """Permite GET para qualquer autenticado; POST só para editor/admin
    (não pra usuário comum/leitor).

    Usado em endpoints onde leitura é compartilhada mas a criação requer
    permissão editorial — caso clássico: BanRequest (admin vê todas, editor
    vê as suas próprias E pode criar novas). Para artigos use
    `IsPublisherOrReadOnly` (semântica diferente: anon pode GET).

    C14 do reorganization-proposal: antes vivia inline em
    `apps/moderation/views.py`. Centralizada aqui para reuso.
    """
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method == 'POST':
            return request.user.can_publish  # admin OR editor
        return True

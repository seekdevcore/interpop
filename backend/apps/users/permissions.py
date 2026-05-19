from rest_framework.permissions import BasePermission, SAFE_METHODS


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
    """Reject requests from banned users."""
    message = 'Sua conta foi suspensa.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_banned
        )

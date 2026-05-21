from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import User
from .permissions import IsPublisherOrReadOnly
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserAdminSerializer,
    UserPublicSerializer,
)
from .services import issue_tokens_for_user, logout_user, rotate_refresh_token


# ── Auth endpoints ────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        response = Response(
            UserPublicSerializer(user, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )
        issue_tokens_for_user(user, response)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({'detail': 'Logout realizado.'}, status=status.HTTP_200_OK)
        logout_user(request, response)
        return response


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'
    serializer_class   = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response = Response(
            UserPublicSerializer(user, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )
        issue_tokens_for_user(user, response)
        return response


class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(status=status.HTTP_200_OK)
        ok = rotate_refresh_token(request, response)
        if not ok:
            return Response(
                {'detail': 'Token de atualização inválido ou ausente.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserPublicSerializer(request.user, context={'request': request}).data
        )

    def patch(self, request):
        serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserPublicSerializer(request.user, context={'request': request}).data
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response = Response({'detail': 'Senha alterada com sucesso.'})
        logout_user(request, response)
        return response


# ── Password reset ────────────────────────────────────────────────────────────

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_obj = serializer.save()

        if token_obj:
            # ADR-009: email vai pra fila Celery (em dev EAGER, em prod
            # via Redis broker → worker em processo separado). Retry com
            # backoff exponencial dentro da task se SMTP falhar.
            from apps.users.tasks import send_password_reset_email
            send_password_reset_email.delay(
                user_email=token_obj.user.email,
                token=str(token_obj.token),
            )

        # Always return 200 to avoid email enumeration
        return Response(
            {'detail': 'Se o e-mail existir, você receberá as instruções em instantes.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Senha redefinida com sucesso.'}, status=status.HTTP_200_OK)


# ── Admin: user management ────────────────────────────────────────────────────

def _user_admin_qs():
    return User.objects.annotate(
        article_count=Count('articles', filter=Q(articles__status='published'), distinct=True),
        comment_count=Count('comments', filter=Q(comments__is_deleted=False), distinct=True),
    ).order_by('-date_joined')


class UserListView(generics.ListAPIView):
    """Listagem de usuários — admin E editor podem ler.
    Editor precisa pra escolher alvo de BanRequest. Métodos de escrita
    continuam só admin (não tem write neste endpoint hoje, mas o readonly
    cobre semantics futuras)."""
    permission_classes = [IsPublisherOrReadOnly]
    serializer_class   = UserAdminSerializer
    queryset           = _user_admin_qs()
    search_fields      = ['email', 'username', 'first_name', 'last_name']
    filterset_fields   = ['role', 'is_active', 'is_banned']


class UserDetailView(generics.RetrieveAPIView):
    permission_classes = [IsPublisherOrReadOnly]
    serializer_class   = UserAdminSerializer
    queryset           = _user_admin_qs()
    lookup_field       = 'pk'

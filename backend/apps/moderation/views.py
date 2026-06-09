from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdminUser, IsEditorOrAdmin, IsNotBanned
from .models import Ban, BanRequest
from .serializers import BanRequestSerializer, BanSerializer
from .services import (
    approve_ban_request,
    ban_user,
    reject_ban_request,
    unban_user,
)


# ─── Ban direto (admin only) ─────────────────────────────────────────────

class BanListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser, IsNotBanned]
    serializer_class   = BanSerializer
    queryset           = Ban.objects.filter(is_active=True).select_related(
        'user', 'banned_by', 'unbanned_by'
    )
    search_fields  = ['user__email', 'user__username', 'user__first_name', 'user__last_name']
    ordering_fields = ['created_at']

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target          = serializer.validated_data['user']
        reason          = serializer.validated_data['reason']
        trigger_message = serializer.validated_data.get('trigger_message', '')

        ban = ban_user(target, request.user, reason, trigger_message)
        return Response(BanSerializer(ban).data, status=status.HTTP_201_CREATED)


class BanDestroyView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAdminUser, IsNotBanned]
    serializer_class   = BanSerializer
    queryset           = Ban.objects.filter(is_active=True).select_related('user', 'banned_by')
    lookup_field       = 'pk'

    def perform_destroy(self, instance):
        unban_user(instance, self.request.user)


# ─── BanRequest (redator solicita, admin decide) ─────────────────────────

# IsEditorOrAdmin movido para apps.users.permissions (C14) — single source
# of truth para permissões reusáveis.


class BanRequestListCreateView(generics.ListCreateAPIView):
    """
    GET  → admin vê todas; editor vê suas próprias solicitações
    POST → editor (ou admin) cria nova solicitação
    """
    permission_classes = [IsEditorOrAdmin, IsNotBanned]
    serializer_class   = BanRequestSerializer
    filterset_fields   = ['status']
    ordering_fields    = ['created_at']

    def get_queryset(self):
        qs = BanRequest.objects.select_related('target', 'requested_by', 'decided_by')
        u = self.request.user
        if not u.is_admin:
            qs = qs.filter(requested_by=u)
        return qs

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)


class BanRequestDecideView(APIView):
    """POST /api/moderation/ban-requests/<pk>/decide/ — admin aprova ou rejeita.

    Body: { "action": "approve" | "reject", "decision_note": "..." (opcional) }
    Aprovar cria Ban real (User.is_banned=True). Rejeitar só muda status.
    """
    permission_classes = [IsAdminUser, IsNotBanned]

    def post(self, request, pk):
        try:
            obj = BanRequest.objects.get(pk=pk)
        except BanRequest.DoesNotExist:
            return Response({'detail': 'Solicitação não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if obj.status != BanRequest.Status.PENDING:
            return Response(
                {'detail': f'Solicitação já {obj.get_status_display().lower()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = request.data.get('action')
        note   = request.data.get('decision_note', '')

        if action == 'approve':
            approve_ban_request(obj, request.user, decision_note=note)
        elif action == 'reject':
            reject_ban_request(obj, request.user, decision_note=note)
        else:
            return Response(
                {'detail': "action deve ser 'approve' ou 'reject'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        obj.refresh_from_db()
        return Response(BanRequestSerializer(obj).data, status=status.HTTP_200_OK)

from rest_framework import serializers
from apps.users.serializers import UserPublicSerializer
from apps.users.models import User
from .models import Ban, BanRequest


class BanSerializer(serializers.ModelSerializer):
    user      = UserPublicSerializer(read_only=True)
    # Alvo pode ser usuário comum OU editor (admin pode banir editor abusivo).
    # Admin e Dev nunca aparecem no queryset — hierarquia interna não é banível.
    user_id   = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=['user', 'editor'], is_banned=False),
        write_only=True,
        source='user',
    )
    banned_by   = UserPublicSerializer(read_only=True)
    unbanned_by = UserPublicSerializer(read_only=True)

    class Meta:
        model  = Ban
        fields = [
            'id', 'user', 'user_id', 'banned_by', 'unbanned_by',
            'reason', 'trigger_message',
            'created_at', 'expires_at', 'is_active',
            'unbanned_at',
        ]
        read_only_fields = ['id', 'banned_by', 'unbanned_by', 'created_at', 'is_active', 'unbanned_at']

    def validate_user_id(self, user):
        # Defesa em profundidade: além do filtro de queryset, valida explicitamente
        # que o alvo não é dev/admin. Mesmo se algum bug futuro alterar o queryset,
        # esta checagem continua impedindo escalation de privilege.
        if user.is_immune_to_ban:
            raise serializers.ValidationError(
                'Usuários com role Dev ou Admin são imunes a banimento por design.'
            )
        if Ban.objects.filter(user=user, is_active=True).exists():
            raise serializers.ValidationError('Usuário já está banido.')
        return user


class BanRequestSerializer(serializers.ModelSerializer):
    target       = UserPublicSerializer(read_only=True)
    requested_by = UserPublicSerializer(read_only=True)
    decided_by   = UserPublicSerializer(read_only=True)
    target_id    = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=['user', 'editor'], is_banned=False),
        write_only=True,
        source='target',
    )

    class Meta:
        model  = BanRequest
        fields = [
            'id', 'target', 'target_id', 'requested_by',
            'reason', 'trigger_message',
            'status', 'decided_by', 'decided_at', 'decision_note',
            'created_at',
        ]
        read_only_fields = ['id', 'requested_by', 'status', 'decided_by',
                            'decided_at', 'created_at']

    def validate_target_id(self, user):
        # Defesa em profundidade — mesma lógica do BanSerializer.
        if user.is_immune_to_ban:
            raise serializers.ValidationError(
                'Não é possível solicitar banimento de usuários com role Dev ou Admin.'
            )
        # Bloqueia solicitação duplicada (já pendente) pro mesmo alvo
        if BanRequest.objects.filter(target=user, status=BanRequest.Status.PENDING).exists():
            raise serializers.ValidationError('Já existe solicitação pendente para este usuário.')
        if Ban.objects.filter(user=user, is_active=True).exists():
            raise serializers.ValidationError('Usuário já está banido.')
        return user

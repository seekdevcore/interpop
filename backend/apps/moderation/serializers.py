from rest_framework import serializers
from apps.users.serializers import UserPublicSerializer
from apps.users.models import User
from .models import Ban, BanRequest


class BanSerializer(serializers.ModelSerializer):
    user      = UserPublicSerializer(read_only=True)
    # Queryset do alvo é ATOR-AWARE (definido no __init__): dev (superadmin)
    # pode banir admins; admin só user/editor. Dev nunca é alvo.
    user_id   = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(),
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Camada 1 (queryset): só entram alvos baníveis pelo ATOR. Dev pode
        # banir admin; demais atores, só user/editor. Sem ator (saída/sem
        # contexto) usa o conjunto restritivo (fail-closed).
        actor = getattr(self.context.get('request'), 'user', None)
        roles = ['user', 'editor']
        if actor is not None and getattr(actor, 'is_authenticated', False) and actor.is_dev:
            roles = ['user', 'editor', 'admin']
        self.fields['user_id'].queryset = User.objects.filter(role__in=roles, is_banned=False)

    def validate_user_id(self, user):
        # Camada 2 (defesa em profundidade): regra relacional explícita. Mesmo
        # se o queryset for relaxado por bug futuro, isto barra escalation:
        # dev é imune a todos; admin só é banível por dev.
        actor = getattr(self.context.get('request'), 'user', None)
        if not user.can_be_banned_by(actor):
            raise serializers.ValidationError(
                'Você não pode banir este usuário: dev é imune a todos e admin '
                'só pode ser banido por um dev.'
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

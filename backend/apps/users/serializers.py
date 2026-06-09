import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import PasswordResetToken, User

# Handle público: letras, números, ponto, hífen ou underline (ex.: Intetsu_Gabe).
# Case é PRESERVADO (não força lowercase) — unicidade é checada case-insensitive.
USERNAME_RE = re.compile(r'^[A-Za-z0-9_.-]+$')


def _validate_username(value, *, exclude_pk=None):
    value = value.strip()
    if not value:
        raise serializers.ValidationError('O nome de usuário não pode ser vazio.')
    if not USERNAME_RE.match(value):
        raise serializers.ValidationError(
            'Use apenas letras, números, ponto, hífen ou underline (sem espaços).'
        )
    qs = User.objects.filter(username__iexact=value)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise serializers.ValidationError('Este nome de usuário já está em uso.')
    return value


# ── Public user representation ───────────────────────────────────────────────

class UserPublicSerializer(serializers.ModelSerializer):
    full_name      = serializers.CharField(read_only=True)
    avatar_initial = serializers.CharField(read_only=True)

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'full_name', 'first_name', 'last_name',
            'role', 'bio', 'avatar', 'avatar_initial', 'date_joined', 'is_banned',
        ]


# ── Admin view of a user (includes email + stats) ────────────────────────────

class UserAdminSerializer(UserPublicSerializer):
    article_count = serializers.IntegerField(read_only=True, default=0)
    comment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(UserPublicSerializer.Meta):
        fields = UserPublicSerializer.Meta.fields + [
            'email', 'last_login', 'updated_at',
            'article_count', 'comment_count',
        ]


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        request = self.context.get('request')
        user = authenticate(request=request, username=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError('E-mail ou senha inválidos.')
        if not user.is_active:
            raise serializers.ValidationError('Conta desativada.')
        if user.is_banned:
            raise serializers.ValidationError('Conta suspensa.')
        data['user'] = user
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, label='Confirmação de senha')

    class Meta:
        model  = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password2']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Este e-mail já está em uso.')
        return value.lower()

    def validate_username(self, value):
        return _validate_username(value)

    def validate(self, data):
        if data['password'] != data.pop('password2'):
            raise serializers.ValidationError({'password2': 'As senhas não coincidem.'})
        try:
            validate_password(data['password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})
        return data

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Senha atual incorreta.')
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, user=self.context['request'].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password', 'updated_at'])
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    # Declarado explicitamente para (1) trocar o UniqueValidator automático do
    # DRF (case-sensitive) por checagem iexact e (2) preservar o case digitado.
    username = serializers.CharField(max_length=150, required=False)

    class Meta:
        model  = User
        fields = ['username', 'first_name', 'last_name', 'bio', 'avatar']

    def validate_username(self, value):
        return _validate_username(value, exclude_pk=self.instance.pk if self.instance else None)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save(update_fields=list(validated_data.keys()) + ['updated_at'])
        return instance


# ── Password reset ────────────────────────────────────────────────────────────

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()

    def save(self):
        email = self.validated_data['email']
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            return None

        # Invalidate any existing unused tokens for this user
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

        token = PasswordResetToken.objects.create(user=user)
        return token


class PasswordResetConfirmSerializer(serializers.Serializer):
    token        = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_token(self, value):
        try:
            self._token_obj = PasswordResetToken.objects.select_related('user').get(token=value)
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError('Token inválido.')
        if not self._token_obj.is_valid:
            raise serializers.ValidationError('Token expirado ou já utilizado.')
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def save(self):
        # @transaction.atomic: dois writes (user.password + token.is_used) que
        # precisam comitar juntos. Sem isso, crash entre as duas linhas deixava
        # token consumido mas senha não trocada — usuário ficava sem acesso.
        # ADR-012 / item C3 do Improvement-system.md §11.1.
        from django.db import transaction

        from .services import blacklist_all_user_tokens

        with transaction.atomic():
            user = self._token_obj.user
            user.set_password(self.validated_data['new_password'])
            user.save(update_fields=['password', 'updated_at'])
            self._token_obj.is_used = True
            self._token_obj.save(update_fields=['is_used'])
            # S7 — reset por email invalida TODAS as sessões. Cenário típico:
            # usuário reseta porque suspeita de invasão — atacante autenticado
            # em outro device é cortado imediatamente.
            blacklist_all_user_tokens(user)
            return user

from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate, password_validation
from .models import Profile
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.authtoken.models import Token
#CONSEGUIMOS EL USUARIO
User = get_user_model()
#CAMPOS REQUERIDOS PARA EL PERFIL O ME 
class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
    def get_role(self, obj):
        return getattr(obj.profile, "role", "RESIDENT")
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, required=False)
    class Meta:
        model = User
        fields = ["username", "email", "password", "role"]

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role", "RESIDENT")
        user = User.objects.create_user(**validated_data)
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return user

class AdminUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField(read_only=True)      # lectura
    role_input = serializers.ChoiceField(                         # escritura
        choices=Profile.ROLE_CHOICES, write_only=True, required=False
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    class Meta:
        model = User
        fields = ["id","username","email","first_name","last_name","is_active","role","role_input","password"]

    def get_role(self, instance):
        try:
            return instance.profile.role
        except ObjectDoesNotExist:
            return "RESIDENT"

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role_input", "RESIDENT")
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role_input", None)
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password and password.strip():
            instance.set_password(password)
        instance.save()
        if role is not None:
            Profile.objects.update_or_create(user=instance, defaults={"role": role})
        return instance
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError("Credenciales inválidas")
        if not user.is_active:
            raise serializers.ValidationError("Usuario inactivo")
        data['user'] = user
        return data


class LoginResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    role = serializers.CharField()
    
#CASO DE USO 3 GESTIONAR USUARIO
ROLE_EDITABLE_FIELDS = {
    "ADMIN":   {"first_name", "last_name", "email", "username"},   # si no quieres permitir username, quítalo
    "STAFF":   {"first_name", "last_name", "email"},
    "RESIDENT":{"first_name", "last_name", "email"},
}

class MeUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name  = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email      = serializers.EmailField(required=False)
    username   = serializers.CharField(required=False, allow_blank=False, max_length=150)  # opcional para ADMIN

    def validate(self, attrs):
        user = self.context["request"].user
        role = getattr(getattr(user, "profile", None), "role", "RESIDENT")
        allowed = ROLE_EDITABLE_FIELDS.get(role, set())

        # Filtra solo lo permitido para ese rol
        not_allowed = set(attrs.keys()) - allowed
        for k in list(not_allowed):
            attrs.pop(k, None)

        if "username" in attrs:
            # Evita duplicados
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if User.objects.exclude(pk=user.pk).filter(username=attrs["username"]).exists():
                raise serializers.ValidationError({"username": "Ya está en uso."})

        if "email" in attrs:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if User.objects.exclude(pk=user.pk).filter(email=attrs["email"]).exists():
                raise serializers.ValidationError({"email": "Ya está en uso."})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        for k, v in self.validated_data.items():
            setattr(user, k, v)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "No coincide."})
        # Validaciones de contraseña de Django (opcional)
        password_validation.validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user
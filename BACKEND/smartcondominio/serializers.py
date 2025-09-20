from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate, password_validation
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from .models import Profile, Rol
from django.contrib.auth.models import Permission  # 👈 necesario para PermissionBriefSerializer

User = get_user_model()

# ---------- util ----------
def _resolve_role(role_id=None, role_code=None, default_code="RESIDENT"):
    try:
        if role_id is not None:
            return Rol.objects.get(id=role_id)
        if role_code:
            code = str(role_code).strip().upper()   # normaliza
            return Rol.objects.get(code=code)
        return Rol.objects.get(code=default_code)
    except Rol.DoesNotExist:
        raise serializers.ValidationError({"role": "Rol no encontrado (id/code inválido)."})

# ---------- Me ----------
class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]

    def get_role(self, obj):
        try:
            return getattr(obj.profile.role, "code", "RESIDENT")
        except ObjectDoesNotExist:
            return "RESIDENT"

# ---------- Registro ----------
class RegisterSerializer(serializers.ModelSerializer):
    password   = serializers.CharField(write_only=True, min_length=6)
    role_id    = serializers.IntegerField(required=False, write_only=True)
    role_code  = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role_id", "role_code"]

    @transaction.atomic
    def create(self, validated_data):
        role_id   = validated_data.pop("role_id", None)
        role_code = validated_data.pop("role_code", None)
        user = User.objects.create_user(**validated_data)
        role = _resolve_role(role_id, role_code, default_code="RESIDENT")
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return user

# ---------- Admin: CRUD usuarios ----------
class AdminUserSerializer(serializers.ModelSerializer):
    role      = serializers.SerializerMethodField(read_only=True)  # devuelve code
    role_id   = serializers.IntegerField(required=False, write_only=True)
    role_code = serializers.CharField(required=False, write_only=True)
    password  = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "id","username","email","first_name","last_name",
            "is_active","role","role_id","role_code","password"
        ]

    def get_role(self, instance):
        try:
            return getattr(instance.profile.role, "code", "RESIDENT")
        except ObjectDoesNotExist:
            return "RESIDENT"

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        UserModel = get_user_model()

        if instance:
            if "username" in attrs and UserModel.objects.exclude(pk=instance.pk).filter(username=attrs["username"]).exists():
                raise serializers.ValidationError({"username": "Ya está en uso."})
            if "email" in attrs and attrs.get("email") and UserModel.objects.exclude(pk=instance.pk).filter(email=attrs["email"]).exists():
                raise serializers.ValidationError({"email": "Ya está en uso."})
        else:
            if "username" in attrs and UserModel.objects.filter(username=attrs["username"]).exists():
                raise serializers.ValidationError({"username": "Ya está en uso."})
            if "email" in attrs and attrs.get("email") and UserModel.objects.filter(email=attrs["email"]).exists():
                raise serializers.ValidationError({"email": "Ya está en uso."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role_id   = validated_data.pop("role_id", None)
        role_code = validated_data.pop("role_code", None)
        password  = validated_data.pop("password", None)

        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()

        role = _resolve_role(role_id, role_code, default_code="RESIDENT")
        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role_id   = validated_data.pop("role_id", None)
        role_code = validated_data.pop("role_code", None)
        password  = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password and password.strip():
            instance.set_password(password)
        instance.save()

        if role_id is not None or role_code is not None:
            role = _resolve_role(role_id, role_code, default_code="RESIDENT")
            Profile.objects.update_or_create(user=instance, defaults={"role": role})

        return instance

# ---------- Login ----------
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

# ---------- Me update ----------
ROLE_EDITABLE_FIELDS = {
    "ADMIN":   {"first_name", "last_name", "email", "username"},
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
        code = getattr(getattr(getattr(user, "profile", None), "role", None), "code", "RESIDENT")
        allowed = ROLE_EDITABLE_FIELDS.get(code, set())

        # filtra solo lo permitido
        not_allowed = set(attrs.keys()) - allowed
        for k in list(not_allowed):
            attrs.pop(k, None)

        # unicidad
        UserModel = get_user_model()
        if "username" in attrs and UserModel.objects.exclude(pk=user.pk).filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Ya está en uso."})
        if "email" in attrs and UserModel.objects.exclude(pk=user.pk).filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Ya está en uso."})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        for k, v in self.validated_data.items():
            setattr(user, k, v)
        user.save()
        return user

# ---------- Change password ----------
class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "No coincide."})
        password_validation.validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user

# ---------- Permisos (catálogo) ----------
class PermissionBriefSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "codename", "name", "content_type"]

    def get_content_type(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

# ---------- Roles ----------
class RolSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ["id", "code", "name", "description", "is_system"]
        read_only_fields = ["id", "is_system"]  # que no lo cambien por API

    def validate_code(self, value):
        v = value.strip().upper()
        if " " in v:
            raise serializers.ValidationError("El code no debe contener espacios.")
        return v

from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate, password_validation
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from .models import Profile, Rol, Unidad, Cuota, Pago
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
    
#-------UNIDADES GESTION -------
class UnidadSerializer(serializers.ModelSerializer):
    propietario_nombre = serializers.CharField(source="propietario.get_full_name", read_only=True)
    residente_nombre = serializers.CharField(source="residente.get_full_name", read_only=True)

    class Meta:
        model = Unidad
        fields = [
            "id",
            "torre", "bloque", "numero", "piso",
            "tipo", "metraje", "coeficiente",
            "dormitorios", "parqueos", "bodegas",
            "estado", "is_active",
            "propietario", "propietario_nombre",
            "residente", "residente_nombre",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        # Evita duplicados (con soporte para PATCH)
        torre = attrs.get("torre", getattr(self.instance, "torre", None))
        bloque = attrs.get("bloque", getattr(self.instance, "bloque", None))
        numero = attrs.get("numero", getattr(self.instance, "numero", None))

        if torre and numero:
            qs = Unidad.objects.filter(torre=torre, bloque=bloque, numero=numero)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"numero": "Ya existe una unidad con esa combinación (torre/bloque/número)."}
                )
        return attrs
    
class CuotaSerializer(serializers.ModelSerializer):
    saldo = serializers.SerializerMethodField()
    vencimiento = serializers.DateField(input_formats=["%Y-%m-%d"], format="%Y-%m-%d")

    def get_saldo(self, obj):
        return obj.saldo

    class Meta:
        model = Cuota
        fields = [
            "id","unidad","periodo","concepto",
            "monto_base","usa_coeficiente","coeficiente_snapshot",
            "monto_calculado","descuento_aplicado","mora_aplicada",
            "total_a_pagar","pagado","saldo",
            "vencimiento","estado","is_active",
            "created_at","updated_at",
        ]
        read_only_fields = ["monto_calculado","total_a_pagar","pagado","estado","created_at","updated_at"]

# ---- PAGOS ----
def value_gt(a, b):
    from decimal import Decimal
    return Decimal(a) > Decimal(b)

# Entrada (POST)
class PagoCreateSerializer(serializers.Serializer):
    cuota = serializers.PrimaryKeyRelatedField(queryset=Cuota.objects.all())
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)
    medio = serializers.ChoiceField(choices=Pago.MEDIO_CHOICES, default="EFECTIVO")
    referencia = serializers.CharField(required=False, allow_blank=True)

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError("El monto debe ser > 0.")
        return value

    def create(self, validated_data):
        cuota = validated_data["cuota"]
        if value_gt(validated_data["monto"], cuota.saldo):
            raise serializers.ValidationError({"monto": "El monto excede el saldo pendiente."})

        request = self.context.get("request")
        pago = Pago.objects.create(
            cuota=cuota,
            monto=validated_data["monto"],
            medio=validated_data.get("medio", "EFECTIVO"),
            referencia=validated_data.get("referencia", ""),
            creado_por=request.user if request and request.user.is_authenticated else None,
        )
        pago.aplicar()  # actualiza pagado/estado de la cuota
        return pago

# Salida (GET/response de create)
class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = ["id","cuota","fecha_pago","monto","medio","referencia","valido","creado_por","created_at"]
        read_only_fields = ["fecha_pago","valido","creado_por","created_at"]
        
# GENERAR CUOTAS
class GenerarCuotasSerializer(serializers.Serializer):
    # Si tu campo periodo en Cuota es CharField tipo "YYYY-MM":
    periodo = serializers.RegexField(regex=r"^\d{4}-(0[1-9]|1[0-2])$", max_length=7)
    # Si en tu modelo es DateField, cambia a:
    # periodo = serializers.DateField(input_formats=["%Y-%m-%d"])  # usar "YYYY-MM-01"

    concepto = serializers.CharField(max_length=100)
    monto_base = serializers.DecimalField(max_digits=12, decimal_places=2)
    usa_coeficiente = serializers.BooleanField()
    vencimiento = serializers.DateField(input_formats=["%Y-%m-%d"])

    # Opcional: validaciones adicionales
    def validate(self, attrs):
        # aquí puedes chequear rangos, etc.
        return attrs
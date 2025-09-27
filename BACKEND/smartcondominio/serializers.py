from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate, password_validation
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from .models import Profile, Rol, Unidad, Cuota, Pago, Infraccion, StaffKind
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
    role_base = serializers.SerializerMethodField()
    staff_kind = serializers.SerializerMethodField()
    staff_kind_id = serializers.SerializerMethodField()
    staff_kind_text = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "role_base", "staff_kind", "staff_kind_id", "staff_kind_text"
        ]

    def get_role(self, obj):
        try:
            return getattr(obj.profile.role, "code", "RESIDENT")
        except ObjectDoesNotExist:
            return "RESIDENT"

    def get_role_base(self, obj):
        try:
            return getattr(obj.profile.role, "base", None)
        except ObjectDoesNotExist:
            return None

    def get_staff_kind(self, obj):
        try:
            sk = getattr(obj.profile, "staff_kind", None)
            if sk:
                return sk.name
            txt = getattr(obj.profile, "staff_kind_text", "") or ""
            return txt or None
        except ObjectDoesNotExist:
            return None

    def get_staff_kind_id(self, obj):
        try:
            return getattr(getattr(obj.profile, "staff_kind", None), "id", None)
        except ObjectDoesNotExist:
            return None

    def get_staff_kind_text(self, obj):
        try:
            return getattr(obj.profile, "staff_kind_text", "") or ""
        except ObjectDoesNotExist:
            return ""

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
    # Lectura
    role = serializers.SerializerMethodField(read_only=True)  # code
    role_base = serializers.SerializerMethodField(read_only=True)
    staff_kind = serializers.SerializerMethodField(read_only=True)  # nombre ó texto

    # Escritura
    role_id = serializers.IntegerField(required=False, write_only=True)
    role_code = serializers.CharField(required=False, write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    staff_kind_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    staff_kind_text = serializers.CharField(required=False, write_only=True, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id","username","email","first_name","last_name",
            "is_active",
            # rol
            "role","role_base","role_id","role_code",
            # tipo de personal
            "staff_kind","staff_kind_id","staff_kind_text",
            # seguridad
            "password",
        ]

    # === Getters lectura ===
    def get_role(self, instance):
        try:
            return getattr(instance.profile.role, "code", "RESIDENT")
        except ObjectDoesNotExist:
            return "RESIDENT"

    def get_role_base(self, instance):
        try:
            return getattr(instance.profile.role, "base", None)
        except ObjectDoesNotExist:
            return None

    def get_staff_kind(self, instance):
        try:
            p = instance.profile
            if p.staff_kind:
                return p.staff_kind.name
            return p.staff_kind_text or None
        except ObjectDoesNotExist:
            return None

    # === Validación de unicidad (como lo tenías) ===
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

    # === Helpers internos ===
    def _apply_role_and_staff_kind(self, user, role_id, role_code, staff_kind_id, staff_kind_text):
        """Asigna role y, si base=STAFF, el tipo de personal (FK o texto)."""
        # 1) Rol
        role = _resolve_role(role_id, role_code, default_code="RESIDENT")
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.role = role

        # 2) Tipo de personal
        if getattr(role, "base", None) == "STAFF":
            sk_obj = None
            if staff_kind_id is not None:
                # staff_kind_id explícito
                if staff_kind_id:
                    try:
                        sk_obj = StaffKind.objects.get(pk=staff_kind_id, is_active=True)
                    except StaffKind.DoesNotExist:
                        raise serializers.ValidationError({"staff_kind_id": "Tipo de personal inválido."})
                # si viene null, se limpia (permite quitar FK y usar texto)
            profile.staff_kind = sk_obj
            profile.staff_kind_text = (staff_kind_text or "").strip()
        else:
            # No es staff → limpiar
            profile.staff_kind = None
            profile.staff_kind_text = ""

        profile.save(update_fields=["role", "staff_kind", "staff_kind_text"])

    # === Create ===
    @transaction.atomic
    def create(self, validated_data):
        role_id   = validated_data.pop("role_id", None)
        role_code = validated_data.pop("role_code", None)
        password  = validated_data.pop("password", None)
        staff_kind_id = validated_data.pop("staff_kind_id", None)
        staff_kind_text = validated_data.pop("staff_kind_text", "")

        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()

        self._apply_role_and_staff_kind(user, role_id, role_code, staff_kind_id, staff_kind_text)
        return user

    # === Update ===
    @transaction.atomic
    def update(self, instance, validated_data):
        role_id   = validated_data.pop("role_id", None)
        role_code = validated_data.pop("role_code", None)
        password  = validated_data.pop("password", None)
        staff_kind_id = validated_data.pop("staff_kind_id", None)
        staff_kind_text = validated_data.pop("staff_kind_text", "")

        # Campos simples del User
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password and password.strip():
            instance.set_password(password)
        instance.save()

        # Solo si se envió role_id/role_code o staff_kind*, aplicamos cambios a Profile
        if role_id is not None or role_code is not None or staff_kind_id is not None or staff_kind_text is not None:
            self._apply_role_and_staff_kind(instance, role_id, role_code, staff_kind_id, staff_kind_text)

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
        fields = ["id", "code", "name", "description", "is_system", "base"]
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
    
# Mini serializers (coherentes con tu estilo actual)
class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]

class UnidadMiniForInfSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ["id", "torre", "bloque", "numero"]

class InfraccionSerializer(serializers.ModelSerializer):
    # lectura
    unidad = UnidadMiniForInfSerializer(read_only=True)
    creado_por = UserBriefSerializer(read_only=True)

    # escritura
    unidad_id = serializers.PrimaryKeyRelatedField(source="unidad", queryset=Unidad.objects.all(), write_only=True)
    # 🔧 usar User como queryset para residente_id
    residente_id = serializers.PrimaryKeyRelatedField(
        source="residente",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )

    fecha = serializers.DateField(input_formats=["%Y-%m-%d"], format="%Y-%m-%d")

    class Meta:
        model = Infraccion
        fields = [
            "id",
            "unidad", "unidad_id", "residente_id",
            "fecha", "tipo", "descripcion", "monto", "evidencia_url",
            "estado", "is_active",
            "creado_por", "created_at", "updated_at",
        ]
        read_only_fields = ["creado_por", "created_at", "updated_at"]

#ESTADO DE CUENTA RESIDENTE
class UnidadBriefECSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ["id", "torre", "bloque", "numero"]

class PagoEstadoCuentaSerializer(serializers.ModelSerializer):
    cuota_periodo = serializers.SerializerMethodField()
    cuota_concepto = serializers.SerializerMethodField()
    unidad_id = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = ["id", "fecha_pago", "monto", "medio", "referencia", "cuota_periodo", "cuota_concepto", "unidad_id", "created_at"]

    def get_cuota_periodo(self, obj):
        try:
            return obj.cuota.periodo
        except Exception:
            return None

    def get_cuota_concepto(self, obj):
        try:
            return obj.cuota.concepto
        except Exception:
            return None

    def get_unidad_id(self, obj):
        try:
            return obj.cuota.unidad_id
        except Exception:
            return None
        
from rest_framework import serializers
from .models import Aviso, Unidad, Rol

class AvisoSerializer(serializers.ModelSerializer):
    unidades = serializers.PrimaryKeyRelatedField(queryset=Unidad.objects.all(), many=True, required=False)
    roles = serializers.PrimaryKeyRelatedField(queryset=Rol.objects.all(), many=True, required=False)
    # Lista de URLs
    adjuntos = serializers.ListField(
        child=serializers.URLField(max_length=1000),
        required=False,
        allow_empty=True
    )

    class Meta:
        model = Aviso
        fields = [
            "id", "titulo", "cuerpo",
            "audiencia", "torre", "unidades", "roles",
            "status", "publish_at", "expires_at",
            "notify_inapp", "notify_email", "notify_push",
            "adjuntos",
            "creado_por", "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["creado_por", "created_at", "updated_at"]

    def validate(self, data):
        aud = data.get("audiencia", getattr(self.instance, "audiencia", "ALL"))
        if aud == "TORRE":
            if not data.get("torre", getattr(self.instance, "torre", "")):
                raise serializers.ValidationError({"torre": "Requerido cuando audiencia=TORRE."})
        if aud == "UNIDAD":
            unidades = data.get("unidades") or []
            if isinstance(unidades, list) and len(unidades) == 0:
                raise serializers.ValidationError({"unidades": "Debe seleccionar al menos una unidad."})
        if aud == "ROL":
            roles = data.get("roles") or []
            if isinstance(roles, list) and len(roles) == 0:
                raise serializers.ValidationError({"roles": "Debe seleccionar al menos un rol."})

        status_ = data.get("status", getattr(self.instance, "status", "BORRADOR"))
        publish_at = data.get("publish_at", getattr(self.instance, "publish_at", None))
        if status_ == "PROGRAMADO" and not publish_at:
            raise serializers.ValidationError({"publish_at": "Requerido cuando status=PROGRAMADO."})
        return data

    def create(self, validated):
        validated["creado_por"] = self.context["request"].user
        return super().create(validated)

# ====== SERIALIZERS TAREAS ======
# --- IMPORTS necesarios (ajústalos si ya los tienes en tu archivo) ---
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Tarea, TareaComentario, Unidad, Rol

# Breves
class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email")

class RolBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ("id", "code", "name")

class UnidadBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ("id", "torre", "bloque", "numero")

# Comentarios
class TareaComentarioSerializer(serializers.ModelSerializer):
    autor = UserBriefSerializer(read_only=True)

    class Meta:
        model = TareaComentario
        fields = ("id", "cuerpo", "autor", "created_at")

# Tareas
class TareaSerializer(serializers.ModelSerializer):
    """
    Escritura: acepta PK en unidad/asignado_a/asignado_a_rol.
    Lectura: expone objetos *_info y lista de comentarios.
    """
    # Escritura (PKs)
    unidad = serializers.PrimaryKeyRelatedField(
        queryset=Unidad.objects.all(), allow_null=True, required=False
    )
    asignado_a = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )
    asignado_a_rol = serializers.PrimaryKeyRelatedField(
        queryset=Rol.objects.all(), allow_null=True, required=False
    )

    # Lectura (anidados)
    unidad_info = UnidadBriefSerializer(source="unidad", read_only=True)
    asignado_a_info = UserBriefSerializer(source="asignado_a", read_only=True)
    asignado_a_rol_info = RolBriefSerializer(source="asignado_a_rol", read_only=True)

    # Reverse FK (requires related_name="comentarios" en TareaComentario.tarea)
    comentarios = TareaComentarioSerializer(many=True, read_only=True)

    class Meta:
        model = Tarea
        fields = (
            "id",
            "titulo",
            "descripcion",
            "prioridad",
            "estado",
            "fecha_inicio",
            "fecha_limite",
            "unidad", "unidad_info",
            "asignado_a", "asignado_a_info",
            "asignado_a_rol", "asignado_a_rol_info",
            "adjuntos",
            "checklist",
            "is_active",
            "created_at",
            "updated_at",
            "creado_por",
            "comentarios",   # 👈 IMPORTANTE: ahora sí está en fields
        )
        read_only_fields = ("is_active", "created_at", "updated_at", "creado_por")

    # Opcional: normaliza 'dd/mm/yyyy' → date
    def _norm_date(self, v):
        if not v:
            return v
        if isinstance(v, str):
            import re, datetime
            m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", v)
            if m:
                return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return v

    def validate_fecha_inicio(self, v):
        return self._norm_date(v)

    def validate_fecha_limite(self, v):
        return self._norm_date(v)
class TareaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tarea
        fields = (
            "titulo", "descripcion", "prioridad", "estado",
            "unidad", "asignado_a", "asignado_a_rol",
            "fecha_inicio", "fecha_limite", "adjuntos", "checklist",
        )

# ========= CU16: SERIALIZERS DE ÁREAS =========
from rest_framework import serializers
from .models import AreaComun

class AreaComunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AreaComun
        fields = [
            "id", "nombre", "descripcion", "ubicacion",
            "capacidad", "costo_por_hora", "activa", "requiere_aprobacion"
        ]

class AreaDisponibilidadWindowSerializer(serializers.Serializer):
    start = serializers.TimeField()
    end = serializers.TimeField()

class SlotSerializer(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()

class DisponibilidadResponseSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    date = serializers.DateField()
    slot_minutes = serializers.IntegerField()
    windows = AreaDisponibilidadWindowSerializer(many=True)
    slots = SlotSerializer(many=True)
    
class StaffKindSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffKind
        fields = ["id", "code", "name", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


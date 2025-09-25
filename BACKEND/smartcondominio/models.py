from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User, Permission
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from datetime import date
from django.utils import timezone
#CREAMOS UNA TABLA DE TIPO ROL 
class Rol(models.Model):
    code = models.CharField(max_length=30, unique=True)   # Ej: ADMIN
    name = models.CharField(max_length=50)                # Ej: Administrador
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)  # protege roles base
    permissions = models.ManyToManyField(Permission, blank=True, related_name="roles")
    
    class Meta:
        ordering = ["code"]
    def __str__(self):
        return f"{self.code} - {self.name}"
    def save(self, *args, **kwargs):
        # Normaliza el code: sin espacios y en mayúsculas
        if self.code:
            self.code = self.code.strip().upper().replace(" ", "_")
        super().save(*args, **kwargs)

#TABLA DE TIPO PERFIL
# Profile: cambia role de CharField -> ForeignKey
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Rol, null=True, blank=True, on_delete=models.SET_NULL)
    def __str__(self):
        return f"{self.user.username} ({self.role.code if self.role else 'Sin rol'})"

@receiver(post_save, sender=User)
def ensure_profile(sender, instance, created, **kwargs):
    Profile.objects.get_or_create(user=instance)
    
#UNIDAD  
class Unidad(models.Model):
    TIPO_CHOICES = [
        ("DEP", "Departamento"),
        ("CASA", "Casa"),
        ("LOCAL", "Local"),
    ]
    ESTADO_CHOICES = [
        ("OCUPADA", "Ocupada"),
        ("DESOCUPADA", "Desocupada"),
        ("MANTENIMIENTO", "Mantenimiento"),
        ("INACTIVA", "Inactiva"),
    ]

    # Identificación física
    torre = models.CharField(max_length=100)
    bloque = models.CharField(max_length=100, null=True, blank=True)
    numero = models.CharField(max_length=20)
    piso = models.IntegerField(null=True, blank=True)

    # Características
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    metraje = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(0)])
    coeficiente = models.DecimalField(  # alícuota
        max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    dormitorios = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    parqueos = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    bodegas = models.IntegerField(default=0, validators=[MinValueValidator(0)])

    # Estado y asignaciones
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="DESOCUPADA")
    propietario = models.ForeignKey(
        User, related_name="propiedades", on_delete=models.SET_NULL, null=True, blank=True
    )
    residente = models.ForeignKey(
        User, related_name="residencias", on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)  # “soft delete”

    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Unicidad lógica para unidades activas (torre + bloque + numero)
        constraints = [
            models.UniqueConstraint(
                fields=["torre", "bloque", "numero"],
                name="uniq_unidad_torre_bloque_numero",
            )
        ]
        ordering = ["torre", "bloque", "numero"]

    def __str__(self):
        b = f"-{self.bloque}" if self.bloque else ""
        return f"{self.torre}{b}-{self.numero}"
    
class Cuota(models.Model):
    ESTADO_CHOICES = [
        ("PENDIENTE", "Pendiente"),
        ("PARCIAL", "Parcial"),
        ("PAGADA", "Pagada"),
        ("VENCIDA", "Vencida"),
        ("ANULADA", "Anulada"),
    ]

    unidad = models.ForeignKey("smartcondominio.Unidad", on_delete=models.PROTECT, related_name="cuotas")
    periodo = models.CharField(max_length=7)  # "YYYY-MM"
    concepto = models.CharField(max_length=50, default="GASTO_COMUN")

    # Montos
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    usa_coeficiente = models.BooleanField(default=True)
    coeficiente_snapshot = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))  # % de la unidad en el momento
    monto_calculado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    descuento_aplicado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    mora_aplicada = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_a_pagar = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    pagado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    vencimiento = models.DateField()
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["unidad", "periodo", "concepto"],
                condition=Q(is_active=True),
                name="uniq_cuota_unidad_periodo_concepto_activa",
            )
        ]
        indexes = [
            models.Index(fields=["periodo", "concepto"]),
        ]
        ordering = ["-periodo", "unidad_id"]

    def __str__(self):
        return f"{self.unidad} · {self.periodo} · {self.concepto}"

    @property
    def saldo(self) -> Decimal:
        s = Decimal(self.total_a_pagar) - Decimal(self.pagado)
        return s if s > 0 else Decimal("0.00")

    def recalc_importes(self):
        """Recalcula monto_calculado/total según base + coeficiente + descuentos/moras (simples)"""
        base = Decimal(self.monto_base or 0)
        coef = Decimal(self.coeficiente_snapshot or 0)
        calculado = base * (coef / Decimal("100")) if self.usa_coeficiente else base
        self.monto_calculado = (calculado.quantize(Decimal("0.01")))
        total = self.monto_calculado - Decimal(self.descuento_aplicado or 0) + Decimal(self.mora_aplicada or 0)
        self.total_a_pagar = (total if total > 0 else Decimal("0.00")).quantize(Decimal("0.01"))

    def recalc_estado(self, today=None):
        today = today or date.today()
        if not self.is_active:
            self.estado = "ANULADA"
            return
        if self.pagado >= self.total_a_pagar and self.total_a_pagar > 0:
            self.estado = "PAGADA"
        elif self.pagado > 0 and self.pagado < self.total_a_pagar:
            self.estado = "PARCIAL"
        else:
            # sin pagos
            if today > self.vencimiento and self.total_a_pagar > 0:
                self.estado = "VENCIDA"
            else:
                self.estado = "PENDIENTE"

    def apply_simple_mora(self, mora_fija=Decimal("0.00")):
        """Ejemplo simple de mora fija si está vencida y tiene saldo."""
        if date.today() > self.vencimiento and self.saldo > 0 and mora_fija > 0:
            self.mora_aplicada = (Decimal(self.mora_aplicada) + Decimal(mora_fija)).quantize(Decimal("0.01"))
            self.recalc_importes()
            self.recalc_estado()

class Pago(models.Model):
    MEDIO_CHOICES = [
        ("EFECTIVO", "Efectivo"),
        ("TRANSFERENCIA", "Transferencia"),
        ("TARJETA", "Tarjeta"),
        ("OTRO", "Otro"),
    ]
    cuota = models.ForeignKey(Cuota, on_delete=models.PROTECT, related_name="pagos")
    fecha_pago = models.DateField(auto_now_add=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    medio = models.CharField(max_length=20, choices=MEDIO_CHOICES, default="EFECTIVO")
    referencia = models.CharField(max_length=100, blank=True)
    valido = models.BooleanField(default=True)
    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="pagos_cargados")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Pago {self.id} · Cuota {self.cuota_id} · {self.monto}"

    def aplicar(self):
        if not self.valido:
            return
        self.cuota.pagado = (Decimal(self.cuota.pagado) + Decimal(self.monto)).quantize(Decimal("0.01"))
        self.cuota.recalc_estado()
        self.cuota.save(update_fields=["pagado", "estado", "updated_at"])

    def revertir(self):
        if not self.valido:
            return
        self.valido = False
        self.save(update_fields=["valido"])
        self.cuota.pagado = (Decimal(self.cuota.pagado) - Decimal(self.monto))
        if self.cuota.pagado < 0:
            self.cuota.pagado = Decimal("0.00")
        self.cuota.recalc_estado()
        self.cuota.save(update_fields=["pagado", "estado", "updated_at"])
        
#GESTIONAR INFRACCIONES

class Infraccion(models.Model):
    TIPO_CHOICES = [
        ("RUIDO", "Ruido"),
        ("MASCOTA", "Mascota"),
        ("ESTACIONAMIENTO", "Estacionamiento indebido"),
        ("DANOS", "Daños"),
        ("OTRA", "Otra"),
    ]
    ESTADO_CHOICES = [
        ("PENDIENTE", "Pendiente"),
        ("RESUELTA", "Resuelta"),
        ("ANULADA", "Anulada"),
    ]

    unidad = models.ForeignKey("smartcondominio.Unidad", on_delete=models.PROTECT, related_name="infracciones")
    # 🔧 antes: ForeignKey("smartcondominio.Residente") -> no existe
    residente = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="infracciones")

    fecha = models.DateField(default=timezone.now)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    descripcion = models.TextField(blank=True)
    monto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    evidencia_url = models.URLField(blank=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")

    is_active = models.BooleanField(default=True)
    creado_por = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="infracciones_creadas")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.unidad_id} • {self.tipo} • {self.estado}"
    
# --- CU13: Avisos / Comunicados (sin FileField) ---
from django.utils import timezone

class Aviso(models.Model):
    AUDIENCE_CHOICES = [
        ("ALL", "Todos"),
        ("TORRE", "Por torre"),
        ("UNIDAD", "Por unidad"),
        ("ROL", "Por rol"),
    ]
    STATUS_CHOICES = [
        ("BORRADOR", "Borrador"),
        ("PROGRAMADO", "Programado"),
        ("PUBLICADO", "Publicado"),
        ("ARCHIVADO", "Archivado"),
    ]

    titulo = models.CharField(max_length=200)
    cuerpo = models.TextField()

    # audiencia
    audiencia = models.CharField(max_length=10, choices=AUDIENCE_CHOICES, default="ALL")
    torre = models.CharField(max_length=100, blank=True)  # cuando audiencia=TORRE
    unidades = models.ManyToManyField("smartcondominio.Unidad", blank=True)
    roles = models.ManyToManyField("smartcondominio.Rol", blank=True)

    # publicación
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="BORRADOR")
    publish_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # notificación (placeholders)
    notify_inapp = models.BooleanField(default=True)
    notify_email = models.BooleanField(default=False)
    notify_push = models.BooleanField(default=False)

    # adjuntos como URLs (Drive/S3/lo que uses)
    adjuntos = models.JSONField(default=list, blank=True)  # p.ej: ["https://.../archivo.pdf", ...]

    # auditoría
    creado_por = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="avisos_creados")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-publish_at", "-created_at"]
        indexes = [
            models.Index(fields=["audiencia", "status"]),
            models.Index(fields=["publish_at"]),
        ]

    def __str__(self):
        return f"[{self.status}] {self.titulo}"

    def es_visible(self, now=None):
        now = now or timezone.now()
        if not self.is_active:
            return False
        if self.status != "PUBLICADO":
            return False
        if self.publish_at and self.publish_at > now:
            return False
        if self.expires_at and self.expires_at < now:
            return False
        return True

    def publicar_ahora(self):
        self.status = "PUBLICADO"
        if not self.publish_at:
            self.publish_at = timezone.now()

# ====== TAREAS (CU15/CU24) ======

from django.db import models
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

User = get_user_model()

class Tarea(models.Model):
    PRIORIDAD_CHOICES = [
        ("BAJA", "Baja"),
        ("MEDIA", "Media"),
        ("ALTA", "Alta"),
        ("URGENTE", "Urgente"),
    ]
    ESTADO_CHOICES = [
        ("NUEVA", "Nueva"),
        ("ASIGNADA", "Asignada"),
        ("EN_PROGRESO", "En progreso"),
        ("BLOQUEADA", "Bloqueada"),
        ("COMPLETADA", "Completada"),
        ("CANCELADA", "Cancelada"),
    ]

    # Básico
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)

    # Contexto
    unidad = models.ForeignKey("smartcondominio.Unidad", null=True, blank=True, on_delete=models.SET_NULL, related_name="tareas")

    # Asignación
    asignado_a = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="tareas_asignadas")
    asignado_a_rol = models.ForeignKey("smartcondominio.Rol", null=True, blank=True, on_delete=models.SET_NULL, related_name="tareas_de_rol")
    watchers = models.ManyToManyField(User, blank=True, related_name="tareas_watch")

    # Gestión
    prioridad = models.CharField(max_length=10, choices=PRIORIDAD_CHOICES, default="MEDIA")
    estado = models.CharField(max_length=12, choices=ESTADO_CHOICES, default="NUEVA")
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_limite = models.DateField(null=True, blank=True)

    # Adjuntos/Checklist (como URLs/ítems para no usar FileField en Render)
    adjuntos = models.JSONField(default=list, blank=True)
    checklist = models.JSONField(default=list, blank=True)  # [{text: str, done: bool}]

    # Auditoría
    creado_por = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="tareas_creadas")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        permissions = [
            ("manage_tasks", "Puede gestionar y asignar tareas"),  # 👈 nuevo
        ]
    def __str__(self):
        return f"[{self.id}] {self.titulo}"

    @property
    def atrasada(self) -> bool:
        return bool(self.fecha_limite and timezone.localdate() > self.fecha_limite and self.estado not in {"COMPLETADA", "CANCELADA"})

class TareaComentario(models.Model):
    tarea = models.ForeignKey(Tarea, on_delete=models.CASCADE, related_name="comentarios")
    autor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="tarea_comentarios")
    cuerpo = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Coment {self.id} · Tarea {self.tarea_id}"


# ========= CU16: MODELOS DE ÁREAS COMUNES =========
from django.conf import settings
from django.db import models
from django.utils import timezone

class AreaComun(models.Model):
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True)
    ubicacion = models.CharField(max_length=120, blank=True)
    capacidad = models.PositiveIntegerField(default=1)
    costo_por_hora = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    activa = models.BooleanField(default=True)
    requiere_aprobacion = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Área Común"
        verbose_name_plural = "Áreas Comunes"

    def __str__(self):
        return self.nombre


class AreaDisponibilidad(models.Model):
    """
    Ventanas de disponibilidad por día de la semana (0=Lunes ... 6=Domingo).
    """
    DIA_CHOICES = [
        (0, "Lunes"), (1, "Martes"), (2, "Miércoles"),
        (3, "Jueves"), (4, "Viernes"), (5, "Sábado"), (6, "Domingo"),
    ]
    area = models.ForeignKey(AreaComun, on_delete=models.CASCADE, related_name="reglas")
    dia_semana = models.SmallIntegerField(choices=DIA_CHOICES)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    max_horas_por_reserva = models.PositiveIntegerField(default=4)

    class Meta:
        ordering = ["area", "dia_semana", "hora_inicio"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(hora_fin__gt=models.F("hora_inicio")),
                name="area_disp_hora_fin_gt_inicio"
            ),
            models.UniqueConstraint(
                fields=["area", "dia_semana", "hora_inicio", "hora_fin"],
                name="area_disp_uniq_window"
            ),
        ]

    def __str__(self):
        return f"{self.area} - {self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"


class ReservaArea(models.Model):
    """
    Usada para calcular disponibilidad (evitar solapamientos).
    CU17/CU18 la usarán para crear/confirmar/cobrar.
    """
    ESTADOS = [
        ("PENDIENTE", "Pendiente"),
        ("CONFIRMADA", "Confirmada"),
        ("PAGADA", "Pagada"),
        ("CANCELADA", "Cancelada"),
        ("RECHAZADA", "Rechazada"),
    ]

    area = models.ForeignKey(AreaComun, on_delete=models.CASCADE, related_name="reservas")
    unidad = models.ForeignKey("smartcondominio.Unidad", on_delete=models.SET_NULL, null=True, blank=True, related_name="reservas_area")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reservas_area")

    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    estado = models.CharField(max_length=12, choices=ESTADOS, default="PENDIENTE")

    monto_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nota = models.TextField(blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["area", "fecha_inicio", "fecha_fin"]),
            models.Index(fields=["estado"]),
        ]
        ordering = ["-fecha_inicio"]

    def __str__(self):
        return f"{self.area} {self.fecha_inicio} - {self.fecha_fin} ({self.estado})"

from django.db import models
from django.contrib.auth.models import User, Permission
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.validators import MinValueValidator, MaxValueValidator

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
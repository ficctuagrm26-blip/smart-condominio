from django.contrib import admin
from .models import Profile, Unidad

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")       # columnas en la lista
    search_fields = ("user__username",)   # búsqueda por nombre de usuario
    list_filter = ("role",)               # filtros por rol

@admin.register(Unidad)
class UnidadAdmin(admin.ModelAdmin):
    list_display = (      # columnas que se mostrarán en la tabla del admin
        "id", "torre", "bloque", "numero",
        "tipo", "estado", "propietario", "residente", "is_active"
    )
    list_filter = (       # filtros en la barra lateral
        "torre", "tipo", "estado", "is_active"
    )
    search_fields = (     # campos por los que se podrá buscar en el admin
        "torre", "bloque", "numero"
    )
from .models import Aviso

@admin.register(Aviso)
class AvisoAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "audiencia", "status", "publish_at", "creado_por", "is_active")
    list_filter = ("audiencia", "status", "is_active")
    search_fields = ("titulo", "cuerpo", "torre")
    filter_horizontal = ("unidades", "roles")

from .models import Tarea, TareaComentario

@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "prioridad", "estado", "asignado_a", "asignado_a_rol", "unidad", "fecha_limite", "creado_por", "is_active")
    list_filter = ("prioridad", "estado", "asignado_a_rol", "is_active")
    search_fields = ("titulo", "descripcion", "asignado_a__username", "creado_por__username", "unidad__torre", "unidad__numero")

@admin.register(TareaComentario)
class TareaComentarioAdmin(admin.ModelAdmin):
    list_display = ("id", "tarea", "autor", "created_at")
    search_fields = ("tarea__titulo", "autor__username", "cuerpo")
    
from django.contrib import admin
from .models import AreaComun, AreaDisponibilidad, ReservaArea

@admin.register(AreaComun)
class AreaComunAdmin(admin.ModelAdmin):
    list_display = ("id","nombre","capacidad","activa","requiere_aprobacion","costo_por_hora")
    search_fields = ("nombre","ubicacion")
    list_filter = ("activa","requiere_aprobacion")

@admin.register(AreaDisponibilidad)
class AreaDisponibilidadAdmin(admin.ModelAdmin):
    list_display = ("area","dia_semana","hora_inicio","hora_fin","max_horas_por_reserva")
    list_filter = ("area","dia_semana")

@admin.register(ReservaArea)
class ReservaAreaAdmin(admin.ModelAdmin):
    list_display = ("area","fecha_inicio","fecha_fin","estado","usuario","unidad","monto_total")
    list_filter = ("estado","area")
    search_fields = ("nota",)

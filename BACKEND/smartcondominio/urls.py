# urls.py
from django.urls import path
from .views_api import QRPayableCuotasView
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views_face_dry import FaceIdentifyAWSDryRunView
from .views_face import FaceRegisterAWSView, FaceIdentifyAndLogAWSView
from .views_api import (
    # Auth / perfil
    RegisterView, me, me_update, change_password,
    # ViewSets
    AdminUserViewSet, RolViewSet, PermissionViewSet,
    UnidadViewSet, CuotaViewSet, PagoViewSet, InfraccionViewSet,
     TareaViewSet, AreaComunViewSet, StaffViewSet,
    VisitorViewSet, VisitViewSet, VehiculoViewSet, SolicitudVehiculoViewSet,
    # Vistas de Estado de cuenta
    EstadoCuentaView, EstadoCuentaExportCSV,
    # Mock pagos
    MockCheckoutView, MockUploadReceiptView, MockVerifyReceiptView, SnapshotCheckView, SnapshotPingView, MockPayView, MockIntentMineView, MockIntentDashboardView, MyCuotasConSaldoView,
    PagoComprobanteViewSet, AvisoAdminViewSet, AvisoPublicViewSet,
    AccessEventViewSet, FaceAccessEventViewSet
    
)

router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')
router.register(r'roles', RolViewSet, basename='roles')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'unidades', UnidadViewSet, basename='unidades')
router.register(r'cuotas', CuotaViewSet, basename='cuotas')
router.register(r'pagos', PagoViewSet, basename='pagos')
router.register(r'infracciones', InfraccionViewSet, basename='infracciones')

router.register(r'tareas', TareaViewSet, basename='tareas')
router.register(r'areas-comunes', AreaComunViewSet, basename='areas-comunes')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'visitors', VisitorViewSet, basename='visitors')
router.register(r'visits', VisitViewSet, basename='visits')
router.register(r'vehiculos', VehiculoViewSet, basename='vehiculos')
router.register(r'solicitudes-vehiculo', SolicitudVehiculoViewSet, basename='solicitudes-vehiculo')
router.register(r'pagos-comprobantes', PagoComprobanteViewSet, basename='pago-comprobante')
router.register(r'admin/avisos', AvisoAdminViewSet, basename='admin-avisos')
router.register(r'avisos', AvisoPublicViewSet, basename='avisos-public')
router.register(r'access/events', AccessEventViewSet, basename='access-events')
router.register(r'access/face-events', FaceAccessEventViewSet, basename='face-events')

urlpatterns = [
    # Auth / perfil
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', obtain_auth_token, name='token_login'),
    path('auth/me/', me, name='me'),
    path('auth/me/update/', me_update, name='me-update'),
    path('auth/change-password/', change_password, name='change-password'),

    # Estado de cuenta
    path('estado-cuenta/', EstadoCuentaView.as_view(), name='estado-cuenta'),
    path('estado-cuenta/export/', EstadoCuentaExportCSV.as_view(), name='estado-cuenta-export'),

    # Mock pagos
     path("pagos/mock/checkout/", MockCheckoutView.as_view(), name="api-mock-checkout"),
    path("pagos/mock/receipt/",  MockUploadReceiptView.as_view(), name="api-mock-receipt"),
    path("pagos/mock/verify/",   MockVerifyReceiptView.as_view(), name="api-mock-verify"),
    path("pagos/mock/pay/",      MockPayView.as_view(),           name="api-mock-pay"),          # ⬅️ aterrizaje QR
    path("pagos/mock/intents/mine/",      MockIntentMineView.as_view(),      name="api-mock-intents-mine"),
    path("pagos/mock/intents/dashboard/", MockIntentDashboardView.as_view(), name="api-mock-intents-dash"),
    path("access/snapshot-check/", SnapshotCheckView.as_view(), name="snapshot-check"),
    path("access/snapshot-ping/", SnapshotPingView.as_view()),
    #IA
    path("face/register-aws/", FaceRegisterAWSView.as_view(), name="face-register-aws"),
    path("face/identify-and-log-aws/", FaceIdentifyAndLogAWSView.as_view(), name="face-identify-and-log-aws"),
     path("face/identify-aws-dry/", FaceIdentifyAWSDryRunView.as_view(), name="face-identify-aws-dry"),
      path('pagos/mock/mis-cuotas-con-saldo/', MyCuotasConSaldoView.as_view(), name='mock-mis-cuotas-saldo'),
    path("pagos/qr/pendientes/", QRPayableCuotasView.as_view(), name="qr-cuotas-pendientes"),
    

]

# Rutas del router
urlpatterns += router.urls


from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SedeViewSet, FinancieraViewSet, ReglaDisponibilidadViewSet,
    CitaViewSet, DisponibilidadView, HistoricoView, RemitenteViewSet,
)

router = DefaultRouter()
router.register('sedes', SedeViewSet, basename='sede')
router.register('financieras', FinancieraViewSet, basename='financiera')
router.register('reglas', ReglaDisponibilidadViewSet, basename='regla')
router.register('citas', CitaViewSet, basename='cita')
router.register('remitentes', RemitenteViewSet, basename='remitente')

urlpatterns = [
    path('', include(router.urls)),
    path('disponibilidad/', DisponibilidadView.as_view(), name='disponibilidad'),
    path('historico/', HistoricoView.as_view(), name='historico'),
]
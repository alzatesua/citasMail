from datetime import date
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Sede, Financiera, ReglaDisponibilidad, Cita, Remitente
from .serializers import (
    SedeSerializer, FinancieraSerializer,
    ReglaDisponibilidadSerializer, CitaSerializer,
    RemitenteSerializer,
)
from .tasks import notificar_cita_creada
from .disponibilidad import disponibilidad_semana, disponibilidad_mes, disponibilidad_anio


class SedeViewSet(viewsets.ModelViewSet):
    queryset = Sede.objects.all()
    serializer_class = SedeSerializer
    permission_classes = [IsAuthenticated]


class FinancieraViewSet(viewsets.ModelViewSet):
    queryset = Financiera.objects.all()
    serializer_class = FinancieraSerializer
    permission_classes = [IsAuthenticated]


class ReglaDisponibilidadViewSet(viewsets.ModelViewSet):
    queryset = ReglaDisponibilidad.objects.all()
    serializer_class = ReglaDisponibilidadSerializer
    permission_classes = [IsAuthenticated]


class CitaViewSet(viewsets.ModelViewSet):
    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Cita.objects.all().select_related('sede', 'financiera')
        sede_id = self.request.query_params.get('sede')
        estado = self.request.query_params.get('estado')
        if sede_id:
            qs = qs.filter(sede_id=sede_id)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        cita = serializer.save(creado_por=self.request.user)
        notificar_cita_creada.delay(cita.id)

class DisponibilidadView(APIView):
    """
    GET /api/calendario/disponibilidad/?sede=1&anio=2026&mes=8
    GET /api/calendario/disponibilidad/?sede=1&anio=2026&semana=33
    GET /api/calendario/disponibilidad/?sede=1&anio=2026
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sede_id = request.query_params.get('sede')
        anio = request.query_params.get('anio')
        mes = request.query_params.get('mes')
        semana = request.query_params.get('semana')

        if not sede_id or not anio:
            return Response(
                {'error': 'Los parámetros sede y anio son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sede = get_object_or_404(Sede, pk=sede_id)
        anio = int(anio)

        if semana:
            datos = disponibilidad_semana(sede, anio, int(semana))
        elif mes:
            datos = disponibilidad_mes(sede, anio, int(mes))
        else:
            datos = disponibilidad_anio(sede, anio)

        return Response({
            'sede': sede.nombre,
            'anio': anio,
            'mes': mes,
            'semana': semana,
            'dias': datos,
        })


class HistoricoView(APIView):
    """
    GET /api/calendario/historico/?sede=1&anio=2026&mes=6
    Devuelve las citas de meses/años anteriores (o cualquier rango solicitado).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sede_id = request.query_params.get('sede')
        anio = request.query_params.get('anio')
        mes = request.query_params.get('mes')

        qs = Cita.objects.all().select_related('sede', 'financiera')
        if sede_id:
            qs = qs.filter(sede_id=sede_id)
        if anio:
            qs = qs.filter(fecha__year=int(anio))
        if mes:
            qs = qs.filter(fecha__month=int(mes))

        qs = qs.order_by('-fecha')
        serializer = CitaSerializer(qs, many=True)
        return Response(serializer.data)


class RemitenteViewSet(viewsets.ModelViewSet):
    serializer_class = RemitenteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Remitente.objects.select_related('sede').all()
        sede_id = self.request.query_params.get('sede')
        if sede_id:
            qs = qs.filter(sede_id=sede_id)
        return qs
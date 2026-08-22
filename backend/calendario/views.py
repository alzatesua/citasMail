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

from rest_framework.decorators import action
from .google_calendar import crear_calendario_para_sede

from .models import Remitente
from .google_calendar import compartir_calendario_con_remitente
from django.utils import timezone
from .tasks import notificar_cita_creada, notificar_cita_whatsapp
from django.conf import settings



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
        notificar_cita_whatsapp.delay(cita.id) 

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
    GET /api/calendario/historico/?sede=1&fecha_inicio=2026-01-01&fecha_fin=2026-06-30

    Devuelve las citas de meses/años anteriores (o cualquier rango solicitado).

    Si se envían fecha_inicio y/o fecha_fin, esos parámetros tienen prioridad
    y se ignoran anio/mes. Si no se envía ninguno de los dos, se usa el
    filtro clásico por año/mes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sede_id = request.query_params.get('sede')
        anio = request.query_params.get('anio')
        mes = request.query_params.get('mes')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        qs = Cita.objects.all().select_related('sede', 'financiera')

        if sede_id:
            qs = qs.filter(sede_id=sede_id)

        if fecha_inicio or fecha_fin:
            # Filtro por rango explícito de fechas (formato YYYY-MM-DD)
            if fecha_inicio:
                qs = qs.filter(fecha__gte=fecha_inicio)
            if fecha_fin:
                qs = qs.filter(fecha__lte=fecha_fin)
        else:
            # Filtro clásico por año/mes (compatibilidad con lo que ya existía)
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

    def perform_create(self, serializer):
        remitente = serializer.save()
        sede = remitente.sede

        if not sede.google_calendar_id:
            calendar_id = crear_calendario_para_sede(sede, remitente.correo)
            sede.google_calendar_id = calendar_id
            sede.save(update_fields=['google_calendar_id'])
            remitente.calendario_compartido = True
            remitente.calendario_compartido_en = timezone.now()
            remitente.save(update_fields=['calendario_compartido', 'calendario_compartido_en'])
        else:
            try:
                compartir_calendario_con_remitente(sede, remitente.correo)
                remitente.calendario_compartido = True
                remitente.calendario_compartido_en = timezone.now()
                remitente.save(update_fields=['calendario_compartido', 'calendario_compartido_en'])
            except Exception as e:
                print(f"[perform_create Remitente] ERROR al compartir: {e}")

class SedeViewSet(viewsets.ModelViewSet):
    queryset = Sede.objects.all()
    serializer_class = SedeSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='crear-calendario')
    def crear_calendario(self, request, pk=None):
        sede = self.get_object()
        correo = request.data.get('correo')

        if not correo:
            return Response(
                {'error': 'El campo correo es obligatorio (a quién compartir el calendario).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            calendar_id = crear_calendario_para_sede(sede, correo)
        except Exception as e:
            return Response(
                {'error': f'Error creando el calendario: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        calendario_anterior = sede.google_calendar_id
        sede.google_calendar_id = calendar_id
        sede.save(update_fields=['google_calendar_id'])

        return Response({
            'sede': sede.nombre,
            'google_calendar_id': calendar_id,
            'calendario_anterior': calendario_anterior,
            'compartido_con': correo,
        })

    @action(detail=True, methods=['patch'], url_path='calendario-id')
    def actualizar_calendario_id(self, request, pk=None):
        """
        Asigna o modifica manualmente el google_calendar_id de la sede,
        sin crear un calendario nuevo en Google.
        """
        sede = self.get_object()
        nuevo_id = request.data.get('google_calendar_id')

        if not nuevo_id:
            return Response(
                {'error': 'El campo google_calendar_id es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        calendario_anterior = sede.google_calendar_id
        sede.google_calendar_id = nuevo_id
        sede.save(update_fields=['google_calendar_id'])

        return Response({
            'sede': sede.nombre,
            'google_calendar_id': sede.google_calendar_id,
            'calendario_anterior': calendario_anterior,
        })

    @action(detail=True, methods=['post'], url_path='sincronizar-remitentes')
    def sincronizar_remitentes(self, request, pk=None):
        """
        Comparte el calendario de la sede con todos los remitentes activos
        que aún no lo tengan compartido. No repite con los que ya lo tienen.
        """
        sede = self.get_object()

        if not sede.google_calendar_id:
            return Response(
                {'error': 'Esta sede no tiene un calendario configurado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pendientes = sede.remitentes.filter(activo=True, calendario_compartido=False)

        resultados = {'compartidos': [], 'fallidos': []}

        for remitente in pendientes:
            try:
                compartir_calendario_con_remitente(sede, remitente.correo)
                remitente.calendario_compartido = True
                remitente.calendario_compartido_en = timezone.now()
                remitente.save(update_fields=['calendario_compartido', 'calendario_compartido_en'])
                resultados['compartidos'].append(remitente.correo)
            except Exception as e:
                resultados['fallidos'].append({'correo': remitente.correo, 'error': str(e)})

        return Response({
            'sede': sede.nombre,
            'ya_compartidos_previamente': sede.remitentes.filter(
                activo=True, calendario_compartido=True
            ).exclude(correo__in=resultados['compartidos']).count(),
            'compartidos_ahora': resultados['compartidos'],
            'fallidos': resultados['fallidos'],
        })

class WhatsAppConfirmacionWebhookView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        token = request.headers.get('X-Whatsapp-Bot-Token')
        if token != settings.WHATSAPP_BOT_WEBHOOK_TOKEN:
            return Response({'error': 'Token inválido.'}, status=status.HTTP_401_UNAUTHORIZED)

        boton_id = request.data.get('boton_id', '')
        if not boton_id.startswith('confirmar_cita_'):
            return Response({'error': 'boton_id inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        cita_id = boton_id.replace('confirmar_cita_', '')
        cita = get_object_or_404(Cita, pk=cita_id)

        cita.confirmado_whatsapp = True
        cita.confirmado_whatsapp_en = timezone.now()
        cita.estado = 'confirmada'
        cita.save(update_fields=['confirmado_whatsapp', 'confirmado_whatsapp_en', 'estado'])

        return Response({'ok': True, 'cita': cita.id, 'estado': cita.estado})
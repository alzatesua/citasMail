from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from .models import Cita, Recordatorio
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def generar_recordatorios():
    """
    Corre diariamente. Revisa qué citas activas caen exactamente
    8 días o 1 día a partir de hoy, y registra el recordatorio en BD
    (sin enviarlo todavía).
    """
    hoy = timezone.localdate()
    fecha_8_dias = hoy + timedelta(days=8)
    fecha_1_dia = hoy + timedelta(days=1)

    creados = []

    citas_8 = Cita.objects.filter(
        fecha=fecha_8_dias
    ).exclude(estado='cancelada')
    for cita in citas_8:
        _, fue_creado = Recordatorio.objects.get_or_create(cita=cita, tipo='8_dias')
        if fue_creado:
            creados.append((cita.id, '8_dias'))

    citas_1 = Cita.objects.filter(
        fecha=fecha_1_dia
    ).exclude(estado='cancelada')
    for cita in citas_1:
        _, fue_creado = Recordatorio.objects.get_or_create(cita=cita, tipo='1_dia')
        if fue_creado:
            creados.append((cita.id, '1_dia'))

    return f"Recordatorios generados: {creados}"






@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notificar_cita_creada(self, cita_id):
    from .models import Cita
    from .google_calendar import crear_evento_cita

    try:
        cita = Cita.objects.select_related('sede', 'financiera').get(pk=cita_id)
        remitentes = cita.sede.remitentes.filter(activo=True)

        if not remitentes.exists():
            return f"Sede {cita.sede.nombre} sin remitentes activos, nada que notificar."

        # 1. Correo
        destinatarios = list(remitentes.values_list('correo', flat=True))
        send_mail(
            subject=f'Nueva cita agendada — {cita.sede.nombre}',
            message=(
                f'Se agendó una cita para la sede {cita.sede.nombre}.\n'
                f'Financiera: {cita.financiera.nombre}\n'
                f'Fecha: {cita.fecha}\n'
                f'Hora: {cita.hora}\n'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=destinatarios,
            fail_silently=False,
        )

        # 2. Google Calendar
        event_id = crear_evento_cita(cita)
        if event_id:
            cita.google_event_id = event_id
            cita.save(update_fields=['google_event_id'])

        return f"Notificación enviada a {len(destinatarios)} remitentes de {cita.sede.nombre}."

    except Exception as exc:
        raise self.retry(exc=exc)
# calendario/google_calendar.py
from datetime import datetime, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build
from django.conf import settings

SCOPES = ['https://www.googleapis.com/auth/calendar']

def _get_service():
    credentials = service_account.Credentials.from_service_account_file(
        settings.GOOGLE_CALENDAR_CREDENTIALS_PATH, scopes=SCOPES
    )
    return build('calendar', 'v3', credentials=credentials)


def crear_evento_cita(cita):
    if not cita.sede.google_calendar_id:
        return None

    service = _get_service()
    inicio = datetime.combine(cita.fecha, cita.hora)
    fin = inicio + timedelta(hours=1)  # ajusta la duración por defecto que uses

    evento = {
        'summary': f'Cita - {cita.financiera.nombre}',
        'description': f'Cita agendada para la sede {cita.sede.nombre}',
        'start': {'dateTime': inicio.isoformat(), 'timeZone': 'America/Bogota'},
        'end': {'dateTime': fin.isoformat(), 'timeZone': 'America/Bogota'},
    }

    creado = service.events().insert(
        calendarId=cita.sede.google_calendar_id,
        body=evento,
    ).execute()

    return creado.get('id')




def crear_calendario_para_sede(sede, compartir_con_correo):
    """
    Crea un calendario nuevo en Google Calendar, lo comparte con un correo
    humano para que se pueda visualizar, y devuelve el ID generado.
    """
    service = _get_service()

    calendario_body = {
        'summary': f'Citas {sede.nombre}',
        'description': f'Calendario de citas para la sede {sede.nombre}',
        'timeZone': 'America/Bogota',
    }

    calendario_creado = service.calendars().insert(body=calendario_body).execute()
    calendar_id = calendario_creado['id']

    # El calendario lo crea la cuenta de servicio y por defecto solo ella lo ve.
    # Lo compartimos con un correo humano para poder verlo desde Gmail normal.
    regla_acceso = {
        'role': 'writer',
        'scope': {
            'type': 'user',
            'value': compartir_con_correo,
        },
    }
    service.acl().insert(calendarId=calendar_id, body=regla_acceso).execute()

    return calendar_id


def compartir_calendario_con_remitente(sede, correo):
    """
    Da acceso de lectura al calendario de la sede a un remitente específico.
    A diferencia de 'attendees' en eventos, esto sí funciona con cuentas de servicio.
    """
    if not sede.google_calendar_id:
        return None

    service = _get_service()
    regla_acceso = {
        'role': 'reader',  # o 'writer' si quieres que puedan editar eventos
        'scope': {
            'type': 'user',
            'value': correo,
        },
    }
    return service.acl().insert(
        calendarId=sede.google_calendar_id,
        body=regla_acceso,
    ).execute()
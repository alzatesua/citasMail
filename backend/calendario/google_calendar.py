# calendario/google_calendar.py
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
        'attendees': [
            {'email': r.correo}
            for r in cita.sede.remitentes.filter(activo=True)
        ],
    }

    creado = service.events().insert(
        calendarId=cita.sede.google_calendar_id,
        body=evento,
        sendUpdates='all',  # notifica a los invitados por correo también
    ).execute()

    return creado.get('id')
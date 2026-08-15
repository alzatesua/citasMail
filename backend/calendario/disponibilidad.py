import calendar
from datetime import date, timedelta
from .models import Cita, ReglaDisponibilidad
DIAS_SEMANA_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

def _dias_no_disponibles_por_regla(sede):
    """Devuelve el set de dia_semana (0=lunes) cerrados para la sede.
    Por defecto: sábado(5) y domingo(6) cerrados, salvo que exista regla explícita."""
    reglas = {r.dia_semana: r.disponible for r in sede.reglas.all()}
    cerrados = set()
    for dia in range(7):
        if dia in reglas:
            if not reglas[dia]:
                cerrados.add(dia)
        else:
            if dia in (5, 6):  # regla por defecto: fin de semana cerrado
                cerrados.add(dia)
    return cerrados


def calcular_disponibilidad(sede, fecha_inicio: date, fecha_fin: date):
    """
    Devuelve lista de dicts por cada día en el rango:
    {fecha, disponible, motivo, citas: [{financiera, hora, estado}]}
    """
    cerrados = _dias_no_disponibles_por_regla(sede)

    citas_rango = Cita.objects.filter(
        sede=sede, fecha__range=(fecha_inicio, fecha_fin)
    ).exclude(estado='cancelada').select_related('financiera')

    citas_por_fecha = {}
    for cita in citas_rango:
        citas_por_fecha.setdefault(cita.fecha, []).append(cita)

    resultado = []
    dia_actual = fecha_inicio
    while dia_actual <= fecha_fin:
        dia_semana = dia_actual.weekday()  # 0=lunes
        citas_dia = citas_por_fecha.get(dia_actual, [])

        if dia_semana in cerrados:
            disponible = False
            motivo = 'Día no laborable para esta sede'
        elif len(citas_dia) > 0:
            disponible = True  # sigue disponible para otra financiera, salvo que definas cupo máximo
            motivo = 'Con citas agendadas'
        else:
            disponible = True
            motivo = 'Libre'

        resultado.append({
            'fecha': dia_actual.isoformat(),
            'dia_semana': DIAS_SEMANA_ES[dia_actual.weekday()],
            'disponible': disponible,
            'motivo': motivo,
            'citas': [
                {
                    'financiera': c.financiera.nombre,
                    'hora': c.hora.isoformat() if c.hora else None,
                    'estado': c.estado,
                } for c in citas_dia
            ],
        })
        dia_actual += timedelta(days=1)

    return resultado


def disponibilidad_semana(sede, anio, semana):
    """ISO week: semana 1-53"""
    fecha_inicio = date.fromisocalendar(anio, semana, 1)  # lunes
    fecha_fin = fecha_inicio + timedelta(days=6)
    return calcular_disponibilidad(sede, fecha_inicio, fecha_fin)


def disponibilidad_mes(sede, anio, mes):
    fecha_inicio = date(anio, mes, 1)
    ultimo_dia = calendar.monthrange(anio, mes)[1]
    fecha_fin = date(anio, mes, ultimo_dia)
    return calcular_disponibilidad(sede, fecha_inicio, fecha_fin)


def disponibilidad_anio(sede, anio):
    fecha_inicio = date(anio, 1, 1)
    fecha_fin = date(anio, 12, 31)
    return calcular_disponibilidad(sede, fecha_inicio, fecha_fin)
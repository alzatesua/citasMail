from django.contrib import admin
from .models import Sede, Financiera, ReglaDisponibilidad, Cita, Recordatorio


admin.site.register(Sede)
admin.site.register(Financiera)
admin.site.register(ReglaDisponibilidad)
admin.site.register(Cita)
admin.site.register(Recordatorio)
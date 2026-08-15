from django.db import models
from django.core.exceptions import ValidationError


class Sede(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    google_calendar_id = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="ID del calendario de Google compartido con la cuenta de servicio"
    )
    ciudad = models.CharField(max_length=100)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Financiera(models.Model):
    """PAYJOY, ALO, KREDIYA, KREDIYA-150, etc."""
    nombre = models.CharField(max_length=50, unique=True)
    codigo = models.CharField(max_length=20, unique=True)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class ReglaDisponibilidad(models.Model):
    """
    Define qué días de la semana NO están disponibles para una sede.
    Ej: Armenia no abre los lunes -> Sede=Armenia, dia_semana=0, disponible=False
    """
    DIAS_SEMANA = [
        (0, 'Lunes'), (1, 'Martes'), (2, 'Miércoles'),
        (3, 'Jueves'), (4, 'Viernes'), (5, 'Sábado'), (6, 'Domingo'),
    ]

    sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='reglas')
    dia_semana = models.IntegerField(choices=DIAS_SEMANA)
    disponible = models.BooleanField(default=False)

    class Meta:
        unique_together = ('sede', 'dia_semana')

    def __str__(self):
        return f"{self.sede} - {self.get_dia_semana_display()}: {'Abre' if self.disponible else 'Cerrado'}"


class Cita(models.Model):
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('confirmada', 'Confirmada'),
        ('cancelada', 'Cancelada'),
        ('realizada', 'Realizada'),
    ]

    sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='citas')
    financiera = models.ForeignKey(Financiera, on_delete=models.PROTECT, related_name='citas')
    fecha = models.DateField()
    hora = models.TimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='pendiente')
    observaciones = models.TextField(blank=True)
    creado_por = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    google_event_id = models.CharField(max_length=255, blank=True, null=True)
    notificacion_enviada = models.BooleanField(default=False)

    class Meta:
        ordering = ['-fecha', 'hora']

    def clean(self):
        # Un mismo día/sede/financiera no puede repetirse si ya hay una cita activa
        qs = Cita.objects.filter(
            sede=self.sede, fecha=self.fecha, financiera=self.financiera
        ).exclude(estado='cancelada').exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError(
                'Ya existe una cita agendada para esta sede, fecha y financiera.'
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sede} - {self.financiera} - {self.fecha}"




class Recordatorio(models.Model):
    """Registro (sin envío real todavía) de recordatorios generados para una cita."""
    TIPOS = [
        ('8_dias', '8 días antes'),
        ('1_dia', '1 día antes'),
    ]

    cita = models.ForeignKey(Cita, on_delete=models.CASCADE, related_name='recordatorios')
    tipo = models.CharField(max_length=10, choices=TIPOS)
    generado_en = models.DateTimeField(auto_now_add=True)
    enviado = models.BooleanField(default=False)  # queda listo para cuando se conecte el envío real

    class Meta:
        unique_together = ('cita', 'tipo')
        ordering = ['-generado_en']

    def __str__(self):
        return f"{self.cita} - {self.get_tipo_display()}"



class Remitente(models.Model):
    sede = models.ForeignKey(
        Sede, on_delete=models.CASCADE, related_name='remitentes'
    )
    nombre = models.CharField(max_length=150)
    correo = models.EmailField()
    whatsapp = models.CharField(max_length=20)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    calendario_compartido = models.BooleanField(default=False)
    calendario_compartido_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('sede', 'correo')

    def __str__(self):
        return f"{self.nombre} ({self.sede.nombre})"
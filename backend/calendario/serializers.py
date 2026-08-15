from rest_framework import serializers
from .models import Sede, Financiera, ReglaDisponibilidad, Cita, Remitente

class SedeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sede
        fields = ['id', 'nombre', 'ciudad', 'activa']


class FinancieraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Financiera
        fields = ['id', 'nombre', 'codigo', 'activa']


class ReglaDisponibilidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReglaDisponibilidad
        fields = ['id', 'sede', 'dia_semana', 'disponible']


class CitaSerializer(serializers.ModelSerializer):
    sede_nombre = serializers.CharField(source='sede.nombre', read_only=True)
    financiera_nombre = serializers.CharField(source='financiera.nombre', read_only=True)

    class Meta:
        model = Cita
        fields = [
            'id', 'sede', 'sede_nombre', 'financiera', 'financiera_nombre',
            'fecha', 'hora', 'estado', 'observaciones',
            'creado_por', 'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['creado_por', 'creado_en', 'actualizado_en']

    def validate(self, data):
        sede = data.get('sede') or getattr(self.instance, 'sede', None)
        fecha = data.get('fecha') or getattr(self.instance, 'fecha', None)
        financiera = data.get('financiera') or getattr(self.instance, 'financiera', None)

        qs = Cita.objects.filter(
            sede=sede, fecha=fecha, financiera=financiera
        ).exclude(estado='cancelada')
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Ya existe una cita agendada para esta sede, fecha y financiera.'
            )
        return data

class RemitenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Remitente
        fields = [
            'id', 'sede', 'nombre', 'correo', 'whatsapp', 'activo',
            'creado_en', 'calendario_compartido', 'calendario_compartido_en',
        ]
        read_only_fields = ['id', 'creado_en', 'calendario_compartido', 'calendario_compartido_en']

    def validate_whatsapp(self, value):
        if not value.startswith('+'):
            raise serializers.ValidationError(
                "El número debe incluir el indicativo, ej: +573001234567"
            )
        return value
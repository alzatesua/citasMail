from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Remitente, Sede
from .google_calendar import compartir_calendario_con_remitente, crear_calendario_para_sede


@receiver(post_save, sender=Remitente)
def compartir_calendario_al_crear_remitente(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.sede.google_calendar_id:
        return
    try:
        compartir_calendario_con_remitente(instance.sede, instance.correo)
        instance.calendario_compartido = True
        instance.calendario_compartido_en = timezone.now()
        instance.save(update_fields=['calendario_compartido', 'calendario_compartido_en'])
    except Exception as e:
        print(f"Error compartiendo calendario con {instance.correo}: {e}")


@receiver(post_save, sender=Sede)
def crear_calendario_al_crear_sede(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.google_calendar_id:
        return
    try:
        calendar_id = crear_calendario_para_sede(instance)
        # Usamos update() en vez de instance.save() para NO disparar
        # post_save de nuevo y evitar un bucle infinito de señales.
        Sede.objects.filter(pk=instance.pk).update(google_calendar_id=calendar_id)
        instance.google_calendar_id = calendar_id
        print(f"Calendario de Google creado para sede '{instance.nombre}': {calendar_id}")
    except Exception as e:
        print(f"Error creando calendario para la sede {instance.nombre}: {e}")
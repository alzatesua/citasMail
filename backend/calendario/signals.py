from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Remitente
from .google_calendar import compartir_calendario_con_remitente


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
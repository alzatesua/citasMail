from django.db import migrations, models


COLORES_FINANCIERAS = {
    'PAYJOY': '#2563EB',
    'ALO': '#16A34A',
    'KREDIYA': '#F59E0B',
    'KREDIYA-150': '#DC2626',
}


def asignar_colores(apps, schema_editor):
    Financiera = apps.get_model('calendario', 'Financiera')
    for financiera in Financiera.objects.all():
        financiera.color = COLORES_FINANCIERAS.get(financiera.codigo, '#7C3AED')
        financiera.save(update_fields=['color'])


class Migration(migrations.Migration):

    dependencies = [
        ('calendario', '0005_cita_notificacion_enviada'),
    ]

    operations = [
        migrations.AddField(
            model_name='financiera',
            name='color',
            field=models.CharField(default='#2563EB', max_length=7),
        ),
        migrations.RunPython(asignar_colores, migrations.RunPython.noop),
    ]

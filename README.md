# API Calendario de Citas

API REST en Django/DRF para agendar citas por sede, con disponibilidad calculada por reglas de horario, notificaciones automáticas por correo y creación de eventos en Google Calendar.

## Stack

- Django + Django REST Framework
- PostgreSQL
- Celery (tareas en segundo plano)
- Redis (broker de Celery)
- Google Calendar API (cuenta de servicio)
- Token Authentication (DRF)

---

## Modelos

| Modelo | Descripción |
|---|---|
| `Sede` | Ubicación física. Tiene `google_calendar_id` para el calendario compartido de esa sede. |
| `Financiera` | Entidad financiera asociada a una cita (PayJoy, Alo, Krediya, etc). |
| `ReglaDisponibilidad` | Define qué días de la semana está cerrada una sede. Por defecto sábado/domingo cerrados. |
| `Cita` | Cita agendada: sede, financiera, fecha, hora, estado. Guarda `google_event_id` tras crear el evento. |
| `Remitente` | Persona a notificar cuando se agenda una cita en su sede. Requiere `correo` y `whatsapp`. |
| `Recordatorio` | Registro de recordatorios generados para una cita (8 días antes / 1 día antes). |

---

## Autenticación

Se usa **Token Authentication** de DRF (no JWT).

```
POST /api/login/
Content-Type: application/json

{
  "username": "tu_usuario",
  "password": "tu_password"
}
```

Respuesta:
```json
{ "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4" }
```

Todas las peticiones autenticadas requieren el header:
```
Authorization: Token <tu_token>
```

---

## Endpoints

Todos bajo el prefijo `/api/calendario/`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET/POST` | `/sedes/` | Listar / crear sedes |
| `GET/PUT/PATCH/DELETE` | `/sedes/{id}/` | Detalle / editar / borrar sede |
| `GET/POST` | `/financieras/` | Listar / crear financieras |
| `GET/POST` | `/reglas/?sede=<id>` | Listar / crear reglas de disponibilidad, filtrable por sede |
| `GET/POST` | `/citas/?sede=<id>&estado=<estado>` | Listar / crear citas, filtrable por sede y estado |
| `GET/POST` | `/remitentes/?sede=<id>` | Listar / crear remitentes, filtrable por sede |
| `GET` | `/disponibilidad/?sede=<id>&anio=<anio>[&mes=<mes>|&semana=<semana>]` | Disponibilidad calculada por año, mes o semana ISO |
| `GET` | `/historico/?sede=<id>&anio=<anio>&mes=<mes>` | Citas de rangos pasados |

### Ejemplo: crear remitente

```bash
curl -X POST http://localhost:8000/api/calendario/remitentes/ \
  -H "Authorization: Token TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sede": 1,
    "nombre": "Recepción Armenia",
    "correo": "recepcion.armenia@empresa.com",
    "whatsapp": "+573001234567"
  }'
```

### Ejemplo: crear cita

```bash
curl -X POST http://localhost:8000/api/calendario/citas/ \
  -H "Authorization: Token TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sede": 1,
    "financiera": 1,
    "fecha": "2026-08-20",
    "hora": "10:00:00"
  }'
```

### Ejemplo: disponibilidad de un mes

```
GET /api/calendario/disponibilidad/?sede=1&anio=2026&mes=8
```

Devuelve, por cada día del mes, si está disponible, el motivo (día no laborable / libre / con citas), y el detalle de citas agendadas. Los nombres de los días vienen en español (`Lunes`, `Martes`, ...).

---

## Notificaciones automáticas al crear una cita

Cuando se hace `POST /citas/`, `CitaViewSet.perform_create` dispara en segundo plano (Celery) la tarea `notificar_cita_creada`, que:

1. Busca los `Remitente` activos (`activo=True`) de la sede de la cita.
2. Envía un correo a todos ellos con los detalles de la cita.
3. Crea un evento en el Google Calendar compartido de esa sede (`Sede.google_calendar_id`), invitando a esos mismos correos.
4. Guarda el `event_id` devuelto por Google en `Cita.google_event_id`.

El campo `whatsapp` de `Remitente` queda guardado pero **no se usa todavía** para enviar mensajes — reservado para integración futura.

---

## Variables de entorno (`.env`)

```dotenv
# Base de datos
DATABASE_URL=postgres://usuario:password@localhost:5432/nombre_db

# Celery / Redis
CELERY_BROKER_URL=redis://localhost:6379/0

# Correo
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL=notificaciones@empresa.com

# Google Calendar
GOOGLE_CALENDAR_CREDENTIALS_PATH=/ruta/absoluta/a/google-calendar-credentials.json
```

⚠️ `google-calendar-credentials.json` nunca debe subirse a git — agrégalo a `.gitignore`.

---

## Levantar el proyecto en desarrollo

```bash
# 1. Entorno virtual
source venv/bin/activate

# 2. Migraciones
python manage.py migrate

# 3. Servidor Django (terminal 1)
python manage.py runserver

# 4. Worker de Celery (terminal 2) — el nombre después de -A es el de la carpeta con celery.py
celery -A config worker -l info

# 5. Verifica que Redis esté activo
redis-cli ping   # debe responder PONG
```

Para depurar tareas de Celery en vivo, observa la terminal del worker justo después de crear una cita — ahí aparece `received` y luego `succeeded`/`FAILURE` con el resultado.

---

## Configurar Google Calendar (cuenta de servicio)

La API crea eventos en un **calendario compartido por sede**, usando una cuenta de servicio de Google (no OAuth de usuario). Pasos completos desde cero:

### 1. Crear el proyecto en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/)
2. Arriba a la izquierda, clic en el selector de proyectos → **"Proyecto nuevo"**
3. Dale un nombre (ej. `creditosMail`) y créalo

### 2. Habilitar la Google Calendar API

1. Menú ☰ → **APIs y servicios** → **Biblioteca**
2. Busca **"Google Calendar API"**
3. Clic en **"Habilitar"**

### 3. Crear la cuenta de servicio

1. Menú ☰ → **APIs y servicios** → **Credenciales**
2. **Crear credenciales** → **Cuenta de servicio**
3. Nombre: `remitentes-calendar`
4. Deja vacías las secciones de "Permisos" y "Principales con acceso" (no se necesitan roles de IAM)
5. **Crear y cerrar**

### 4. Generar y descargar la clave JSON

1. Clic sobre la cuenta de servicio recién creada
2. Pestaña **Claves** → **Agregar clave** → **Crear clave nueva**
3. Tipo **JSON** → **Crear**
4. Se descarga automáticamente a tu carpeta de Descargas

> **Nota:** si al hacer clic en "Crear" aparece el error *"La creación de claves de la cuenta de servicio está inhabilitada"*, tu organización tiene aplicada la política `iam.disableServiceAccountKeyCreation`. Ver sección siguiente para desactivarla.

### 5. Desactivar la política de organización que bloquea la creación de claves (si aplica)

Este bloqueo es común en cuentas de Google Workspace con políticas de seguridad por defecto.

1. Menú ☰ → **IAM y administración** → **Políticas de la organización**
2. Filtra por: `service account key`
3. Puede aparecer **duplicada** (una `iam.managed.disableServiceAccountKeyCreation` y una heredada `iam.disableServiceAccountKeyCreation`) — hay que desactivar **ambas** si ambas muestran Estado "Aplicada"
4. Clic en el nombre de la política → **Administrar política**
5. Si pide un rol adicional (**"Necesitas acceso adicional"**), clic en **"Otorgar acceso"** para asignarte el rol *Administrador de políticas de la organización*
6. Selecciona **"Anular política del elemento superior"**
7. En la regla nueva, en "Aplicación" selecciona **"Desactivado"**
8. **Listo** → **Configurar política**
9. Espera 1-2 minutos a que se propague, y repite el paso 4 (generar la clave)

### 6. Ubicar el archivo JSON en el proyecto

```bash
mv ~/Descargas/*.json ~/ruta/al/proyecto/backend/google-calendar-credentials.json
chmod 600 ~/ruta/al/proyecto/backend/google-calendar-credentials.json
echo "google-calendar-credentials.json" >> .gitignore
```

### 7. Configurar la variable de entorno

En `.env`:
```dotenv
GOOGLE_CALENDAR_CREDENTIALS_PATH=/ruta/absoluta/al/proyecto/backend/google-calendar-credentials.json
```

En `settings.py`:
```python
GOOGLE_CALENDAR_CREDENTIALS_PATH = env('GOOGLE_CALENDAR_CREDENTIALS_PATH')
```

### 8. Compartir un calendario de Google por cada sede

1. Abre el JSON descargado y copia el valor de `"client_email"` (termina en `.iam.gserviceaccount.com`)
2. Entra a [calendar.google.com](https://calendar.google.com/) con tu cuenta normal
3. Crea (o usa) un calendario para la sede, ej. "Citas Armenia"
4. Tres puntos sobre el calendario → **Configuración y uso compartido**
5. **Compartir con determinadas personas** → agrega el `client_email` → permiso **"Hacer cambios en eventos"**
6. En la misma pantalla, sección **"Integrar calendario"**, copia el **ID de calendario** (termina en `@group.calendar.google.com`)
7. Repite por cada sede que necesite su propio calendario

### 9. Guardar el ID del calendario en la Sede

```bash
curl -X PATCH http://localhost:8000/api/calendario/sedes/1/ \
  -H "Authorization: Token TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"google_calendar_id": "abc123...@group.calendar.google.com"}'
```

### 10. Verificar que las credenciales cargan correctamente

```bash
python manage.py shell
```
```python
from django.conf import settings
from google.oauth2 import service_account
c = service_account.Credentials.from_service_account_file(settings.GOOGLE_CALENDAR_CREDENTIALS_PATH)
c.service_account_email
```

Si imprime el correo de la cuenta de servicio sin error, la configuración quedó completa.

---

## Verificar que todo funciona end-to-end

1. `redis-cli ping` → debe responder `PONG`
2. `celery -A config worker -l info` corriendo, con `calendario.tasks.notificar_cita_creada` listada en `[tasks]`
3. Crear un remitente de prueba con un correo real
4. Crear una cita vía `POST /citas/`
5. En la terminal del worker debe aparecer `Task ... succeeded` con el mensaje de cuántos remitentes fueron notificados
6. Revisar la bandeja de correo del remitente de prueba
7. Revisar el calendario de Google de la sede — debe aparecer el evento nuevo
8. Confirmar en base de datos que `Cita.google_event_id` quedó guardado

---

## Pendiente / mejoras futuras

- Envío de notificación por WhatsApp a los remitentes (campo `whatsapp` ya existe en el modelo, sin uso aún)
- Actualizar o cancelar el evento de Google Calendar cuando una cita cambia de estado
- Envío real de los `Recordatorio` (8 días antes / 1 día antes) — actualmente solo se registran, no se despachan
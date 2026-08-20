import re
import requests
from django.conf import settings


class WhatsAppError(Exception):
    pass


def normalizar_numero(numero):
    return re.sub(r'\D', '', numero or '')


def enviar_mensaje_individual_cloud_api(numero, texto, boton_id=None, boton_texto=None):
    """
    Envía un mensaje a un número individual vía WhatsApp Cloud API (Meta).
    Devuelve el wamid del mensaje enviado.
    """
    if not numero:
        raise WhatsAppError("Número vacío.")

    url = f"https://graph.facebook.com/v20.0/{settings.WHATSAPP_CLOUD_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_CLOUD_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    if boton_id and boton_texto:
        payload = {
            "messaging_product": "whatsapp",
            "to": numero,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": texto},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": boton_id, "title": boton_texto}}
                    ]
                },
            },
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": numero,
            "type": "text",
            "text": {"body": texto},
        }

    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("messages", [{}])[0].get("id")
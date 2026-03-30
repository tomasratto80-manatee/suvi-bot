# Suvi Bot — Asistente Contable para Telegram

Bot de Telegram para estudios contables argentinos. Responde consultas sobre vencimientos fiscales (IVA e IIBB) y dudas contables generales usando la API de Anthropic (Claude).

## Requisitos

- Node.js 18 o superior
- Token de bot de Telegram (obtenido con [@BotFather](https://t.me/BotFather))
- API Key de Anthropic ([console.anthropic.com](https://console.anthropic.com))

## Instalación

1. Cloná o descargá el proyecto
2. Instalá las dependencias:
   ```bash
   npm install
   ```
3. Configurá el archivo `.env`:
   ```
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   ANTHROPIC_API_KEY=tu_api_key_aqui
   ```

## Uso

Iniciá el bot con:
```bash
node index.js
```

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `/start` | Mensaje de bienvenida |
| `/ayuda` | Lista de comandos disponibles |
| `/vencimientos` | Tabla de vencimientos del mes para todos los CUITs |
| `/cuit 20-12345678-9` | Vencimientos específicos para un CUIT |
| `/limpiar` | Borra el historial de conversación del usuario |

También se puede escribir cualquier consulta contable libremente y el bot responderá usando Claude (Anthropic AI).

## Vencimientos incluidos

- **IVA (AFIP)** — Declaración Jurada mensual, por último dígito de CUIT
- **IIBB ARBA** — Ingresos Brutos Provincia de Buenos Aires, régimen general
- **IIBB AGIP** — Ingresos Brutos CABA

> ⚠️ Las fechas de vencimiento son orientativas. Siempre verificar en los sitios oficiales de AFIP, ARBA y AGIP, ya que pueden cambiar por feriados o disposiciones especiales.

## Estructura del proyecto

```
suvi-bot/
├── index.js          # Bot principal
├── vencimientos.js   # Lógica de vencimientos fiscales
├── .env              # Variables de entorno (no subir a git)
├── package.json
└── README.md
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `ANTHROPIC_API_KEY` | API Key de Anthropic para usar Claude |

## Notas de producción

Para mantener el bot corriendo en producción se recomienda usar [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name suvi-bot
pm2 save
pm2 startup
```

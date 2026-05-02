# Google Apps Script Project (Managed with Clasp) 🚀

Este repositorio contiene un proyecto de **Google Apps Script** desarrollado profesionalmente utilizando TypeScript y gestionado localmente mediante la herramienta CLI `clasp`.

## 🛠 Tecnologías y Herramientas

- **Google Apps Script (GAS):** Plataforma de desarrollo para Google Workspace.
- **Clasp (Command Line Apps Script Projects):** Herramienta de línea de comandos de Google para gestionar scripts localmente.
- **TypeScript:** Utilizado para el desarrollo del backend (transpilado a `.gs` por clasp).
- **V8 Engine:** Aprovechando las últimas funcionalidades de ECMAScript.

## 📂 Estructura del Proyecto

- `src/`: Directorio raíz del código fuente.
  - `appsscript.json`: Manifiesto del proyecto (ámbitos de OAuth, zona horaria, etc.).
  - `*.ts`: Lógica del servidor (Auth, Database, Main).
  - `ui/`: Componentes de interfaz de usuario (HTML/CSS/JS).
- `.gitignore`: Configurado para excluir archivos sensibles y metadatos locales de clasp.

## 🚀 Cómo empezar

### Requisitos previos
1. Tener instalado [Node.js](https://nodejs.org/).
2. Instalar clasp globalmente:
   ```bash
   npm install -g @google/clasp
   ```

### Configuración local
1. Clona el repositorio.
2. Inicia sesión en Google:
   ```bash
   clasp login
   ```
3. (Opcional) Si quieres vincularlo a un script existente:
   ```bash
   clasp create --title "Nombre del Proyecto" --type sheets
   # O si ya tienes un Script ID:
   # Actualiza .clasp.json con tu scriptId
   ```

### Despliegue
Para subir los cambios a la consola de Google Apps Script:
```bash
clasp push
```

---
*Desarrollado con ❤️ siguiendo los estándares de Clean Code y SOLID.*

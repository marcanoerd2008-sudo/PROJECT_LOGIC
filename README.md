# ASOTRANSMAR vs 4.0 — Sistema de Gestión de Transporte Marítimo

**Asotransmar C.A.** | RIF: `J-315369986-9` | Ruta: `La Isleta ↔ Coche`

Aplicación Web de Página Única (**SPA**) moderna, ultraligera y modular, diseñada específicamente para las taquillas del muelle y la administración central. No requiere dependencias de servidor ni instalaciones complejas: funciona directamente en cualquier navegador moderno.

---

## ⚓ Características Principales

### 1. Control de Acceso por Roles (RBAC)
- **Administrador**: Control total de tarifas en USD, Tasa oficial del BCV del día, porcentaje de retención corporativa, aranceles portuarios del INEA y módulo de liquidación a armadores.
- **Taquillero**: Interfaz optimizada y simplificada para la venta rápida y emisión de boletos, asignación a listín y cierre operativo de zarpes.
- **Credenciales por Defecto**:
  - `admin` / `admin123` (Rol: Administrador)
  - `taquilla1` / `taq123` (Rol: Taquillero)
  - `taquilla2` / `taq456` (Rol: Taquillero)

### 2. Motor de Horarios Oficiales y Rotación de Flota (Vigente 12/10/2026)
- **Flota de 3 Lanchas**:
  - `A`: Madhery
  - `B`: Isabel María
  - `C`: Júbilo Azul
- **Bloques Horarios Oficiales**:
  - **Lunes a Jueves**:
    - Coche: 07:00 a.m., 08:00 a.m.
    - La Isleta: 12:00 p.m., 04:00 p.m.
  - **Viernes**:
    - Coche: 07:00 a.m., 08:00 a.m., 02:00 p.m.
    - La Isleta: 09:00 a.m., 01:00 p.m., 04:00 p.m.
  - **Sábado**:
    - Coche: 07:00 a.m., 08:00 a.m., 03:00 p.m.
    - La Isleta: 09:00 a.m., 01:00 p.m., 04:00 p.m.
  - **Domingo**:
    - Coche: 08:00 a.m., 03:00 p.m.
    - La Isleta: 09:00 a.m., 04:00 p.m.
- **Reglas de Rotación**:
  - **Lunes a Sábado**: Ciclo continuo de cola entre jornadas laborales:
    - *Ciclo 1*: Madhery (1º), Isabel María (2º), Júbilo Azul (3º)
    - *Ciclo 2*: Isabel María (1º), Júbilo Azul (2º), Madhery (3º)
    - *Ciclo 3*: Júbilo Azul (1º), Madhery (2º), Isabel María (3º)
  - **Domingos**: Guardia exclusiva por jornada completa:
    - *Domingo 1*: Opera únicamente **Madhery**
    - *Domingo 2*: Opera únicamente **Isabel María**
    - *Domingo 3*: Opera únicamente **Júbilo Azul**
    - Se reinicia el ciclo sucesivamente.

### 3. Venta y Desglose Tarifario en Tiempo Real
- Formulario ágil: Cédula de Identidad, Nombre y Apellido.
- Categorías:
  - **REG** (Regular): 100% tarifa base.
  - **MPR** (Medio Pasaje Residencial): 50% tarifa base.
  - **MPV** (Medio Pasaje Vejez): 50% tarifa base.
  - **EXO** (Exonerado): 0% tarifa base.
- Conversión instantánea a Bolívares (VES) multiplicando estrictamente por la Tasa BCV configurada.
- Generación de comprobante digital tipo recibo tras cada venta.

### 4. Listín Digital de Zarpe (Manifiesto de Embarque)
- Numeración correlativa automática (N° 1, 2, 3...) de los pasajeros a bordo.
- Encabezado institucional con datos de la empresa, ruta, buque activo, hora, taquillero y campo para capitán.
- Cierre operativo del zarpe con bloqueo de nuevas ventas.
- Exportación e impresión directa a formato PDF con `html2pdf.js` optimizada para la Capitanía de Puerto.

### 5. Barra de Búsqueda Global (La Lupa 🔍)
- Desplegable de búsqueda en vivo en la cabecera por Cédula, Nombre, Apellido o Fecha.
- Vista detallada en el módulo de Historial con filtros por rango de fechas.

### 6. Liquidación de Armadores y Cierre Financiero
- Deducción automática de la retención corporativa Asotransmar (ej. 10%).
- Deducción de aranceles portuarios del INEA por pasajero transportado (ej. $0.50 USD/pax).
- Cálculo neto definitivo a liquidar al dueño de la embarcación (en USD y VES a la tasa del día).
- Exportación a PDF para entrega formal al armador.

---

## 📁 Estructura del Proyecto

```
Asotransmar vs 4.0/
├── index.html              # Interfaz SPA completa y estructura semántica
├── README.md               # Documentación operativa del sistema
├── css/
│   └── styles.css          # Diseño marítimo institucional, responsive y reglas de impresión
├── js/
│   ├── config.js           # Constantes, tarifas, horarios oficiales y rotación de flota
│   ├── storage.js          # Capa de persistencia en localStorage con manejo de claves
│   ├── utils.js            # Formato de fechas en español, monedas USD/VES, IDs y toasts
│   ├── auth.js             # Autenticación, control de sesiones y RBAC
│   ├── schedules.js        # Motor matemático de cálculo de rotación y asignación de buques
│   ├── sales.js            # Módulo de taquilla, emisión de boletos y recibos
│   ├── manifest.js         # Listín digital de zarpe, manifiesto y exportación a PDF
│   ├── search.js           # Motor de búsqueda global con debounce y filtros avanzados
│   ├── settlement.js       # Liquidación a armadores, deducciones INEA/Asotransmar y tarifas
│   └── app.js              # Controlador principal, ciclo de vida y navegación SPA
└── assets/                 # Recursos gráficos adicionales
```

---

## 🚀 Cómo Ejecutar

1. Abre directamente el archivo `index.html` en Google Chrome, Microsoft Edge, Mozilla Firefox o tu navegador preferido.
2. Opcionalmente, puedes servir la carpeta mediante cualquier servidor web local:
   ```bash
   # Con Python 3
   cd "Asotransmar vs 4.0"
   python3 -m http.server 8080
   # Abrir en el navegador: http://localhost:8080
   ```
3. Ingresa con el usuario `admin` (clave: `admin123`) o `taquilla1` (clave: `taq123`).


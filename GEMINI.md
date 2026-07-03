# Mascolo Químicos - Facturador Local (Ex NexusARCA)

Este archivo sirve como memoria central para el desarrollo del **Facturador Local de Mascolo Químicos**, asegurando la continuidad del contexto técnico y de negocio en su rol como gestor fiscal y de clientes.

## Objetivo del Proyecto
Desarrollar un sistema personalizado para la gestión de stock y ventas de químicos industriales, con integración directa para facturación electrónica.

## Arquitectura de Separación Física
Este proyecto reside en la carpeta `Mascolo Quimicos Facturador` y es totalmente independiente de la aplicación de stock.

### Responsabilidades del Facturador (Local)
- **Gestión de Clientes:** CUIT, domicilios, historial de compras.
- **Cuentas Corrientes:** Seguimiento de deudas (saldos negativos) y cobros.
- **Facturación Electrónica:** Integración con Web Services de ARCA (AFIP) mediante `afip.js`.
- **Importación:** Carga de ventas logísticas mediante archivos CSV generados por la app de stock.

## Stack Tecnológico
- **Backend:** Node.js con TypeScript y Express.
- **Base de Datos:** SQLite con Prisma ORM.
- **Frontend:** React (Vite) con TypeScript y Tailwind CSS.
- **Integración Fiscal:** `@afipsdk/afip.js`.

## Estado de la Integración ARCA (AFIP) - Junio 2026

### 1. Identidad Digital y Certificados
- **CUIT Autorizado:** 20409318550 (GALLARDO FACUNDO TOMAS).
- **Alias del Computador:** `MascoloFacturador`.
- **Archivos en `backend/afip_res/`:**
    - `key.key`: Clave privada RSA 2048.
    - `cert.crt`: Certificado de Producción emitido por AFIP (Válido hasta Junio 2028).
- **Entorno Actual:** PRODUCCIÓN (Configurado en `AfipService.ts`).

### 2. Servicios Autorizados
- Se ha dado de alta la relación en el **Administrador de Relaciones de Clave Fiscal** para el servicio **"Facturación Electrónica"** (wsfe) vinculado al alias `MascoloFacturador`.

### 3. Estado de Conexión y Pruebas
- **Solución Aplicada (Junio 2026):** Se reemplazó la librería paga por **`@cafecafe/afip.ts`**, resolviendo el error 401. Además, se inyectó una configuración global de TLS (`tls.DEFAULT_CIPHERS = 'DEFAULT@SECLEVEL=0'`) para evitar el error `dh key too small` común en Node 18+ al conectarse con los servidores legacy de AFIP.
- **Entorno Actual:** HOMOLOGACIÓN (Testing). La variable `production` en `afip.service.ts` está configurada en `false` para poder emitir facturas de prueba sin generar obligaciones fiscales.
- **Certificados:** Se configuró el sistema para buscar `cert_test.crt` y `key_test.key` en el entorno de pruebas.
- **Punto de Venta:** Configurado por defecto en **Punto de Venta 1**. (Pendiente verificar si el usuario posee otro PV habilitado para Web Services).

---

## Lógica de Negocio Implementada

### 1. Sistema de Cuentas Corrientes (Saldos Negativos)
- **Concepto:** Las deudas se almacenan como números negativos. Una venta de $1000 genera un saldo de `-$1000`. Un cobro de $1000 suma al saldo, llevándolo a `$0`.
- **Saldos Separados:**
    - **Saldo Blanco (Oficial):** Deuda acumulada por facturas electrónicas.
    - **Saldo Negro (EnGroncho):** Deuda acumulada por presupuestos o ventas informales.
    - **Saldo Deuda:** Suma total real adeudada por el cliente.

### 2. Facturación Electrónica (ARCA)
- **Servicio:** `AfipService` gestiona la obtención del CAE.
- **Tipos de Comprobante:** Factura A, B, C, Notas de Crédito.
- **Puntos de Venta:** Configurado por defecto para el Punto de Venta 1.

## Estado de Carpetas (Junio 2026)
- `C:\Users\facun\OneDrive\Escritorio\Proyectos\Mascolo Quimicos` -> **STOCK / LOGÍSTICA**
- `C:\Users\facun\OneDrive\Escritorio\Proyectos\Mascolo Quimicos Facturador` -> **FISCAL / CLIENTES**

## Historial de Cambios Recientes (Junio 2026)

### 1. Rediseño Minimalista (Slate & Blue)
- Se eliminó el sistema visual anterior (logos, texturas, colores vibrantes).
- Implementación de tema **Slate & Blue** enfocado en máxima legibilidad y sobriedad.
- Navegación simplificada: Se eliminó el módulo de **Stock** para centrar la app en facturación y clientes.
- Login simplificado: Eliminación de frases informativas y logos.

### 2. Seguridad y Autenticación
- Reset de credenciales maestras: `admin / admin123`.
- Implementación de **Rate Limiting** para prevenir fuerza bruta.
- Uso de **Bcrypt** para encriptación de contraseñas.
- Protección **anti-inyección SQL** nativa mediante Prisma ORM y validación Zod.

### 3. Esfuerzos de Portabilidad y Aplicación Local
- Integración de **Electron** para convertir la app web en un programa de escritorio (`.exe`).
- **Arquitectura de Carpeta Portable:** Configuración para que la base de datos (`data/dev.db`) y las facturas generadas (`facturas/`) vivan junto al ejecutable, permitiendo mover la carpeta a otra PC mediante un USB sin romper rutas.
- **Backend Integrado:** El servidor Express ahora se inicia automáticamente desde el proceso principal de Electron.

### 4. Corrección Fiscal y Panel de Configuración Dinámica
- **Fix IVA Crítico:** Se corrigió el cálculo de IVA en `sale.service.ts` que usaba una tasa fija (1.21). Ahora calcula `subtotal` e `iva` exacto por cada ítem según su `iva_tasa` individual, evitando rechazos de AFIP por montos descuadrados.
- **Base de Datos:** Se extendió el modelo `Settings` en Prisma para almacenar datos del Emisor (Razón Social, CUIT, Domicilio, Condición IVA, Inicio Actividades, Punto de Venta y Modo Producción).
- **Backend:** Nuevas rutas `/api/config` para leer/escribir la configuración. El servicio `AfipService` ahora lee el modo de producción y punto de venta directamente desde la base de datos de manera dinámica.
- **Frontend:** Nueva pantalla `/configuracion` (⚙ Config) que permite cargar todos los datos fiscales para la facturación. Incluye botón explícito para cambiar entre Homologación y Producción con advertencia.
- **PDF Dinámico:** `pdfService.ts` fue actualizado para obtener asíncronamente los datos del Emisor desde la API e inyectarlos tanto en el diseño visual de la factura como en el código QR oficial de AFIP.

## Estado Actual y Errores Conocidos (IMPORTANTE)
Al intentar generar el ejecutable portable, se ha detectado el siguiente problema:

**Error:** `Uncaught Exception: Error: Cannot find module 'electron-is-dev'`
- **Causa:** Este error ocurre porque el archivo `electron.cjs` en la carpeta local de compilación (`C:\Users\facun\MascoloFacturador`) contiene código obsoleto que intenta requerir una librería de desarrollo no incluida en el paquete final.
- **Solución pendiente:** Se debe sincronizar el archivo `electron.cjs` corregido (que utiliza `app.isPackaged` nativo) desde la carpeta de origen en OneDrive hacia la carpeta de compilación local antes de ejecutar `npm run dist`.

---
*Este documento reemplaza las versiones anteriores de NexusARCA para reflejar la nueva identidad de marca Mascolo Químicos.*

---

## Historial de Trabajos Anexos: CotiStore (Junio 2026)

Se realizó trabajo de mantenimiento y nuevas características en el repositorio **CotiStore** (`CotiDjangoFinal` y `DjangoFrontCoti`):
1. **Despliegue Local:** Se montaron exitosamente los servidores locales de Backend (Django) y Frontend (React+Vite) configurando el entorno virtual y superando errores de dependencias en Node.
2. **Ordenamiento Inteligente en Facturas (PDF):** Se modificó la lógica de generación del PDF del presupuesto (`api_pdf.py`). Los ítems ahora aplican "Ordenamiento Natural": se agrupan primero aquellos con SKU, luego por Categoría y finalmente por Nombre, ordenando correctamente los SKU numéricos (ej. 2 antes que 10).
3. **Autofacturación (Pedido de Stock):** 
   - Se creó una nueva funcionalidad para generar un PDF de pedido de stock dirigido al mayorista.
   - El nuevo documento omite precios y totales, y reemplaza los datos del comprador final por los datos del local ("CotiStore", "Gregorio de Laferrere", etc.).
   - Se agregó un botón específico en el panel de administrador de Django (columna Acciones) para permitir la descarga rápida de este documento.
   - Se ajustó el CSS/HTML en el panel de Django Admin (`orders/admin.py`) implementando Flexbox para que los botones de acciones no se amontonen y mantengan un diseño adaptable.

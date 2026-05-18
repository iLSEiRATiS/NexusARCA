# EnGroncho - Sistema de Gestión de Stock y Ventas

Este archivo sirve como memoria central para el desarrollo del proyecto **EnGroncho**, asegurando la continuidad del contexto técnico y de negocio.

## Objetivo del Proyecto
Desarrollar un sistema personalizado para la gestión de stock y ventas de químicos industriales, con integración directa para facturación electrónica (Fase Final).

## Stack Tecnológico
- **Backend:** Node.js con TypeScript y Express (ubicado en `/backend`).
- **Base de Datos:** SQLite con Prisma ORM (esquema en `/backend/prisma`).
- **Frontend:** React (Vite) con TypeScript y Tailwind CSS (ubicado en `/frontend`).
- **Validación:** Zod.
- **Gestión de Estado:** React Query (TanStack Query).

## Estructura del Proyecto
- `backend/`: Código del servidor, API y base de datos.
- `frontend/`: Interfaz de usuario y servicios del cliente.

## Convenciones de UI/UX (Estética Industrial Cálida)
- **Paleta de Colores:** Arena (`#EAE2D6`), Crema (`#F2EBE1`), Azul Petróleo (`#005F73`) y Verde Mar (`#94D2BD`). Se eliminó el blanco puro para reducir la fatiga visual.
- **Branding:** Uso del logo corporativo en Navbar y Login. Títulos en itálica y tracking ajustado para un look moderno.
- **Formas:** Bordes ultra redondeados (`rounded-[40px]`) y sombras premium.
- **Navegación:** Menú minimalista con estados activos en tono crema oscuro.

## Lógica de Negocio Implementada

### 1. Gestión de Stock Industrial
- **Unidades:** Stock físico en bultos/unidades (enteros). Cálculo de kilos totales basado en `peso_kg` por unidad.
- **Trazabilidad:** Control por Números de Lote y Fecha de Vencimiento.
- **Validación en Vivo:** El sistema impide (bloquea el botón de finalizar) y alerta en rojo si la cantidad cargada en una venta supera el stock actual disponible.

### 2. Sistema de Cuentas Corrientes (Saldos Negativos)
- **Concepto:** Las deudas se almacenan como números negativos. Una venta de $1000 genera un saldo de `-$1000`. Un cobro de $1000 suma al saldo, llevándolo a `$0`.
- **Split "En blanco" / "EnGroncho":**
    - **En blanco (Oficial):** Porcentaje de la venta que se factura legalmente.
    - **EnGroncho (Informal):** Porcentaje remanente (presupuesto).
- **Control de Cobros:** Se deshabilitan las opciones de cobro para categorías ya saldadas (saldo >= 0).

### 3. Módulo de Cotizaciones (Presupuestos)
- **Proforma:** Generación de presupuestos calculados en USD/ARS que no afectan stock.
- **Conversión:** Transformación de presupuesto aceptado a venta real con asignación automática de deuda y descuento de stock.

### 4. Inteligencia de Cobros (Imputación)
- **MIXTO (Auto):** Prioriza saldar primero la deuda **EnGroncho** (más urgente/informal) y aplica el remanente a la deuda **En blanco**.
- **Manual:** Permite elegir específicamente qué caja saldar.
- **Referencia:** Campo obligatorio/opcional para notas de pago (Nro. de transferencia, cheque, etc.).

## Estado Actual (18/05/2026)
- [x] Rebranding total a **EnGroncho** (Armonía visual con Logo).
- [x] Validación de Stock en tiempo real en Ventas.
- [x] Lógica de saldos negativos y cobros corregida y testeada.
- [x] CRUD de Productos y Clientes con búsqueda avanzada.
- [x] Módulo de Presupuestos operativo con conversión a venta.
- [x] Generación de PDF profesional para Ventas y Presupuestos.
- [x] Separación de estructura en carpetas `/backend` y `/frontend`.
- [ ] Integración con Web Services de ARCA (AFIP) - *Fase Final*.

## Instrucciones de Mantenimiento
- **Reiniciar Backend:** Ejecutar comandos dentro de la carpeta `/backend`.
- **Generar Cliente Prisma:** `npx prisma generate` (dentro de `/backend`).
- **Sincronizar DB:** `npx prisma db push` (dentro de `/backend`).
- **Admin:** `admin` / `admin123`.

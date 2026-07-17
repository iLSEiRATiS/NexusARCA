# Resumen de Cambios (Implementación del Facturador Genérico y Ajustes Legales)

A lo largo de esta sesión, hemos transformado a **NexusARCA** para que deje de depender de un catálogo de productos interno y se convierta en un facturador verdaderamente libre y genérico, adaptándolo a las normativas vigentes de AFIP/ARCA para Facturación de Tipo A, B y Notas de Crédito.

---

## 1. Desacople del Catálogo de Productos
* **Base de Datos (NexusARCA):** Se eliminaron las tablas `Product`, `Batch` y `StockMovement`. El facturador ya no rastrea inventario.
* **Backend:** Se eliminaron las rutas, controladores y servicios relacionados con `productos`.
* **Middlewares (Validaciones):** Se actualizaron `sale.schema.ts` y `quotation.schema.ts` para remover la exigencia del `product_id` y en su lugar requerir únicamente una `descripcion`, `cantidad`, `precio_unitario_usd` e `iva_tasa`.

## 2. Nueva Interfaz de Facturación (Carrito Editable)
* **Páginas Afectadas:** `NewSalePage.tsx` y `NewQuotationPage.tsx`.
* **Carga por CSV:** El sistema ahora carga ciegamente los nombres de los productos y sus cantidades desde el archivo CSV exportado por el sistema de stock. Ingresan al carrito con precio `$0`.
* **Edición en Línea:** Toda la tabla del carrito es ahora editable. Se puede modificar libremente la descripción, la cantidad y el precio directamente antes de confirmar la operación.
* **Agregar Manual:** Se incorporó un botón para añadir ítems vacíos ("Ítem Manual") para facturar conceptos extras como fletes, servicios o recargos.

## 3. Soporte Bimonetario Ítem por Ítem
* Se añadió un **selector de moneda (U$D / ARS)** en el carrito junto al campo de Precio Unitario.
* **Conversión Transparente:** El usuario puede ingresar el precio en la moneda que desee. El frontend calcula y envía al backend el precio unificado en dólares, sin generar errores de redondeo en la base de datos.

## 4. Adaptación a Venta por Kilogramos
* **Exportador de Stock (`mascoloQuimicos`):** Se modificó `dispatch.controller.ts` para que, al exportar el CSV, multiplique automáticamente la cantidad de bultos físicos por el peso de cada producto (`peso_kg`). De este modo, el depósito cuenta bultos pero el facturador recibe Kilos.
* **Interfaz del Facturador:** Se actualizaron todos los encabezados y resúmenes visuales para reemplazar la palabra "Cant. (UND)" y "BU" por **"CANT (KG)"**.

## 5. Refactorización del Generador de PDFs (`pdfService.ts`)
* **Eliminación de Relaciones Huérfanas:** Se corrigió el error donde los PDFs decían "Producto Desconocido" y "0.00 KG" al intentar buscar la información del artículo en el catálogo viejo.
* **Decimales:** Se ajustó la vista del Precio Unitario para mostrar solo 2 decimales en lugar de 4.
* **Nuevo Diseño para Presupuestos:** Se creó la función `generateProformaPDF` para que las facturas no fiscales (Presupuestos, o ventas en estado PENDIENTE) tengan un diseño elegante con encabezado verde, separándolas visualmente del formato oficial de AFIP.
* **Limpieza de Presupuestos (Operaciones No Fiscales):** 
  * Se **ocultó la columna de IVA** en la tabla y los desgloses en el resumen final. El PDF muestra un Precio Unitario Final que ya incluye el recargo internamente, garantizando que los totales cuadren sin exponer temas impositivos al cliente.
  * Se eliminó el texto redundante "Cond. IVA" del receptor.
  * Se programó una regla para que el nombre técnico `CONSUMIDOR (CREADO AUT.)` se imprima estéticamente como **"Consumidor Final"** en el comprobante.

---

## 6. Puesta en Producción de ARCA (AFIP)
* **Certificados Oficiales:** Se configuró el par de claves (`key_produccion.key` y `pedido_produccion.csr`) y se instaló el certificado oficial firmado `cert.crt` en la carpeta `backend/afip_res/`.
* **Configuración del Sistema:** Se añadió la variable `AFIP_CUIT=20106102741` en el `.env` del backend.
* **Base de Datos:** Se ejecutó un script de actualización para setear permanentemente los parámetros en la base de datos (`modo_produccion: true`, `punto_venta: 6` según lo dispuesto por el contador).

## 7. Mejoras de Facturación y Notas de Crédito (A, B y NC)
* **Tipo de Comprobante Persistente:** Se modificó el servicio del backend para que respete el tipo de comprobante seleccionado al crear la venta en la base de datos en lugar de sobreescribirlo arbitrariamente durante la facturación.
* **Soporte Completo de Anulación (Notas de Crédito):** 
  * Se habilitó el botón **ANULAR** tanto para **Factura A** como para **Factura B** autorizadas con CAE.
  * Se corrigió la generación del payload de la Nota de Crédito en el backend para que envíe el desglose de ítems (`iva_importe_ars` e IVA agrupado) de forma que AFIP acepte y valide correctamente el comprobante sin errores de cálculo impositivo.
  * Se programó la función `generateCreditNotePDF` en el frontend, la cual permite generar y descargar un PDF legal para la Nota de Crédito (encabezado rojo, referencia al comprobante original anulado, QR y CAE de la NC).
* **Corrección de Bugs Críticos de Interfaz:**
  * Se reemplazó el campo obsoleto `item.product?.nombre` por `item.descripcion` en el modal de facturación, evitando campos en blanco.
  * Se reescribió la función `calculateFinalTotal` del modal para calcular el importe total sin depender del peso que venía de la tabla de productos eliminada.

## 8. Compliance Legal y Seguridad
* **Fin de Clientes Ficticios:** Se eliminó la lógica que creaba un cliente de manera automática con nombre `"CONSUMIDOR (CREADO AUT.)"` al ingresar un CUIT inexistente. Ahora, el sistema lanza un error visual y bloquea la emisión, obligando al usuario a registrar al cliente con su Razón Social y Condición IVA oficiales desde el módulo de Clientes.
* **Validación Condición IVA ↔ Comprobante:** Se modificó la pantalla de facturación para deshabilitar automáticamente la opción de Factura A si el cliente es Consumidor Final/Exento, y deshabilitar Factura B si el cliente es Responsable Inscripto/Monotributista.
* **Control de Tope Consumidor Final (RG 5866/2026):** Se incorporaron alertas visuales en el carrito y en el modal de facturación que bloquean la confirmación si la venta a un Consumidor Final sin identificar (DocTipo 99) iguala o supera los $10.000.000, informando al usuario que debe asociar un CUIT/DNI real.

## 9. Script de Inicio Rápido
* Se creó el script de automatización `iniciar_servicios.bat` en la raíz de los proyectos. Al ejecutarse, detecta si los puertos `3000`, `3001`, `5173` o `5174` están siendo ocupados por procesos fantasmas de Node/Vite, los finaliza de forma segura y abre los 4 servicios correspondientes a **NexusARCA** y **MascoloQuímicos** en ventanas de terminal individuales.

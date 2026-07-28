# Resumen de Cambios (ImplementaciÃ³n del Facturador GenÃ©rico y Ajustes Legales)

A lo largo de esta sesiÃ³n, hemos transformado a **NexusARCA** para que deje de depender de un catÃ¡logo de productos interno y se convierta en un facturador verdaderamente libre y genÃ©rico, adaptÃ¡ndolo a las normativas vigentes de AFIP/ARCA para FacturaciÃ³n de Tipo A, B y Notas de CrÃ©dito.

---

## 1. Desacople del CatÃ¡logo de Productos
* **Base de Datos (NexusARCA):** Se eliminaron las tablas `Product`, `Batch` y `StockMovement`. El facturador ya no rastrea inventario.
* **Backend:** Se eliminaron las rutas, controladores y servicios relacionados con `productos`.
* **Middlewares (Validaciones):** Se actualizaron `sale.schema.ts` y `quotation.schema.ts` para remover la exigencia del `product_id` y en su lugar requerir Ãºnicamente una `descripcion`, `cantidad`, `precio_unitario_usd` e `iva_tasa`.

## 2. Nueva Interfaz de FacturaciÃ³n (Carrito Editable)
* **PÃ¡ginas Afectadas:** `NewSalePage.tsx` y `NewQuotationPage.tsx`.
* **Carga por CSV:** El sistema ahora carga ciegamente los nombres de los productos y sus cantidades desde el archivo CSV exportado por el sistema de stock. Ingresan al carrito con precio `$0`.
* **EdiciÃ³n en LÃ­nea:** Toda la tabla del carrito es ahora editable. Se puede modificar libremente la descripciÃ³n, la cantidad y el precio directamente antes de confirmar la operaciÃ³n.
* **Agregar Manual:** Se incorporÃ³ un botÃ³n para aÃ±adir Ã­tems vacÃ­os ("Ã�tem Manual") para facturar conceptos extras como fletes, servicios o recargos.

## 3. Soporte Bimonetario Ã�tem por Ã�tem
* Se aÃ±adiÃ³ un **selector de moneda (U$D / ARS)** en el carrito junto al campo de Precio Unitario.
* **ConversiÃ³n Transparente:** El usuario puede ingresar el precio en la moneda que desee. El frontend calcula y envÃ­a al backend el precio unificado en dÃ³lares, sin generar errores de redondeo en la base de datos.

## 4. AdaptaciÃ³n a Venta por Kilogramos
* **Exportador de Stock (`mascoloQuimicos`):** Se modificÃ³ `dispatch.controller.ts` para que, al exportar el CSV, multiplique automÃ¡ticamente la cantidad de bultos fÃ­sicos por el peso de cada producto (`peso_kg`). De este modo, el depÃ³sito cuenta bultos pero el facturador recibe Kilos.
* **Interfaz del Facturador:** Se actualizaron todos los encabezados y resÃºmenes visuales para reemplazar la palabra "Cant. (UND)" y "BU" por **"CANT (KG)"**.

## 5. RefactorizaciÃ³n del Generador de PDFs (`pdfService.ts`)
* **EliminaciÃ³n de Relaciones HuÃ©rfanas:** Se corrigiÃ³ el error donde los PDFs decÃ­an "Producto Desconocido" y "0.00 KG" al intentar buscar la informaciÃ³n del artÃ­culo en el catÃ¡logo viejo.
* **Decimales:** Se ajustÃ³ la vista del Precio Unitario para mostrar solo 2 decimales en lugar de 4.
* **Nuevo DiseÃ±o para Presupuestos:** Se creÃ³ la funciÃ³n `generateProformaPDF` para que las facturas no fiscales (Presupuestos, o ventas en estado PENDIENTE) tengan un diseÃ±o elegante con encabezado verde, separÃ¡ndolas visualmente del formato oficial de AFIP.
* **Limpieza de Presupuestos (Operaciones No Fiscales):** 
  * Se **ocultÃ³ la columna de IVA** en la tabla y los desgloses en el resumen final. El PDF muestra un Precio Unitario Final que ya incluye el recargo internamente, garantizando que los totales cuadren sin exponer temas impositivos al cliente.
  * Se eliminÃ³ el texto redundante "Cond. IVA" del receptor.
  * Se programÃ³ una regla para que el nombre tÃ©cnico `CONSUMIDOR (CREADO AUT.)` se imprima estÃ©ticamente como **"Consumidor Final"** en el comprobante.

---

## 6. Puesta en ProducciÃ³n de ARCA (AFIP)
* **Certificados Oficiales:** Se configurÃ³ el par de claves (`key_produccion.key` y `pedido_produccion.csr`) y se instalÃ³ el certificado oficial firmado `cert.crt` en la carpeta `backend/afip_res/`.
* **ConfiguraciÃ³n del Sistema:** Se aÃ±adiÃ³ la variable `AFIP_CUIT=20106102741` en el `.env` del backend.
* **Base de Datos:** Se ejecutÃ³ un script de actualizaciÃ³n para setear permanentemente los parÃ¡metros en la base de datos (`modo_produccion: true`, `punto_venta: 6` segÃºn lo dispuesto por el contador).

## 7. Mejoras de FacturaciÃ³n y Notas de CrÃ©dito (A, B y NC)
* **Tipo de Comprobante Persistente:** Se modificÃ³ el servicio del backend para que respete el tipo de comprobante seleccionado al crear la venta en la base de datos en lugar de sobreescribirlo arbitrariamente durante la facturaciÃ³n.
* **Soporte Completo de AnulaciÃ³n (Notas de CrÃ©dito):** 
  * Se habilitÃ³ el botÃ³n **ANULAR** tanto para **Factura A** como para **Factura B** autorizadas con CAE.
  * Se corrigiÃ³ la generaciÃ³n del payload de la Nota de CrÃ©dito en el backend para que envÃ­e el desglose de Ã­tems (`iva_importe_ars` e IVA agrupado) de forma que AFIP acepte y valide correctamente el comprobante sin errores de cÃ¡lculo impositivo.
  * Se programÃ³ la funciÃ³n `generateCreditNotePDF` en el frontend, la cual permite generar y descargar un PDF legal para la Nota de CrÃ©dito (encabezado rojo, referencia al comprobante original anulado, QR y CAE de la NC).
* **CorrecciÃ³n de Bugs CrÃ­ticos de Interfaz:**
  * Se reemplazÃ³ el campo obsoleto `item.product?.nombre` por `item.descripcion` en el modal de facturaciÃ³n, evitando campos en blanco.
  * Se reescribiÃ³ la funciÃ³n `calculateFinalTotal` del modal para calcular el importe total sin depender del peso que venÃ­a de la tabla de productos eliminada.

## 8. Compliance Legal y Seguridad
* **Fin de Clientes Ficticios:** Se eliminÃ³ la lÃ³gica que creaba un cliente de manera automÃ¡tica con nombre `"CONSUMIDOR (CREADO AUT.)"` al ingresar un CUIT inexistente. Ahora, el sistema lanza un error visual y bloquea la emisiÃ³n, obligando al usuario a registrar al cliente con su RazÃ³n Social y CondiciÃ³n IVA oficiales desde el mÃ³dulo de Clientes.
* **Fin de Clientes Ficticios:** Se eliminó la lógica que creaba un cliente de manera automática con nombre `"CONSUMIDOR (CREADO AUT.)"` al ingresar un CUIT inexistente. Ahora, el sistema lanza un error visual y bloquea la emisión, obligando al usuario a registrar al cliente con su Razón Social y Condición IVA oficiales desde el módulo de Clientes.
* **Validación Condición IVA ↔ Comprobante:** Se modificó la pantalla de facturación para deshabilitar automáticamente la opción de Factura A si el cliente es Consumidor Final/Exento, y deshabilitar Factura B si el cliente es Responsable Inscripto/Monotributista.
* **Control de Tope Consumidor Final (RG 5866/2026):** Se incorporaron alertas visuales en el carrito y en el modal de facturación que bloquean la confirmación si la venta a un Consumidor Final sin identificar (DocTipo 99) iguala o supera los $10.000.000, informando al usuario que debe asociar un CUIT/DNI real.

## 9. Script de Inicio Rápido
* Se creó el script de automatización `iniciar_servicios.bat` en la raíz de los proyectos. Al ejecutarse, detecta si los puertos `3000`, `3001`, `5173` o `5174` están siendo ocupados por procesos fantasmas de Node/Vite, los finaliza de forma segura y abre los 4 servicios correspondientes a **NexusARCA** y **MascoloQuímicos** en ventanas de terminal individuales.
  
## 10. Split de Facturación Mixta y Mejoras de Red  
* **Facturación Mixta (Split):** Se implementó la posibilidad de dividir una venta en una parte Oficial (Factura ARCA) y una parte Interna (Remito/Presupuesto) directamente desde la pantalla de confirmación, ajustando los precios unitarios enviados a AFIP de manera invisible para que el total coincida matemáticamente con la porción declarada.  
* **Formatos de Moneda:** Se estandarizó toda la aplicación para usar el formato argentino `es-AR` (puntos para miles, comas para decimales) garantizando una correcta lectura de los importes.  
* **Profesionalización de la Interfaz:** Se eliminaron las referencias coloquiales a cobros "en negro", reemplazándolas por el término **"Interno"** en toda la UI, las variables y la base de datos (mediante `@map`). Además, se removió de la creación de clientes la configuración obsoleta de Split Oficial por defecto.  
* **Acceso en Red Local (Smartphones/Tablets):** Se corrigió la configuración del frontend en `api.ts`, cambiando el endpoint de la API de un `localhost` estático a usar dinámicamente el host que solicita la página (`window.location.hostname`). Esto permite ingresar al sistema facturador correctamente desde cualquier dispositivo móvil conectado a la misma red WiFi o VPS.

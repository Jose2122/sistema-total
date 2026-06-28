export const helpDatabase = [
  {
    id: "usuarios-permisos",
    titulo: "Acceso al Sistema y Panel Principal",
    categoria: "Usuarios",
    keywords: ["acceso", "login", "contraseña", "dashboard", "resumen", "menu", "sidebar", "permisos", "roles"],
    descripcion: "Guía oficial para ingresar al SITC, gestionar incidencias de acceso y comprender el menú lateral adaptativo por roles corporativos.",
    flujoEstatus: [
      { nombre: "ROL ESTÁNDAR", bg: "#eff6ff", col: "#1d4ed8", desc: "Disponible para Gerencias y Analistas Solicitantes. Módulos básicos de Resumen, Requisiciones, Fondos y Perfil." },
      { nombre: "ROL ADMINISTRADOR", bg: "#f5f3ff", col: "#6d28d9", desc: "Permite manejar funciones globales del sistema, configuración de atributos y control de usuarios." },
      { nombre: "ROL COMPRAS", bg: "#dcfce7", col: "#15803d", desc: "Habilita herramientas adicionales de procesamiento de compras, reportes avanzados, directorio de proveedores y estadísticas de SLA." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Ingresar Credenciales Corporativas",
        detalle: "Escribe tu correo institucional (ej. usuario@totalclean.com) y contraseña privada. Puedes alternar la visibilidad de la clave con el icono del ojo."
      },
      {
        paso: 2,
        titulo: "Validación y Entrada",
        detalle: "Haz clic en el botón [ Entrar al Sistema ➔ ] para autenticar la sesión a través de Supabase y acceder al panel."
      },
      {
        paso: 3,
        titulo: "Interpretar Stats Cards de Cabecera",
        detalle: "Revisa los indicadores rápidos en la cabecera: Mis Requisiciones, Gasto Acumulado, Pendientes Aprobación y Equipo de Trabajo."
      },
      {
        paso: 4,
        titulo: "Revisar Distribución de Gastos",
        detalle: "Examina el gráfico circular de donut a la izquierda y su leyenda de impacto (los montos mayores a cero se destacan en negrita negra para auditoría)."
      },
      {
        paso: 5,
        titulo: "Monitorear Trazabilidad en Vivo",
        detalle: "Usa el historial dinámico a la derecha alternando entre 'Mis Requisiciones' y 'Colegas' para ver el estatus en tiempo real sin recargar."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué hago si tengo problemas de bloqueo o falta de acceso?",
        respuesta: "Debes ponerte en contacto inmediato con el Administrador del Sistema para solicitar la creación, desbloqueo o restablecimiento de tu contraseña."
      },
      {
        pregunta: "¿Por qué no veo ciertos módulos en mi menú lateral?",
        respuesta: "El menú lateral (Sidebar) es adaptativo y evalúa estrictamente los permisos guardados en tu perfil en tiempo real. Si un módulo no está marcado en tus permisos, no aparecerá en el menú."
      }
    ]
  },
  {
    id: "solicitud-fondos",
    titulo: "Solicitud de Fondos y Gestión Semanal",
    categoria: "Solicitud de Fondos",
    keywords: ["fondos", "presupuesto", "semanal", "borrador", "nueva solicitud", "imputar", "banco", "dolar", "bs", "bolivar"],
    descripcion: "Procedimiento para proyectar, presupuestar y controlar los gastos semanales imputados a tus frentes de trabajo.",
    flujoEstatus: [
      { nombre: "VIGENCIA SEMANAL", bg: "#eff6ff", col: "#1d4ed8", desc: "El ciclo presupuestario inicia el Lunes y expira el Domingo a las 11:59 PM de forma inmutable." },
      { nombre: "MONEDA PAGO BS/$", bg: "#fef3c7", col: "#d97706", desc: "Indica dólares presupuestados pero pagaderos en Bolívares." },
      { nombre: "MONEDA PAGO $/$", bg: "#dcfce7", col: "#15803d", desc: "Indica divisas líquidas pagaderas estrictamente en efectivo o transferencia internacional." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Crear Nueva Solicitud Semanal",
        detalle: "Presiona '+ Nueva Solicitud', selecciona la fecha en el calendario interactivo para comprobar disponibilidad y presiona 'Crear Nueva'."
      },
      {
        paso: 2,
        titulo: "Identificar ID de Control",
        detalle: "El sistema genera un código inteligente (ej. MTT-SEM-20-26) basado en la gerencia, número de semana y año en curso."
      },
      {
        paso: 3,
        titulo: "Añadir Renglones e Imputar Gastos",
        detalle: "Presiona '+ Añadir Renglón' y rellena de izquierda a derecha: Centro de Costo, Clasificación, Categoría, Detalle, Cantidad y P.Unitario."
      },
      {
        paso: 4,
        titulo: "Uso de Borradores",
        detalle: "Puedes cargar el presupuesto de forma progresiva. Usa 'Guardar Borrador' para resguardar los cambios en la nube sin enviarlos a revisión final."
      },
      {
        paso: 5,
        titulo: "Accionar Orden de Abastecimiento",
        detalle: "Marca la casilla (columna N) del renglón que requieras procesar e inmediatamente presiona 'Crear Requisición' para iniciar el proceso de aprobacion hasta ser despachado a compras."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué miden las tarjetas de control estadístico (Stats Cards)?",
        respuesta: "Calculan en tiempo real el presupuesto Estimado, lo Comprado físicamente, lo Pendiente en cola y la diferencia o Salud Presupuestaria."
      },
      {
        pregunta: "¿Qué pasa con mis fondos no ejecutados al finalizar la semana?",
        respuesta: "El ciclo presupuestario expira inmutablemente cada Domingo a las 11:59 PM, por lo que toda planificación remanente debe ser renovada para la siguiente semana."
      }
    ]
  },
  {
    id: "requisiciones-guia",
    titulo: "Ciclo de Requisición de Materiales",
    categoria: "Requisiciones",
    keywords: ["requisicion", "material", "compra", "pedido", "trazabilidad", "sla", "vencido", "timeline", "pdf", "furc"],
    descripcion: "Procedimiento para auditar y monitorear requisiciones creadas desde los fondos presupuestarios, controlando firmas y tiempos (SLA).",
    flujoEstatus: [
      { nombre: "TIMELINE EN VERDE", bg: "#dcfce7", col: "#15803d", desc: "Cada hito o firma digital completada se ilumina en verde, registrando inmutablemente nombre, fecha y hora." },
      { nombre: "SLA EN TIEMPO", bg: "#eff6ff", col: "#1d4ed8", desc: "El indicador de tiempo se encuentra dentro de los rangos óptimos de procesamiento logístico." },
      { nombre: "SLA VENCIDO", bg: "#fee2e2", col: "#b91c1c", desc: "Alerta crítica en mapa de calor que denota retrasos en la cotización o compra del ticket." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Monitorear Resumen Logístico",
        detalle: "Examina las tarjetas del panel superior: Total Requisiciones, Aprobada Global, Pendientes, Rechazadas y Anuladas."
      },
      {
        paso: 2,
        titulo: "Filtrar y Auditar el Historial",
        detalle: "Utiliza la barra de búsqueda y filtros avanzados (por C.Costo, Categoría, Gerencia o Estatus) para localizar requisiciones específicas."
      },
      {
        paso: 3,
        titulo: "Verificar Firmas e Timeline",
        detalle: "Haz clic en 'Ver Detalle' y comprueba la línea de tiempo interactiva de firmas digitales en la parte superior."
      },
      {
        paso: 4,
        titulo: "Corregir o Modificar Ítems",
        detalle: "Usa el botón [ Habilitar Edición ] para corregir descripciones, cantidades o datos antes de que se proceda a la orden de despacho final."
      },
      {
        paso: 5,
        titulo: "Ingresar Comentarios u Observaciones",
        detalle: "Accede al panel colapsable de observaciones para anexar notas aclaratorias o especificaciones técnicas sin alterar el requerimiento original."
      },
      {
        paso: 6,
        titulo: "Exportar Ficha Oficial (FURC)",
        detalle: "Presiona el botón [ PDF ] para compilar las firmas y datos en la Ficha Única de Requisición Corporativa (FURC), formato estándar de soporte físico."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué es el Módulo de Eventos por ítem?",
        respuesta: "Es una subtabla interactiva al final de cada fila de insumo que expone si el ítem está en estado COMPRA (con su factura y proveedor), SIN EFECTO (anulado con motivo formal) o JUSTIFICACIÓN (observación técnica de compra)."
      },
      {
        pregunta: "¿Cómo sé quién aprobó mi requisición?",
        respuesta: "Al abrir la requisición, la línea de tiempo superior detalla cronológicamente qué usuarios estamparon su firma (Jefe de Proyecto, Supervisor de Área, Gerencia General) junto con la fecha y hora exacta del evento."
      }
    ]
  },
  {
    id: "tickets-pago",
    titulo: "Tickets de Pago y Gastos Fijos",
    categoria: "Tickets de pago",
    keywords: ["ticket", "pago", "factura", "proveedor", "viaticos", "gastos fijos", "arrendamiento", "servicios"],
    descripcion: "Guía para el registro de facturas de gastos fijos recurrentes de la empresa que no pasan por procesos logísticos de cotización.",
    flujoEstatus: [
      { nombre: "ENTORNO AMARILLO", bg: "#fef3c7", col: "#d97706", desc: "Visualización de alerta que se activa en el sistema al entrar en modo Ticket de Pago." },
      { nombre: "GASTOS DIRECTOS", bg: "#eff6ff", col: "#1d4ed8", desc: "Imputaciones directas de tesorería y caja chica sin cotizaciones ni licitaciones." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Cambiar Interfaz a Tickets de Pago",
        detalle: "Dentro del módulo de Solicitud de Fondos, haz clic en el botón 'Mostrar Ticket de Pago'. La tabla adquirirá un tono amarillo de advertencia."
      },
      {
        paso: 2,
        titulo: "Seleccionar Imputación Directa",
        detalle: "Completa la fila rellenando obligatoriamente Centro de Costo, Proveedor homologado, Número de Factura o Documento de soporte."
      },
      {
        paso: 3,
        titulo: "Definir Monto y Moneda de Pago",
        detalle: "Introduce el precio unitario y elige si el pago se programará en dólares pagaderos en bolívares o en divisas líquidas ($/$)."
      },
      {
        paso: 4,
        titulo: "Retorno a Requisiciones",
        detalle: "Para volver a la interfaz estándar de requisiciones logísticas, pulsa el botón 'Mostrar Requisiciones' en la base inferior del módulo."
      }
    ],
    faq: [
      {
        pregunta: "¿Para qué tipo de gastos se utiliza este modo?",
        respuesta: "Se utiliza exclusivamente para gastos fijos ya contratados o recurrentes que no requieren gestión de compras, tales como arrendamientos, viáticos fijos, servicios públicos y tasas tributarias."
      }
    ]
  },
  {
    id: "procura-delegacion",
    titulo: "Procura: Procesamiento y Delegación",
    categoria: "Compras",
    keywords: ["compras", "procura", "delegación", "coordinador", "ricardo", "responsable", "asignación", "tabla", "expediente"],
    descripcion: "Flujo operativo de asignación y delegación de requisiciones aprobadas en el departamento de procura de TOTAL CLEAN C.A.",
    flujoEstatus: [
      { nombre: "SIN ASIGNAR", bg: "#fee2e2", col: "#b91c1c", desc: "La requisición acaba de ingresar y no tiene analista asignado (⚠️ Sin Asignar)." },
      { nombre: "ASIGNADO / BANDEJA", bg: "#eff6ff", col: "#1d4ed8", desc: "El ticket se encuentra en la cola de trabajo del analista de compras." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Identificar Solicitudes Aprobadas",
        detalle: "Al entrar al módulo de compras, se despliega una tabla centralizada con las requisiciones del ecosistema que ya completaron su circuito de firmas jerárquicas."
      },
      {
        paso: 2,
        titulo: "Delegar Insumos en Columna Responsable",
        detalle: "El Coordinador (Sr. Ricardo) evalúa la criticidad de las solicitudes y delega formalmente la orden seleccionando un analista en el menú desplegable."
      },
      {
        paso: 3,
        titulo: "Apertura del Expediente",
        detalle: "El analista delegado debe hacer clic estrictamente sobre el identificador alfanumérico (ID de la Requisición) para abrir el modal a pantalla completa."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo sabe el analista qué requisiciones tiene asignadas?",
        respuesta: "Aparecen en su bandeja de trabajo personal una vez que el Coordinador las delega formalmente con su nombre."
      }
    ]
  },
  {
    id: "compras-ejecucion",
    titulo: "Compras: Ejecución y Carga Obligatoria",
    categoria: "Compras",
    keywords: ["factura", "proveedor", "moneda", "pu", "cantidad", "adjunto", "soporte", "borrador", "papelera"],
    descripcion: "Normas de inventario y procedimiento mandatorio para registrar facturas y cargar archivos adjuntos en compras.",
    flujoEstatus: [
      { nombre: "PED. (PEDIDO)", bg: "#f1f5f9", col: "#475569", desc: "La cantidad física exacta de insumos que fue solicitada originalmente." },
      { nombre: "COMP. (COMPRADO)", bg: "#dcfce7", col: "#15803d", desc: "Cantidad acumulada de unidades ya adquiridas en transacciones previas." },
      { nombre: "PEND. (PENDIENTE)", bg: "#fee2e2", col: "#b91c1c", desc: "Saldo restante por adquirir (resaltado en naranja si es mayor a cero)." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Verificar Variables de Inventario",
        detalle: "Revisa la fórmula de tres vías (Ped. vs Comp. vs Pend.) para asegurar que no se compre más de lo presupuestado."
      },
      {
        paso: 2,
        titulo: "Registrar Datos de Factura",
        detalle: "Introduce el código de Factura #, el Proveedor Máster y selecciona la Moneda de Pago ($/Bs a tasa BCV o $/$ en divisas líquidas)."
      },
      {
        paso: 3,
        titulo: "Ingresar Cantidad y Precio Unitario",
        detalle: "Coloca la cantidad exacta a comprar y el precio unitario real pactado."
      },
      {
        paso: 4,
        titulo: "Subir Soporte Digital Obligatorio",
        detalle: "Es obligatorio adjuntar una imagen o PDF de la factura. Si no se carga el adjunto, el botón 'Procesar Compra' permanecerá bloqueado en el DOM."
      },
      {
        paso: 5,
        titulo: "Guardar Avances en Borrador",
        detalle: "Usa 'Guardar Borrador' para guardar tus cambios asíncronamente en Supabase sin necesidad de cerrar o finalizar la requisición entera."
      },
      {
        paso: 6,
        titulo: "Eliminar Errores de Carga",
        detalle: "Si cometes una equivocación, presiona el icono de papelera (hover rojo) para borrar la fila local del historial y restablecer los saldos pendientes."
      }
    ],
    faq: [
      {
        pregunta: "¿Por qué se bloquea el botón de procesar compra?",
        respuesta: "Por razones de auditoría interna y seguridad, el frontend bloquea el botón de guardar si falta el soporte digital cargado."
      }
    ]
  },
  {
    id: "compras-sla-tiempo",
    titulo: "Reglas de Negocio: SLA y Tiempos",
    categoria: "Compras",
    keywords: ["sla", "tiempo", "cronometro", "vencido", "retraso", "justificacion", "alerta", "penalizacion"],
    descripcion: "Medición científica del desempeño de la gerencia de compras a través de cronómetros en la nube y justificaciones obligatorias.",
    flujoEstatus: [
      { nombre: "SLA ACTIVO", bg: "#eff6ff", col: "#1d4ed8", desc: "El ticket se encuentra en procesamiento óptimo dentro del límite temporal." },
      { nombre: "VENCIDO", bg: "#fee2e2", col: "#991b1b", desc: "Muestra retraso crítico en mapa de calor y activa alertas en el Dashboard BI corporativo." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Monitorear Métrica de Tiempo",
        detalle: "Sigue el cronómetro de SLA asignado a cada ticket de procura para evitar que pase a estatus VENCIDO."
      },
      {
        paso: 2,
        titulo: "Cargar Justificación Técnica",
        detalle: "Si hay demoras, abre el selector de motivos (ej: falla de stock, espera de aprobación, definición insuficiente) y escribe una glosa detallada."
      },
      {
        paso: 3,
        titulo: "Evitar Penalizaciones",
        detalle: "Asegúrate de registrar compras o justificaciones. Si no se hace, el tiempo correrá y afectará tus métricas de eficiencia en compras."
      }
    ],
    faq: [
      {
        pregunta: "¿Quién recibe las alertas por tickets vencidos?",
        respuesta: "Se envían alertas en tiempo real al Dashboard BI de la Dirección Corporativa, penalizando los KPIs de la gerencia de procura."
      }
    ]
  },
  {
    id: "almacen-ubicacion",
    titulo: "Almacén: Confirmación y Ubicación",
    categoria: "Compras",
    keywords: ["almacen", "ubicacion", "entradas", "pasillo", "estante", "trazabilidad", "solicitante"],
    descripcion: "Flujo de confirmación física de mercancías e integración con ubicaciones de almacén.",
    flujoEstatus: [
      { nombre: "POR CLASIFICAR", bg: "#fef3c7", col: "#d97706", desc: "El camión llegó y la compra fue notificada para ser clasificada en Almacén." },
      { nombre: "CLASIFICADO", bg: "#dcfce7", col: "#15803d", desc: "El almacenista ha registrado la ubicación física de resguardo." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Notificar Entrega (Icono Casa 🏠)",
        detalle: "Al recibir físicamente los insumos en sede, el comprador presiona el icono de la Casa en la columna ALM para enviarlo a Almacén."
      },
      {
        paso: 2,
        titulo: "Gobernanza e Indexación",
        detalle: "El personal de almacén visualiza el insumo, abre su panel y selecciona obligatoriamente el Pasillo, Estante y Sección de resguardo."
      },
      {
        paso: 3,
        titulo: "Verificación de Trazabilidad (TR)",
        detalle: "Al guardar, el solicitante ve el icono 🏠 iluminado en su historial. Al presionar el botón de hoja (📄), visualizará la ubicación exacta para retirar su repuesto."
      }
    ],
    faq: [
      {
        pregunta: "¿Por qué no aparece el repuesto en mi almacén?",
        respuesta: "El comprador debe marcar primero la recepción (🏠) para que almacén pueda asignarle su ubicación física correspondiente."
      }
    ]
  },
  {
    id: "compras-anulacion",
    titulo: "Cierre: Anulación de Saldos",
    categoria: "Compras",
    keywords: ["anulacion", "saldo", "bloqueo", "historico", "presupuesto", "remante", "inmutable"],
    descripcion: "Cierre seguro de requerimientos pendientes por cambios de diseño u operaciones de campo.",
    flujoEstatus: [
      { nombre: "SALDO REMANENTE", bg: "#fef3c7", col: "#d97706", desc: "Cantidades presupuestadas pero que ya no son necesarias comprar." },
      { nombre: "EFECTO ANULADO", bg: "#f1f5f9", col: "#475569", desc: "El saldo se reduce a cero liberando contabilidad sin modificar lo ya comprado." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Presionar Icono de Bloqueo",
        detalle: "Acciona el botón de anulación en la fila correspondiente para abrir la ventana interactiva de saldo remanente."
      },
      {
        paso: 2,
        titulo: "Seleccionar Motivo de Anulación",
        detalle: "Elige uno de los motivos estándar (ej. Ya en Stock, No requerido, Duplicado) e introduce la justificación textual."
      },
      {
        paso: 3,
        titulo: "Ejecutar Cierre Contable",
        detalle: "Presiona [ Anular Saldo ] para liberar presupuesto fantasma. Las compras hechas previamente se mantendrán inmutables."
      }
    ],
    faq: [
      {
        pregunta: "¿Se borran las compras ya registradas si anulo el saldo pendiente?",
        respuesta: "No, las compras ya efectuadas permanecen intactas e inmutables en la base de datos para auditorías financieras."
      }
    ]
  },
  {
    id: "proveedores-modulo",
    titulo: "Proveedores: Directorio y Reportes",
    categoria: "Compras",
    keywords: ["proveedor", "rif", "razon social", "directorio", "analytics", "ranking", "estrella", "comparativo"],
    descripcion: "Manual de administración de la base de proveedores homologados y análisis BI de gastos y mejores precios.",
    flujoEstatus: [
      { nombre: "PROVEEDOR ACTIVO", bg: "#dcfce7", col: "#166534", desc: "Proveedor habilitado para ser seleccionado en órdenes de compra." },
      { nombre: "PROVEEDOR INACTIVO", bg: "#f1f5f9", col: "#475569", desc: "Ocultado temporalmente de las listas de selección del sistema." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Registrar Proveedor (Pestaña Directorio)",
        detalle: "Ingresa el RIF oficial (J-12345678-0), Razón Social, Dirección y asigna etiquetas de multi-selección (tags) por rubros comerciales."
      },
      {
        paso: 2,
        titulo: "Monitorear Estadísticas BI (Pestaña Reportes)",
        detalle: "Revisa las KPI Cards con el Gasto Total Acumulado, Proveedor Estrella y Conteo de Transacciones de procura."
      },
      {
        paso: 3,
        titulo: "Usar Comparador de Precios",
        detalle: "Busca un item en el comparador de precios. El sistema ordenará las ofertas y pintará en verde suave la fila con el 'Mejor Precio' histórico."
      },
      {
        paso: 4,
        titulo: "Ordenar Ranking de Gasto",
        detalle: "Utiliza la tabla ranking de gasto de proveedores haciendo clic en las columnas para ordenar por volumen o promedio."
      },
      {
        paso: 5,
        titulo: "Descargar Hojas de Rendimiento",
        detalle: "Presiona 'Exportar Ranking a Excel' para generar un reporte automatizado diseñado con ExcelJS."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo encuentro qué proveedor vendió un insumo más barato?",
        respuesta: "Usa el Comparativo de Precios en la pestaña Análisis, escribe el nombre del item y observa la fila sombreada en verde."
      }
    ]
  },
  {
    id: "reportes-compras",
    titulo: "Reporte Máster de Compras",
    categoria: "Compras",
    keywords: ["reportes", "ahorro", "mes", "pagar", "completadas", "faltantes", "exportar", "auditoria"],
    descripcion: "Centro de auditoría macro para evaluar gastos, ahorros y exportar balances en Excel.",
    flujoEstatus: [
      { nombre: "GASTO DEL MES", bg: "#eff6ff", col: "#1e40af", desc: "Acumulado total facturado durante el mes en curso." },
      { nombre: "AHORRO POR NEGOCIACIÓN", bg: "#dcfce7", col: "#15803d", desc: "Presupuesto ahorrado a través de negociaciones de precio unitario." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Auditar Indicadores de Cabecera",
        detalle: "Revisa los contadores acumulados de egresos del mes, ahorros por negociación y deudas de compras pendientes por pagar."
      },
      {
        paso: 2,
        titulo: "Expandir Filas de Historial",
        detalle: "Haz clic en cualquier fila para desplegar una subtabla con las facturas, detalles de compras y compradores ejecutores."
      },
      {
        paso: 3,
        titulo: "Exportar Histórico Filtrado",
        detalle: "Presiona [ Excel General ] para descargar las requisiciones filtradas actualmente en pantalla."
      },
      {
        paso: 4,
        titulo: "Descargar Hojas de Materiales Faltantes",
        detalle: "Haz clic en [ Faltantes ] para compilar en Excel de forma exclusiva los renglones con saldos pendientes para mesas técnicas."
      },
      {
        paso: 5,
        titulo: "Descargar Hojas de Transacciones Completadas",
        detalle: "Presiona [ Completadas ] para descargar transacciones cerradas, detallando factura y estatus de ingreso a almacén (🏠)."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué mide el 'Ahorro por Negociación'?",
        respuesta: "Es la diferencia favorable entre el precio unitario estimado original y el precio unitario real final negociado por compras."
      }
    ]
  },
  {
    id: "errores-comunes",
    titulo: "Solución de Errores e Incidencias",
    categoria: "Errores Comunes",
    keywords: ["error", "falla", "sesion", "archivo", "limite", "sincronizar", "cache", "f5"],
    descripcion: "Soluciones rápidas a los inconvenientes operativos y técnicos reportados con mayor frecuencia en la plataforma SITC.",
    flujoEstatus: [
      { nombre: "ERROR CRÍTICO", bg: "#fee2e2", col: "#b91c1c", desc: "Fallas que interrumpen el uso, como desconexión de red o token de sesión vencido." },
      { nombre: "FALLA DE ADVERTENCIA", bg: "#fef3c7", col: "#d97706", desc: "Omisiones en formatos o carga de datos (ej. subir archivos de tamaño excesivo)." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Incidencia: Sesión Expirada (Session Expired)",
        detalle: "Por seguridad, el token de sesión en la nube de Supabase dura 24 horas continuas. Si expira o se cierra inesperadamente, simplemente inicia sesión de nuevo en la pantalla inicial."
      },
      {
        paso: 2,
        titulo: "Incidencia: El archivo adjunto no carga",
        detalle: "El límite estricto de carga es de 10MB por archivo. Comprueba que las facturas estén digitalizadas en PDF, JPG o PNG y que el nombre del archivo no contenga caracteres especiales."
      },
      {
        paso: 3,
        titulo: "Incidencia: El botón Guardar está bloqueado",
        detalle: "Revisa que todos los campos requeridos estén completos y que hayas agregado al menos un renglón a la tabla de detalles con un monto unitario y cantidad mayor a cero."
      },
      {
        paso: 4,
        titulo: "Incidencia: Los cambios no se ven reflejados",
        detalle: "El sistema utiliza caché local para optimizar la velocidad. Presiona CTRL + F5 (en Windows) o CMD + Shift + R (en Mac) para forzar la recarga limpia de la página."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué hago si el sistema sigue sin guardar mis datos?",
        respuesta: "Verifica tu conexión a internet. Si el problema persiste, copia los datos cargados temporalmente en un bloc de notas y comunícate con el Administrador para validar que no haya bloqueos en las políticas de seguridad de Supabase."
      }
    ]
  }
];

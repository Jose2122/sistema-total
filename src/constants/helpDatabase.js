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
    id: "compras-guia",
    titulo: "Compras y Gestión de Proveedores",
    categoria: "Compras",
    keywords: ["compras", "proveedores", "homologacion", "almacen", "factura", "excel", "faltantes", "completadas", "trazabilidad"],
    descripcion: "Manual de control logístico para delegar requisiciones aprobadas, registrar compras, controlar ingresos a Almacén e historiales de proveedores.",
    flujoEstatus: [
      { nombre: "COMPRAS EN PROCESO", bg: "#fef3c7", col: "#d97706", desc: "El analista de compras ha registrado transacciones de forma parcial para la requisición." },
      { nombre: "COMPRAS FINALIZADAS", bg: "#dcfce7", col: "#15803d", desc: "Todos los insumos solicitados en la orden han sido adquiridos al 100% y cerrados." },
      { nombre: "SIN ASIGNAR", bg: "#fee2e2", col: "#b91c1c", desc: "Requisiciones aprobadas que acaban de ingresar a Compras y requieren la delegación de un comprador responsable." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Delegar Requisición a Comprador",
        detalle: "El Gerente de Compras selecciona al analista responsable usando el desplegable en la columna Responsable (los tickets nuevos inician como ⚠️ Sin Asignar)."
      },
      {
        paso: 2,
        titulo: "Monitorear Variables de Inventario",
        detalle: "Al abrir el modal, comprueba las variables: Pedidas (Ped.), Compradas (Comp.) y Pendientes (Pend.). Si hay saldos en cola se destaca en naranja bold."
      },
      {
        paso: 3,
        titulo: "Registrar Transacción de Procura",
        detalle: "Ingresa obligatoriamente el Número de Factura, Proveedor homologado, Moneda de Pago, Cantidad y el P.U. Real negociado."
      },
      {
        paso: 4,
        titulo: "Confirmar Ingreso a Almacén",
        detalle: "Presiona el icono de casa (columna ALM) en la fila para certificar que la mercancía ingresó físicamente y está resguardada en stock."
      },
      {
        paso: 5,
        titulo: "Anular Saldos Pendientes (Cierre)",
        detalle: "Si ya no se requiere comprar el remanente de un ítem, presiona el icono de bloqueo, selecciona el Motivo de Anulación y justifica el Cierre de Efecto."
      },
      {
        paso: 6,
        titulo: "Administrar Máster de Proveedores",
        detalle: "Gestiona el directorio inmutable desde 'Proveedores'. Usa RIF (J-12345678-0), razón social, categorías (multi-tags) y activa/desactiva según corresponda."
      },
      {
        paso: 7,
        titulo: "Exportación Contextual Inteligente",
        detalle: "Usa los botones de exportación dinámica en el reporte para descargar en Excel lo que ves en pantalla: Excel General, Faltantes o Completadas."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo se enteran los departamentos del estatus de sus compras?",
        respuesta: "El sistema SITC conecta ambos módulos. Al actualizar las facturas o almacén, los solicitantes pueden visualizarlo al instante haciendo clic en el icono de hoja (📄) de la columna TR (Trazabilidad) en su historial de requisiciones."
      },
      {
        pregunta: "¿Por qué no puedo guardar un nuevo proveedor?",
        respuesta: "Asegúrate de haber ingresado el formato RIF oficial (RIF obligatorio) y de que los datos de contacto y Razón Social estén completos antes de presionar Guardar."
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

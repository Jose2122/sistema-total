export const helpDatabase = [
  {
    id: "solicitud-fondos",
    titulo: "Guía de Solicitud de Fondos",
    categoria: "Solicitud de Fondos",
    keywords: ["fondos", "dinero", "caja chica", "pago", "solicitud", "aprobar", "transferencia", "moneda", "banco", "dolar", "bs", "bolivar"],
    descripcion: "Procedimiento detallado para solicitar fondos destinados a gastos operativos, viáticos o compras urgentes, y entender su ciclo de aprobación.",
    flujoEstatus: [
      { nombre: "BORRADOR", bg: "#f1f5f9", col: "#475569", desc: "La solicitud está siendo editada por el usuario y aún no se ha enviado al flujo de revisión." },
      { nombre: "PENDIENTE REGISTRO", bg: "#fef3c7", col: "#d97706", desc: "La solicitud fue enviada y está siendo revisada por Administración para su registro contable." },
      { nombre: "PENDIENTE FIRMA", bg: "#eff6ff", col: "#1d4ed8", desc: "La solicitud fue registrada y requiere la firma digital de autorización de tu Gerente de Departamento." },
      { nombre: "PENDIENTE APROBACIÓN", bg: "#f5f3ff", col: "#6d28d9", desc: "Autorizada por el departamento. Espera por la aprobación financiera final de la Gerencia General." },
      { nombre: "APROBADO", bg: "#dcfce7", col: "#15803d", desc: "Solicitud aprobada por completo. Lista para la emisión de pago o transferencia bancaria." },
      { nombre: "RECHAZADO", bg: "#fee2e2", col: "#b91c1c", desc: "La solicitud fue rechazada debido a observaciones. Revisa los comentarios para corregir y reenviar." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Abrir Formulario de Solicitud",
        detalle: "Navega a 'Solicitud de Fondos' en el menú izquierdo y haz clic en el botón sutil '+ NUEVA SOLICITUD' situado arriba de la tabla."
      },
      {
        paso: 2,
        titulo: "Ingresar Datos de Cabecera",
        detalle: "Completa el nombre del Beneficiario, selecciona el Departamento solicitante, añade un Concepto General descriptivo y define la Moneda (USD / BS)."
      },
      {
        paso: 3,
        titulo: "Agregar Renglones Detallados",
        detalle: "Escribe la descripción del gasto específico, introduce el monto y selecciona la Cuenta Contable de gasto correspondiente. Presiona el botón '+' para añadirlo a la tabla. Puedes agregar múltiples conceptos."
      },
      {
        paso: 4,
        titulo: "Cargar Soportes Obligatorios",
        detalle: "Sube las facturas, cotizaciones o justificaciones digitalizadas en el campo de adjuntos. Toda solicitud de fondos requiere un soporte legible para ser registrada."
      },
      {
        paso: 5,
        titulo: "Guardar y Enviar",
        detalle: "Presiona el botón 'GUARDAR SOLICITUD'. Su estatus pasará inmediatamente a 'PENDIENTE REGISTRO' y se notificará al departamento administrativo para iniciar el flujo."
      }
    ],
    faq: [
      {
        pregunta: "¿Por qué no me deja editar una solicitud de fondos?",
        respuesta: "Por razones de auditoría y seguridad, las solicitudes de fondos solo pueden ser editadas o eliminadas mientras se encuentren en estatus 'BORRADOR'. Una vez enviadas a 'PENDIENTE REGISTRO', su contenido queda bloqueado."
      },
      {
        pregunta: "¿Qué hacer si mi solicitud fue RECHAZADA?",
        respuesta: "Abre la solicitud desde la tabla principal del módulo. En la parte superior aparecerá un recuadro rojo con el motivo detallado de rechazo provisto por el revisor. Deberás duplicar o ajustar los datos y volver a guardarla para reiniciar el flujo."
      },
      {
        pregunta: "¿Cuánto tiempo toma el procesamiento de un pago?",
        respuesta: "Una vez que la solicitud alcanza el estatus 'APROBADO', el departamento de Tesorería procesa el pago dentro de las siguientes 24 a 48 horas hábiles, según la disponibilidad bancaria."
      }
    ]
  },
  {
    id: "requisiciones-guia",
    titulo: "Ciclo de Requisición de Materiales",
    categoria: "Requisiciones",
    keywords: ["requisicion", "material", "compra", "pedido", "almacen", "insumos", "solicitar", "aprobar", "anular"],
    descripcion: "Guía paso a paso para crear requisiciones internas de insumos de limpieza, oficina y materiales especializados.",
    flujoEstatus: [
      { nombre: "CREADA", bg: "#f1f5f9", col: "#475569", desc: "La requisición ha sido registrada en el sistema por el solicitante." },
      { nombre: "PENDIENTE", bg: "#fef3c7", col: "#d97706", desc: "Espera por la firma de autorización del Gerente o Supervisor a cargo." },
      { nombre: "APROBADA", bg: "#dcfce7", col: "#15803d", desc: "Aprobada por completo. El equipo de compras procederá a cotizar y emitir órdenes." },
      { nombre: "ANULADA", bg: "#fee2e2", col: "#b91c1c", desc: "Requisición cancelada por el usuario o rechazada por la gerencia debido a duplicaciones o presupuesto." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Iniciar Nueva Requisición",
        detalle: "Haz clic en 'Requisiciones' en el menú y presiona '+ NUEVA REQUISICIÓN'. El sistema asignará un correlativo automático."
      },
      {
        paso: 2,
        titulo: "Añadir Ítems del Catálogo",
        detalle: "Busca los productos requeridos por código o nombre en el buscador interno, ingresa la cantidad necesaria y presiona 'Añadir'. Puedes especificar renglones personalizados si el ítem no está catalogado."
      },
      {
        paso: 3,
        titulo: "Justificar el Requerimiento",
        detalle: "Escribe en el campo de observaciones el destino o uso de los materiales. Esto facilita la aprobación oportuna por parte de la Gerencia."
      },
      {
        paso: 4,
        titulo: "Enviar a Firma",
        detalle: "Haz clic en 'Guardar'. Tu requisición quedará registrada en estatus 'PENDIENTE' hasta que tu supervisor firme el documento digitalmente."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo anular una fila de requisición sin cancelar todo el documento?",
        respuesta: "Si la requisición está 'PENDIENTE', haz clic en el botón 'Ver Detalle', ubica la fila específica que deseas cancelar, presiona el icono de papelera y confirma. Esto guardará el historial con el estatus 'ANULADA' únicamente para ese ítem."
      },
      {
        pregunta: "¿Dónde veo el estatus de entrega de mis materiales?",
        respuesta: "En la tabla de requisiciones, cada ítem muestra un porcentaje de despacho. Si está al 100%, significa que Almacén ya entregó todos los materiales solicitados."
      }
    ]
  },
  {
    id: "tickets-pago",
    titulo: "Gestión de Tickets de Pago",
    categoria: "Tickets de pago",
    keywords: ["ticket", "pago", "factura", "proveedor", "comprobante", "retencion", "iva", "islr", "conciliacion"],
    descripcion: "Aprende a registrar y hacer seguimiento a los pagos a proveedores mediante la carga y aprobación de tickets de pago.",
    flujoEstatus: [
      { nombre: "RECIBIDO", bg: "#eff6ff", col: "#1d4ed8", desc: "El ticket y la factura del proveedor fueron cargados en el sistema." },
      { nombre: "EN REVISIÓN", bg: "#fef3c7", col: "#d97706", desc: "Administración está verificando los montos, facturas y datos fiscales." },
      { nombre: "PROGRAMADO", bg: "#f5f3ff", col: "#6d28d9", desc: "Factura validada y programada en el cronograma semanal de pagos." },
      { nombre: "PAGADO", bg: "#dcfce7", col: "#15803d", desc: "Transferencia efectuada. El comprobante de pago está disponible para el proveedor." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Crear Ticket",
        detalle: "Ingresa al módulo 'Ticket de Pago' y presiona '+ REGISTRAR TICKET'. Elige el proveedor de la lista homologada."
      },
      {
        paso: 2,
        titulo: "Cargar Factura y Montos",
        detalle: "Escribe el número de control y factura, la fecha de emisión, base imponible, e IVA. El sistema calculará automáticamente las retenciones de ley."
      },
      {
        paso: 3,
        titulo: "Adjuntar PDF/XML de Factura",
        detalle: "Es obligatorio subir la factura digitalizada y la cotización relacionada. Los tickets sin soporte adjunto serán devueltos inmediatamente."
      },
      {
        paso: 4,
        titulo: "Enviar a Programación",
        detalle: "Presiona 'Enviar'. Administración validará el ticket y lo incorporará a la cola de pagos semanales."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué hacer si los montos calculados de retención son incorrectos?",
        respuesta: "El sistema calcula las retenciones basándose en la ficha del proveedor (ej. 75% o 100% de IVA). Si consideras que hay un error, contacta a Administración para que actualice la configuración del proveedor en el módulo de 'Proveedores'."
      },
      {
        pregunta: "¿Dónde descargo mi comprobante de retención?",
        respuesta: "Una vez que el ticket de pago cambia a estatus 'PAGADO', podrás hacer clic en el botón 'Ver PDF Retención' de esa fila para descargar el comprobante oficial."
      }
    ]
  },
  {
    id: "compras-guia",
    titulo: "Órdenes de Compra y Proveedores",
    categoria: "Compras",
    keywords: ["compra", "orden", "proveedor", "cotizar", "aprobar", "moneda", "despacho"],
    descripcion: "Guía para el equipo de compras para la generación de Órdenes de Compra (OC) basadas en requisiciones aprobadas.",
    flujoEstatus: [
      { nombre: "BORRADOR", bg: "#f1f5f9", col: "#475569", desc: "La orden está en elaboración por el comprador." },
      { nombre: "PENDIENTE", bg: "#fef3c7", col: "#d97706", desc: "Esperando firma autorizada del Gerente de Compras o Director General." },
      { nombre: "EMITIDA", bg: "#dcfce7", col: "#15803d", desc: "Orden aprobada y enviada oficialmente al proveedor para su despacho." },
      { nombre: "COMPLETADA", bg: "#eff6ff", col: "#1d4ed8", desc: "Mercancía recibida e ingresada a inventario. Factura procesada." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Seleccionar Requisición Aprobada",
        detalle: "En el módulo 'Órdenes de Compra', presiona 'Generar desde Requisición'. Selecciona el correlativo de la requisición aprobada."
      },
      {
        paso: 2,
        titulo: "Asignar Proveedor y Precios",
        detalle: "Elige al proveedor idóneo y carga los precios unitarios negociados de la cotización ganadora. Configura la forma de pago (crédito, contado)."
      },
      {
        paso: 3,
        titulo: "Definir Lugar y Fecha de Entrega",
        detalle: "Completa la dirección de entrega (Almacén Central o directo en obra/cliente) y la fecha estimada de despacho pactada."
      },
      {
        paso: 4,
        titulo: "Enviar para Aprobación",
        detalle: "Presiona 'Guardar'. Dependiendo del monto total de la OC, requerirá firmas de la Gerencia de Operaciones o Dirección General."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo sé si una Orden de Compra ya fue pagada?",
        respuesta: "En la pestaña de seguimiento de compras, las órdenes enlazadas a un Ticket de Pago en estatus 'PAGADO' mostrarán un check verde en la columna 'Finanzas'."
      }
    ]
  },
  {
    id: "usuarios-permisos",
    titulo: "Administración de Usuarios y Permisos",
    categoria: "Usuarios",
    keywords: ["usuario", "permiso", "rol", "crear", "bloquear", "contraseña", "departamento"],
    descripcion: "Información para administradores sobre cómo gestionar el acceso del personal al sistema SITC.",
    flujoEstatus: [
      { nombre: "ACTIVO", bg: "#dcfce7", col: "#15803d", desc: "El usuario tiene acceso completo a los módulos permitidos en su perfil." },
      { nombre: "INACTIVO", bg: "#fee2e2", col: "#b91c1c", desc: "Acceso bloqueado. El usuario no puede iniciar sesión en la plataforma." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Crear Nuevo Usuario",
        detalle: "Ve a 'Gestión de Usuarios' y presiona '+ NUEVO USUARIO'. Ingresa el correo corporativo, nombre, apellido y cargo."
      },
      {
        paso: 2,
        titulo: "Asignar Rol y Departamento",
        detalle: "Selecciona el Rol jerárquico (Admin, Gerente, Comprador, Solicitante) y el departamento al que pertenece. Esto rige las firmas del flujo de fondos."
      },
      {
        paso: 3,
        titulo: "Configurar Permisos de Módulos",
        detalle: "Marca los casilleros de los módulos específicos a los que este usuario debe tener acceso en su panel lateral. Puedes restringir vistas enteras."
      },
      {
        paso: 4,
        titulo: "Guardar e Invitar",
        detalle: "Haz clic en 'Guardar'. Se enviará un correo automático de Supabase para que el usuario configure su contraseña de acceso."
      }
    ],
    faq: [
      {
        pregunta: "¿Cómo desactivo a un usuario que ya no labora en la empresa?",
        respuesta: "Busca al usuario en la lista del módulo 'Usuarios', haz clic en 'Editar', cambia su interruptor de estatus a 'Inactivo' y guarda. Esto cerrará sus sesiones activas de inmediato e impedirá futuros accesos."
      }
    ]
  },
  {
    id: "errores-comunes",
    titulo: "Solución de Errores Frecuentes",
    categoria: "Errores Comunes",
    keywords: ["error", "falla", "sesion", "archivo", "sincronizar", "no carga", "guardar", "adjunto"],
    descripcion: "Respuestas y soluciones rápidas para los problemas técnicos más reportados por los usuarios en el sistema.",
    flujoEstatus: [
      { nombre: "CRÍTICO", bg: "#fee2e2", col: "#b91c1c", desc: "Errores que impiden el flujo (ej. sesión vencida o base de datos caída)." },
      { nombre: "ADVERTENCIA", bg: "#fef3c7", col: "#d97706", desc: "Falta de datos u omisiones del usuario (ej. archivos muy pesados)." }
    ],
    pasos: [
      {
        paso: 1,
        titulo: "Error: 'Sesión Expired' o Cierre Inesperado",
        detalle: "Por seguridad, el token de acceso de Supabase dura 24 horas continuas. Si el sistema te saca, simplemente inicia sesión de nuevo en la pantalla principal."
      },
      {
        paso: 2,
        titulo: "Error: 'El archivo adjunto no pudo cargarse'",
        detalle: "El límite de carga por archivo es de 10MB. Asegúrate de que tus facturas o soportes estén en formato PDF, JPG o PNG y no superen este peso. Evita caracteres especiales en el nombre del archivo."
      },
      {
        paso: 3,
        titulo: "Error: 'El botón Guardar está deshabilitado'",
        detalle: "Verifica que todos los campos marcados como obligatorios estén completos, y que hayas agregado al menos un renglón a la tabla de detalles con montos mayores a cero."
      }
    ],
    faq: [
      {
        pregunta: "¿Qué hago si los cambios no se ven reflejados en mi pantalla?",
        respuesta: "El sistema implementa caché local para velocidad. Presiona CTRL + F5 (en Windows) o CMD + Shift + R (en Mac) para forzar la recarga limpia de los scripts en tu navegador."
      }
    ]
  }
];

export type LegalSection = {
  title: string;
  paragraphs: string[];
  list?: string[];
};

export const privacySections: LegalSection[] = [
  {
    title: '1. Responsable del tratamiento',
    paragraphs: [
      'Luxtime Luxury Timepieces (en adelante, «Luxtime»), con domicilio en Piedecuesta, Colombia, es el responsable del tratamiento de los datos personales recolectados a través de este sitio web, canales de WhatsApp, formularios de contacto, checkout y demás medios digitales asociados a la marca.',
      'Para cualquier solicitud relacionada con el tratamiento de datos personales puede escribirnos a: privacidad@luxtime.co',
    ],
  },
  {
    title: '2. Marco legal aplicable',
    paragraphs: [
      'El tratamiento de datos personales se realiza conforme a la Constitución Política de Colombia, la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas que las modifiquen o complementen en materia de protección de datos personales (Habeas Data).',
    ],
  },
  {
    title: '3. Datos que recolectamos',
    paragraphs: ['Podemos recolectar, almacenar y tratar las siguientes categorías de datos:'],
    list: [
      'Datos de identificación: nombre, documento de identidad, correo electrónico y teléfono.',
      'Datos de contacto y entrega: dirección, ciudad, departamento y referencias para envío.',
      'Datos de la transacción: productos consultados o adquiridos, historial de pedidos y preferencias comerciales.',
      'Datos técnicos: dirección IP, tipo de navegador, cookies y registros de navegación en el sitio.',
      'Datos de comunicación: mensajes enviados por WhatsApp, correo u otros canales de atención.',
    ],
  },
  {
    title: '4. Finalidades del tratamiento',
    paragraphs: ['Tratamos sus datos personales para las siguientes finalidades:'],
    list: [
      'Gestionar consultas, cotizaciones, pedidos, pagos, envíos y servicio posventa.',
      'Coordinar entregas a nivel nacional en Colombia y comunicar el estado de su compra.',
      'Emitir facturación, certificados, garantías y documentación asociada a la compra.',
      'Enviar información comercial, novedades de colección o promociones, cuando exista autorización previa.',
      'Prevenir fraudes, garantizar la seguridad del sitio y cumplir obligaciones legales.',
      'Mejorar la experiencia de usuario mediante análisis estadístico y cookies técnicas o analíticas.',
    ],
  },
  {
    title: '5. Derechos del titular',
    paragraphs: ['Como titular de los datos personales, usted tiene derecho a:'],
    list: [
      'Conocer, actualizar y rectificar sus datos personales.',
      'Solicitar prueba de la autorización otorgada, cuando aplique.',
      'Ser informado sobre el uso dado a sus datos.',
      'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
      'Revocar la autorización y/o solicitar la supresión del dato, salvo deber legal o contractual.',
      'Acceder de forma gratuita a sus datos personales.',
    ],
  },
  {
    title: '6. Procedimiento para ejercer sus derechos',
    paragraphs: [
      'Para ejercer sus derechos de Habeas Data, envíe una solicitud a privacidad@luxtime.co indicando su nombre completo, medio de contacto, descripción de la solicitud y copia de su documento de identidad. Luxtime responderá en los términos establecidos por la normativa vigente.',
    ],
  },
  {
    title: '7. Transferencia y transmisión de datos',
    paragraphs: [
      'Luxtime podrá compartir datos con proveedores de logística, pasarelas de pago, servicios de mensajería, hosting, analítica web y herramientas de comunicación, únicamente para cumplir las finalidades descritas y bajo estándares razonables de confidencialidad y seguridad.',
      'No vendemos ni comercializamos datos personales a terceros.',
    ],
  },
  {
    title: '8. Seguridad de la información',
    paragraphs: [
      'Implementamos medidas técnicas, administrativas y organizacionales razonables para proteger la información contra acceso no autorizado, pérdida, alteración o divulgación indebida. No obstante, ningún sistema es completamente infalible; por ello recomendamos proteger sus credenciales y dispositivos.',
    ],
  },
  {
    title: '9. Cookies y tecnologías similares',
    paragraphs: [
      'Utilizamos cookies y tecnologías similares para el funcionamiento del sitio, recordar preferencias y, cuando usted lo autorice, realizar mediciones de uso. Puede gestionar su consentimiento desde el aviso de cookies o la configuración de su navegador.',
    ],
  },
  {
    title: '10. Vigencia y modificaciones',
    paragraphs: [
      'Esta política podrá actualizarse en cualquier momento para reflejar cambios legales, operativos o tecnológicos. La versión vigente estará siempre disponible en esta página con su fecha de actualización.',
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    title: '1. Objeto y aceptación',
    paragraphs: [
      'Los presentes Términos y Condiciones regulan el acceso, navegación y compra de productos ofrecidos por Luxtime Luxury Timepieces a través de su sitio web y canales digitales autorizados. Al utilizar el sitio o confirmar un pedido, usted declara haber leído y aceptado estas condiciones.',
    ],
  },
  {
    title: '2. Capacidad y veracidad de la información',
    paragraphs: [
      'Para realizar compras debe ser mayor de edad y contar con capacidad legal para contratar. Usted se compromete a proporcionar información veraz, completa y actualizada en el proceso de compra, facturación y entrega.',
    ],
  },
  {
    title: '3. Productos, precios y disponibilidad',
    paragraphs: [
      'Las imágenes, descripciones, referencias y precios publicados tienen carácter informativo y pueden actualizarse sin previo aviso. La disponibilidad de cada pieza se confirma al momento de validar el pedido. Luxtime se reserva el derecho de corregir errores tipográficos o de precio antes de la confirmación definitiva de la compra.',
    ],
  },
  {
    title: '4. Proceso de compra',
    paragraphs: [
      'Las compras pueden iniciarse mediante el carrito del sitio y finalizarse por los canales de pago o coordinación comercial habilitados, incluyendo WhatsApp cuando aplique. Un pedido se considera confirmado una vez validado el pago, la disponibilidad del producto y los datos de entrega.',
    ],
  },
  {
    title: '5. Envíos a nivel nacional en Colombia',
    paragraphs: ['Luxtime realiza envíos a nivel nacional conforme a las siguientes condiciones generales:'],
    list: [
      'Los tiempos de entrega se informan al confirmar el pedido y pueden variar según ciudad, transportadora y disponibilidad del producto.',
      'El costo de envío se calcula según la zona de destino y será informado antes del pago final.',
      'Es responsabilidad del cliente verificar que la dirección y datos de contacto sean correctos.',
      'En caso de devolución fallida por datos incorrectos o ausencia del destinatario, podrán aplicarse costos adicionales de reenvío.',
    ],
  },
  {
    title: '6. Garantías',
    paragraphs: [
      'Los productos comercializados por Luxtime pueden incluir garantía del fabricante, garantía comercial o certificación de autenticidad, según se indique en la ficha del producto o documentación entregada con la compra. La cobertura, plazo y exclusiones dependerán del tipo de pieza adquirida y de las condiciones específicas comunicadas al momento de la venta.',
    ],
  },
  {
    title: '7. Cambios y devoluciones',
    paragraphs: [
      'Por la naturaleza de los productos de lujo y su valor, los cambios y devoluciones se evaluarán caso a caso, de acuerdo con el estado del producto, su uso, empaque original, accesorios, certificados y plazos informados al momento de la compra. No se aceptarán devoluciones de productos personalizados, alterados o que no conserven sus condiciones originales, salvo defecto de fabricación debidamente acreditado.',
    ],
  },
  {
    title: '8. Propiedad intelectual',
    paragraphs: [
      'Todo el contenido del sitio, incluyendo marcas, logotipos, textos, fotografías, diseño y software, es propiedad de Luxtime o de sus respectivos titulares y está protegido por la legislación aplicable. Queda prohibida su reproducción sin autorización previa y por escrito.',
    ],
  },
  {
    title: '9. Limitación de responsabilidad',
    paragraphs: [
      'Luxtime no será responsable por interrupciones temporales del sitio, fallas de terceros proveedores, fuerza mayor o uso indebido de la plataforma por parte del usuario. La responsabilidad de Luxtime, cuando proceda, se limitará al valor efectivamente pagado por el producto objeto de la reclamación, salvo disposición legal en contrario.',
    ],
  },
  {
    title: '10. Ley aplicable y jurisdicción',
    paragraphs: [
      'Estos Términos y Condiciones se rigen por las leyes de la República de Colombia. Cualquier controversia será sometida a los jueces competentes del domicilio de Luxtime en Piedecuesta, salvo norma imperativa en contrario.',
    ],
  },
  {
    title: '11. Modificaciones',
    paragraphs: [
      'Luxtime podrá modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor desde su publicación en esta página. Se recomienda revisar periódicamente este documento.',
    ],
  },
];

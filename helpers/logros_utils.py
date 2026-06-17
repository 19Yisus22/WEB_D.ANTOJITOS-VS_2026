from __future__ import annotations
from datetime import date, datetime, timezone, timedelta
import logging

COLOMBIA_TZ = timezone(timedelta(hours=-5))

logger = logging.getLogger(__name__)

def _l(modulo, codigo, nombre, desc, icono, rareza, puntos, roles, meta=None, campo=None):
    d = {
        "codigo": codigo, "nombre": nombre, "descripcion": desc,
        "icono": icono, "rareza": rareza, "puntos": puntos,
        "roles": roles, "modulo": modulo,
    }
    if meta is not None:
        d["meta"] = meta
    if campo is not None:
        d["campo"] = campo
    return d

C = ["cliente"]
V = ["vendedor"]
A = ["admin"]

_INICIO = [
    _l("inicio","ini_c1","¡Bienvenido!","Iniciaste sesión por primera vez","🌟","comun",5,C),
    _l("inicio","ini_c2","Noctámbulo digital","Iniciaste sesión después de las 11 PM","🌙","comun",10,C),
    _l("inicio","ini_c3","Madrugador de postres","Iniciaste sesión antes de las 6 AM","☀️","raro",15,C),
    _l("inicio","ini_c4","Dulce fin de semana","Iniciaste sesión un sábado o domingo","🎊","comun",10,C),
    _l("inicio","ini_c5","Cumpleaños en línea","Iniciaste sesión en tu propio cumpleaños","🎂","legendario",150,C),
    _l("inicio","ini_c6","Visitante habitual","5 días seguidos en la página de inicio","🗓️","comun",15,C,meta=5,campo="s_inicio"),
    _l("inicio","ini_c7","Fan del inicio","20 días distintos en la página de inicio","🔥","raro",30,C,meta=20,campo="v_inicio"),
    _l("inicio","ini_v1","A trabajar","Primera sesión como vendedor","💼","comun",5,V),
    _l("inicio","ini_v2","Madrugador laboral","Iniciaste sesión antes de las 7 AM","☕","comun",10,V),
    _l("inicio","ini_v3","Noche de trabajo","Iniciaste sesión después de las 10 PM","🌙","comun",10,V),
    _l("inicio","ini_v4","Fin de semana activo","Iniciaste sesión un sábado o domingo","💪","comun",10,V),
    _l("inicio","ini_v5","Constancia laboral","7 días consecutivos en inicio","⏰","comun",15,V,meta=7,campo="s_inicio"),
    _l("inicio","ini_v6","Empleado comprometido","20 días en la página de inicio","📋","raro",30,V,meta=20,campo="v_inicio"),
    _l("inicio","ini_v7","Maestro del horario","30 días en la página de inicio","🏆","epico",60,V,meta=30,campo="v_inicio"),
    _l("inicio","ini_a1","Al mando","Primera sesión como administrador","🎖️","comun",10,A),
    _l("inicio","ini_a2","Supervisor nocturno","Sesión después de las 11 PM como administrador","🦉","raro",20,A),
    _l("inicio","ini_a3","Control madrugador","Sesión antes de las 6 AM como administrador","🌅","raro",20,A),
    _l("inicio","ini_a4","Presencia constante","7 días consecutivos como administrador","📊","raro",25,A,meta=7,campo="s_inicio"),
    _l("inicio","ini_a5","Pilar del sistema","20 días en la página de inicio","🏆","epico",50,A,meta=20,campo="v_inicio"),
    _l("inicio","ini_a6","Guardián digital","Sesión un sábado o domingo como administrador","🛡️","comun",10,A),
    _l("inicio","ini_a7","Maestro del inicio","30 días en la página de inicio","👑","legendario",150,A,meta=30,campo="v_inicio"),
    _l("inicio","ini_c8","Mediodía goloso","Iniciaste sesión a la hora del almuerzo (12-2 PM)","🍽️","comun",10,C),
    _l("inicio","ini_c9","Racha sólida","10 días seguidos en la página de inicio","⚡","raro",30,C,meta=10,campo="s_inicio"),
    _l("inicio","ini_c10","Habitante del portal","30 días distintos en la página de inicio","🏠","epico",55,C,meta=30,campo="v_inicio"),
    _l("inicio","ini_v8","Mediodía laboral","Iniciaste sesión durante el mediodía (12-2 PM)","☕","comun",10,V),
    _l("inicio","ini_v9","Racha profesional","10 días consecutivos en inicio","🔥","raro",35,V,meta=10,campo="s_inicio"),
    _l("inicio","ini_v10","Presencia total","45 días en la página de inicio","🏆","legendario",100,V,meta=45,campo="v_inicio"),
    _l("inicio","ini_a8","Mediodía administrativo","Sesión al mediodía como administrador","📊","comun",10,A),
    _l("inicio","ini_a9","Control férreo","14 días consecutivos como administrador","⚙️","epico",60,A,meta=14,campo="s_inicio"),
    _l("inicio","ini_a10","Centinela del sistema","45 días en la página de inicio","👑","legendario",140,A,meta=45,campo="v_inicio"),
]

_CATALOGO = [
    _l("catalogo","cat_c1","Explorador goloso","Primera visita al catálogo","🔍","comun",5,C),
    _l("catalogo","cat_c2","Curioso digital","5 días visitando el catálogo","👀","comun",10,C,meta=5,campo="v_catalogo"),
    _l("catalogo","cat_c3","Cazador de postres","15 días visitando el catálogo","🎯","raro",20,C,meta=15,campo="v_catalogo"),
    _l("catalogo","cat_c4","Connoisseur","30 días visitando el catálogo","🍰","raro",30,C,meta=30,campo="v_catalogo"),
    _l("catalogo","cat_c5","Compra variada","Compraste productos de 3 categorías distintas","🌈","raro",30,C),
    _l("catalogo","cat_c6","Explorador total","Compraste de 5 categorías distintas","🗺️","epico",60,C),
    _l("catalogo","cat_c7","Sibarita","Compraste 10 productos distintos","🏅","legendario",100,C,meta=10,campo="productos_distintos"),
    _l("catalogo","cat_v1","Vigilante del catálogo","Primera visita al catálogo como vendedor","📋","comun",5,V),
    _l("catalogo","cat_v2","Conocedor del menú","5 días visitando el catálogo","📝","comun",10,V,meta=5,campo="v_catalogo"),
    _l("catalogo","cat_v3","Analista de productos","15 días visitando el catálogo","📊","raro",20,V,meta=15,campo="v_catalogo"),
    _l("catalogo","cat_v4","Curador del catálogo","30 días visitando el catálogo","🎨","raro",30,V,meta=30,campo="v_catalogo"),
    _l("catalogo","cat_v5","Experto del menú","7 días consecutivos en el catálogo","🌟","epico",50,V,meta=7,campo="s_catalogo"),
    _l("catalogo","cat_v6","Maestro del catálogo","20 días en el catálogo","🏆","epico",70,V,meta=20,campo="v_catalogo"),
    _l("catalogo","cat_v7","Enciclopedia del sabor","30 días en el catálogo","📚","legendario",120,V,meta=30,campo="v_catalogo"),
    _l("catalogo","cat_a1","Primer vistazo","Primera visita al catálogo como administrador","👁️","comun",5,A),
    _l("catalogo","cat_a2","Evaluador activo","5 días visitando el catálogo","📋","comun",10,A,meta=5,campo="v_catalogo"),
    _l("catalogo","cat_a3","Inspector","15 días visitando el catálogo","🔎","raro",20,A,meta=15,campo="v_catalogo"),
    _l("catalogo","cat_a4","Auditor de catálogo","30 días visitando el catálogo","📊","raro",30,A,meta=30,campo="v_catalogo"),
    _l("catalogo","cat_a5","Catálogo robusto","20 o más productos activos en el sistema","📦","raro",30,A,meta=20,campo="sistema_productos"),
    _l("catalogo","cat_a6","Gran inventario","50 o más productos activos en el sistema","🏪","epico",60,A,meta=50,campo="sistema_productos"),
    _l("catalogo","cat_a7","Megatienda","100 o más productos activos en el sistema","🌟","legendario",120,A,meta=100,campo="sistema_productos"),
    _l("catalogo","cat_c8","Vitrina favorita","7 días consecutivos visitando el catálogo","💫","raro",35,C,meta=7,campo="s_catalogo"),
    _l("catalogo","cat_c9","Obsesionado con el menú","50 días visitando el catálogo","🍰","epico",70,C,meta=50,campo="v_catalogo"),
    _l("catalogo","cat_c10","Experto catador","15 productos distintos comprados","🎖️","epico",80,C,meta=15,campo="productos_distintos"),
    _l("catalogo","cat_v8","Catálogo al día","10 días consecutivos en el catálogo","🔄","raro",40,V,meta=10,campo="s_catalogo"),
    _l("catalogo","cat_v9","Monitor de disponibilidad","45 días visitando el catálogo","📡","epico",85,V,meta=45,campo="v_catalogo"),
    _l("catalogo","cat_v10","Amo del inventario","60 días visitando el catálogo","🏅","legendario",145,V,meta=60,campo="v_catalogo"),
    _l("catalogo","cat_a8","Racha de auditoría","10 días consecutivos en el catálogo","🔎","raro",35,A,meta=10,campo="s_catalogo"),
    _l("catalogo","cat_a9","150 productos activos","150 o más productos activos en el sistema","📦","epico",90,A,meta=150,campo="sistema_productos"),
    _l("catalogo","cat_a10","Supermercado digital","200 o más productos activos en el sistema","🏪","legendario",160,A,meta=200,campo="sistema_productos"),
]

_CARRITO = [
    _l("carrito","cart_c1","Primer artículo","Añadiste algo al carrito por primera vez","🛒","comun",5,C),
    _l("carrito","cart_c2","Llenando el carrito","Carrito con 3 o más productos","📦","comun",10,C),
    _l("carrito","cart_c3","Comprador voraz","Carrito con 7 o más productos","🛍️","raro",20,C),
    _l("carrito","cart_c4","Gran pedido","Carrito con 10 o más productos","🎁","raro",30,C),
    _l("carrito","cart_c5","Inversión dulce","Carrito superó $50.000 COP","💰","raro",30,C),
    _l("carrito","cart_c6","Festín de postres","Carrito superó $150.000 COP","💎","epico",60,C),
    _l("carrito","cart_c7","El gran banquete","Carrito superó $300.000 COP","🤑","legendario",100,C),
    _l("carrito","cart_v1","Vendiendo en el sitio","Primera visita al módulo de carrito","🛒","comun",5,V),
    _l("carrito","cart_v2","Monitor de pedidos","5 días visitando el módulo de carrito","👁️","comun",10,V,meta=5,campo="v_carrito"),
    _l("carrito","cart_v3","Seguimiento activo","15 días visitando el módulo de carrito","📊","raro",20,V,meta=15,campo="v_carrito"),
    _l("carrito","cart_v4","50 ventas del sistema","50 pedidos totales en la plataforma","🏪","raro",25,V,meta=50,campo="sistema_pedidos"),
    _l("carrito","cart_v5","100 ventas del sistema","100 pedidos totales en la plataforma","💹","raro",35,V,meta=100,campo="sistema_pedidos"),
    _l("carrito","cart_v6","500 ventas del sistema","500 pedidos totales en la plataforma","🌟","epico",70,V,meta=500,campo="sistema_pedidos"),
    _l("carrito","cart_v7","Plataforma productiva","1000 pedidos totales en la plataforma","🏆","legendario",120,V,meta=1000,campo="sistema_pedidos"),
    _l("carrito","cart_a1","Administrador de ventas","Primera visita al módulo de carrito","📊","comun",5,A),
    _l("carrito","cart_a2","Analista de ventas","5 días visitando el módulo de carrito","📈","comun",10,A,meta=5,campo="v_carrito"),
    _l("carrito","cart_a3","Monitor de comercio","15 días visitando el módulo de carrito","📋","raro",20,A,meta=15,campo="v_carrito"),
    _l("carrito","cart_a4","Economía activa","50 pedidos totales en la plataforma","💹","raro",25,A,meta=50,campo="sistema_pedidos"),
    _l("carrito","cart_a5","Crecimiento sólido","100 pedidos totales en la plataforma","📈","raro",35,A,meta=100,campo="sistema_pedidos"),
    _l("carrito","cart_a6","Gran plataforma","500 pedidos totales en la plataforma","🌟","epico",70,A,meta=500,campo="sistema_pedidos"),
    _l("carrito","cart_a7","Ecosistema próspero","1000 pedidos totales en la plataforma","🏆","legendario",120,A,meta=1000,campo="sistema_pedidos"),
    _l("carrito","cart_c8","Carrito de campeón","Carrito con 15 o más productos","🎯","epico",70,C),
    _l("carrito","cart_c9","Gran festín","Carrito superó $500.000 COP","💎","legendario",130,C),
    _l("carrito","cart_c10","El millonario del dulce","Carrito superó $1.000.000 COP","🤑","legendario",200,C),
    _l("carrito","cart_v8","Racha de carritos","10 días consecutivos en el carrito","🔥","raro",40,V,meta=10,campo="s_carrito"),
    _l("carrito","cart_v9","2000 ventas del sistema","2000 pedidos totales en la plataforma","💹","epico",90,V,meta=2000,campo="sistema_pedidos"),
    _l("carrito","cart_v10","Plataforma élite","5000 pedidos totales en la plataforma","👑","legendario",160,V,meta=5000,campo="sistema_pedidos"),
    _l("carrito","cart_a8","Racha de análisis","10 días consecutivos en el carrito","📈","raro",35,A,meta=10,campo="s_carrito"),
    _l("carrito","cart_a9","Economía en crecimiento","2000 pedidos totales en la plataforma","📊","epico",90,A,meta=2000,campo="sistema_pedidos"),
    _l("carrito","cart_a10","Gran mercado","5000 pedidos totales en la plataforma","🌐","legendario",160,A,meta=5000,campo="sistema_pedidos"),
]

_PAGOS = [
    _l("pagos","pago_c1","¡Primer bocado!","Realizaste tu primera compra","🛒","comun",20,C),
    _l("pagos","pago_c2","Ya le agarré el gusto","3 pedidos realizados","🎁","comun",20,C,meta=3,campo="total_pedidos"),
    _l("pagos","pago_c3","Asiduo","5 pedidos realizados","🏅","raro",35,C,meta=5,campo="total_pedidos"),
    _l("pagos","pago_c4","Cliente frecuente","10 pedidos realizados","🥇","raro",50,C,meta=10,campo="total_pedidos"),
    _l("pagos","pago_c5","Superfan","20 pedidos realizados","👑","epico",80,C,meta=20,campo="total_pedidos"),
    _l("pagos","pago_c6","Leyenda del postre","50 pedidos realizados","🏆","legendario",150,C,meta=50,campo="total_pedidos"),
    _l("pagos","pago_c7","Incontenible","100 pedidos realizados","💎","legendario",200,C,meta=100,campo="total_pedidos"),
    _l("pagos","pago_v1","Primera transacción","Primera visita a la zona de pagos","💳","comun",5,V),
    _l("pagos","pago_v2","Seguimiento financiero","5 días en la zona de pagos","📊","comun",10,V,meta=5,campo="v_pagos"),
    _l("pagos","pago_v3","Contador activo","15 días en la zona de pagos","💰","raro",20,V,meta=15,campo="v_pagos"),
    _l("pagos","pago_v4","50K en el sistema","$50.000 COP en ventas totales del sistema","💸","raro",25,V,meta=50000,campo="sistema_gastado"),
    _l("pagos","pago_v5","500K en el sistema","$500.000 COP en ventas totales del sistema","💎","raro",40,V,meta=500000,campo="sistema_gastado"),
    _l("pagos","pago_v6","2M en ventas","$2.000.000 COP en ventas totales del sistema","🏆","epico",70,V,meta=2000000,campo="sistema_gastado"),
    _l("pagos","pago_v7","10M en ventas","$10.000.000 COP en ventas totales del sistema","👑","legendario",150,V,meta=10000000,campo="sistema_gastado"),
    _l("pagos","pago_a1","Control de pagos","Primera visita a la zona de pagos","💳","comun",5,A),
    _l("pagos","pago_a2","Supervisor financiero","5 días en la zona de pagos","📊","comun",10,A,meta=5,campo="v_pagos"),
    _l("pagos","pago_a3","Analista de ingresos","15 días en la zona de pagos","💰","raro",20,A,meta=15,campo="v_pagos"),
    _l("pagos","pago_a4","Plataforma financiera","$500.000 COP en ventas totales del sistema","💸","raro",35,A,meta=500000,campo="sistema_gastado"),
    _l("pagos","pago_a5","Gran negocio","$2.000.000 COP en ventas totales del sistema","🏆","epico",70,A,meta=2000000,campo="sistema_gastado"),
    _l("pagos","pago_a6","Empresa sólida","$10.000.000 COP en ventas totales del sistema","👑","legendario",150,A,meta=10000000,campo="sistema_gastado"),
    _l("pagos","pago_a7","Cashflow épico","$50.000.000 COP en ventas totales del sistema","💥","legendario",200,A,meta=50000000,campo="sistema_gastado"),
    _l("pagos","pago_c8","Pedidos sin parar","200 pedidos realizados","🚀","legendario",250,C,meta=200,campo="total_pedidos"),
    _l("pagos","pago_c9","Millón en postres","Gastaste más de $1.000.000 COP en total","💸","legendario",180,C,meta=1000000,campo="total_gastado"),
    _l("pagos","pago_c10","Cinco millones de sabor","Gastaste más de $5.000.000 COP en total","💰","legendario",250,C,meta=5000000,campo="total_gastado"),
    _l("pagos","pago_v8","50M en ventas del sistema","$50.000.000 COP en ventas totales del sistema","🏆","legendario",200,V,meta=50000000,campo="sistema_gastado"),
    _l("pagos","pago_v9","Racha financiera","10 días consecutivos en la zona de pagos","💳","raro",35,V,meta=10,campo="s_pagos"),
    _l("pagos","pago_v10","Dedicación financiera","30 días en la zona de pagos","📅","epico",60,V,meta=30,campo="v_pagos"),
    _l("pagos","pago_a8","100M en ventas totales","$100.000.000 COP en ventas totales del sistema","🌟","legendario",250,A,meta=100000000,campo="sistema_gastado"),
    _l("pagos","pago_a9","Racha de auditoría financiera","10 días consecutivos en zona de pagos","🔍","raro",30,A,meta=10,campo="s_pagos"),
    _l("pagos","pago_a10","Auditoría continua","30 días en la zona de pagos","📊","epico",65,A,meta=30,campo="v_pagos"),
]

_SUGERENCIAS = [
    _l("sugerencias","sug_c1","Voz propia","Publicaste tu primera sugerencia","💬","comun",15,C),
    _l("sugerencias","sug_c2","Siempre con ideas","5 sugerencias publicadas","📢","comun",20,C,meta=5,campo="total_comentarios"),
    _l("sugerencias","sug_c3","El vocero","10 sugerencias publicadas","📣","raro",35,C,meta=10,campo="total_comentarios"),
    _l("sugerencias","sug_c4","Influencer del sabor","20 sugerencias publicadas","🌟","epico",60,C,meta=20,campo="total_comentarios"),
    _l("sugerencias","sug_c5","Me dieron like","Tu sugerencia recibió 5 likes","❤️","comun",20,C),
    _l("sugerencias","sug_c6","¡Viral!","Tu sugerencia recibió 20 likes","🔥","epico",80,C),
    _l("sugerencias","sug_c7","Fenómeno social","Tu sugerencia recibió 50 likes","💥","legendario",150,C),
    _l("sugerencias","sug_v1","Escuchando al cliente","Primera visita al módulo de sugerencias","👂","comun",5,V),
    _l("sugerencias","sug_v2","Atento al feedback","5 días en el módulo de sugerencias","📋","comun",10,V,meta=5,campo="v_sugerencias"),
    _l("sugerencias","sug_v3","Procesando ideas","15 días en el módulo de sugerencias","💡","raro",20,V,meta=15,campo="v_sugerencias"),
    _l("sugerencias","sug_v4","Orientado al cliente","30 días en el módulo de sugerencias","🎯","raro",30,V,meta=30,campo="v_sugerencias"),
    _l("sugerencias","sug_v5","Mi primera sugerencia","Publicaste tu primera sugerencia","💬","comun",15,V),
    _l("sugerencias","sug_v6","Voz vendedora","5 sugerencias publicadas como vendedor","📢","raro",30,V,meta=5,campo="total_comentarios"),
    _l("sugerencias","sug_v7","Maestro del feedback","10 sugerencias publicadas como vendedor","🏆","epico",60,V,meta=10,campo="total_comentarios"),
    _l("sugerencias","sug_a1","Gestor de sugerencias","Primera visita al módulo de sugerencias","📊","comun",5,A),
    _l("sugerencias","sug_a2","Moderador activo","5 días en el módulo de sugerencias","🔧","comun",10,A,meta=5,campo="v_sugerencias"),
    _l("sugerencias","sug_a3","Control de contenido","15 días en el módulo de sugerencias","🛡️","raro",20,A,meta=15,campo="v_sugerencias"),
    _l("sugerencias","sug_a4","Plataforma abierta","10 sugerencias totales en el sistema","💬","raro",25,A,meta=10,campo="sistema_comentarios"),
    _l("sugerencias","sug_a5","Comunidad activa","50 sugerencias totales en el sistema","📣","raro",35,A,meta=50,campo="sistema_comentarios"),
    _l("sugerencias","sug_a6","Gran comunidad","200 sugerencias totales en el sistema","🌟","epico",70,A,meta=200,campo="sistema_comentarios"),
    _l("sugerencias","sug_a7","Foro vibrante","500 sugerencias totales en el sistema","🏆","legendario",120,A,meta=500,campo="sistema_comentarios"),
    _l("sugerencias","sug_c8","El embajador","30 sugerencias publicadas","📣","epico",70,C,meta=30,campo="total_comentarios"),
    _l("sugerencias","sug_c9","Icono de la comunidad","Tu sugerencia recibió 100 likes","💥","legendario",200,C),
    _l("sugerencias","sug_c10","Racha de sugerencias","7 días consecutivos en sugerencias","⚡","raro",35,C,meta=7,campo="s_sugerencias"),
    _l("sugerencias","sug_v8","Feedback épico","20 sugerencias publicadas como vendedor","🌟","epico",80,V,meta=20,campo="total_comentarios"),
    _l("sugerencias","sug_v9","Racha de feedback","7 días consecutivos en sugerencias","🔥","raro",35,V,meta=7,campo="s_sugerencias"),
    _l("sugerencias","sug_v10","Compromiso total","45 días en el módulo de sugerencias","🏅","epico",75,V,meta=45,campo="v_sugerencias"),
    _l("sugerencias","sug_a8","Megaforo","1000 sugerencias totales en el sistema","👑","legendario",180,A,meta=1000,campo="sistema_comentarios"),
    _l("sugerencias","sug_a9","Racha de moderación","7 días consecutivos en sugerencias","🛡️","raro",35,A,meta=7,campo="s_sugerencias"),
    _l("sugerencias","sug_a10","Moderador permanente","45 días en el módulo de sugerencias","🔧","epico",75,A,meta=45,campo="v_sugerencias"),
]

_MENSAJES = [
    _l("mensajes","msg_c1","Hola equipo","Enviaste tu primer mensaje privado","📩","comun",10,C),
    _l("mensajes","msg_c2","Comunicativo","10 mensajes privados enviados","💬","comun",20,C,meta=10,campo="total_mensajes_privados"),
    _l("mensajes","msg_c3","Siempre en contacto","25 mensajes privados enviados","📱","raro",35,C,meta=25,campo="total_mensajes_privados"),
    _l("mensajes","msg_c4","Conversador","50 mensajes privados enviados","🗣️","raro",50,C,meta=50,campo="total_mensajes_privados"),
    _l("mensajes","msg_c5","Networker","100 mensajes privados enviados","📡","epico",80,C,meta=100,campo="total_mensajes_privados"),
    _l("mensajes","msg_c6","Una imagen vale más","Adjuntaste una imagen en el chat","📷","raro",20,C),
    _l("mensajes","msg_c7","Comunicador élite","200 mensajes privados enviados","👑","legendario",150,C,meta=200,campo="total_mensajes_privados"),
    _l("mensajes","msg_v1","Atención al cliente","Enviaste tu primer mensaje privado","📩","comun",10,V),
    _l("mensajes","msg_v2","Soporte activo","10 mensajes privados enviados","💬","comun",20,V,meta=10,campo="total_mensajes_privados"),
    _l("mensajes","msg_v3","Servicio al cliente","25 mensajes privados enviados","🎧","raro",35,V,meta=25,campo="total_mensajes_privados"),
    _l("mensajes","msg_v4","Soporte dedicado","50 mensajes privados enviados","🏅","raro",50,V,meta=50,campo="total_mensajes_privados"),
    _l("mensajes","msg_v5","Helpdesk estrella","100 mensajes privados enviados","🌟","epico",80,V,meta=100,campo="total_mensajes_privados"),
    _l("mensajes","msg_v6","Imagen en chat","Adjuntaste una imagen en el chat","📷","raro",20,V),
    _l("mensajes","msg_v7","Comunicador profesional","200 mensajes privados enviados","👑","legendario",120,V,meta=200,campo="total_mensajes_privados"),
    _l("mensajes","msg_a1","Supervisor de mensajes","Primera visita al módulo de mensajes","📊","comun",5,A),
    _l("mensajes","msg_a2","Moderador de chat","5 días en el módulo de mensajes","🔧","comun",10,A,meta=5,campo="v_mensajes"),
    _l("mensajes","msg_a3","Control de comunicación","15 días en el módulo de mensajes","🛡️","raro",20,A,meta=15,campo="v_mensajes"),
    _l("mensajes","msg_a4","Mensajería activa","50 mensajes totales en el sistema","💬","raro",25,A,meta=50,campo="sistema_mensajes"),
    _l("mensajes","msg_a5","Comunidad conectada","200 mensajes totales en el sistema","📡","raro",35,A,meta=200,campo="sistema_mensajes"),
    _l("mensajes","msg_a6","Gran comunidad activa","500 mensajes totales en el sistema","🌟","epico",60,A,meta=500,campo="sistema_mensajes"),
    _l("mensajes","msg_a7","Red de comunicación","1000 mensajes totales en el sistema","🏆","legendario",120,A,meta=1000,campo="sistema_mensajes"),
    _l("mensajes","msg_c8","Incansable","300 mensajes privados enviados","📱","epico",100,C,meta=300,campo="total_mensajes_privados"),
    _l("mensajes","msg_c9","Teléfono roto","500 mensajes privados enviados","💬","legendario",180,C,meta=500,campo="total_mensajes_privados"),
    _l("mensajes","msg_c10","Racha de chat","7 días consecutivos en mensajes","⚡","raro",30,C,meta=7,campo="s_mensajes"),
    _l("mensajes","msg_v8","Centro de soporte","300 mensajes privados enviados","🎧","epico",100,V,meta=300,campo="total_mensajes_privados"),
    _l("mensajes","msg_v9","Agente top","500 mensajes privados enviados","🌟","legendario",160,V,meta=500,campo="total_mensajes_privados"),
    _l("mensajes","msg_v10","Racha de soporte","7 días consecutivos en mensajes","🏅","raro",35,V,meta=7,campo="s_mensajes"),
    _l("mensajes","msg_a8","2000 mensajes en el sistema","2000 mensajes totales en el sistema","📡","epico",90,A,meta=2000,campo="sistema_mensajes"),
    _l("mensajes","msg_a9","Plataforma conversacional","5000 mensajes totales en el sistema","🌐","legendario",180,A,meta=5000,campo="sistema_mensajes"),
    _l("mensajes","msg_a10","Racha de moderación de chat","7 días consecutivos en mensajes","🔧","raro",30,A,meta=7,campo="s_mensajes"),
]

_PERFIL = [
    _l("perfil","prf_c1","¡Me llamo así!","Elegiste tu nombre de usuario","🏷️","comun",10,C),
    _l("perfil","prf_c2","Siempre localizable","Registraste tu número de teléfono","📱","comun",10,C),
    _l("perfil","prf_c3","En mi puerta","Guardaste tu dirección de entrega","🏠","comun",10,C),
    _l("perfil","prf_c4","Que no se olvide","Registraste tu fecha de cumpleaños","🎂","comun",15,C),
    _l("perfil","prf_c5","Cara conocida","Subiste una foto de perfil propia (no predeterminada)","📸","raro",20,C),
    _l("perfil","prf_c6","Perfil al 100%","Completaste todos los campos de tu perfil con foto propia","✅","epico",50,C),
    _l("perfil","prf_c7","Veterano","Llevas más de 30 días registrado","🌟","raro",25,C,meta=30,campo="dias_registrado"),
    _l("perfil","prf_v1","Nombre de negocio","Elegiste tu nombre de usuario","🏷️","comun",10,V),
    _l("perfil","prf_v2","Contacto disponible","Registraste tu número de teléfono","📱","comun",10,V),
    _l("perfil","prf_v3","Ubicación definida","Guardaste tu dirección","🏠","comun",10,V),
    _l("perfil","prf_v4","Foto profesional","Subiste una foto de perfil propia (no predeterminada)","📸","raro",20,V),
    _l("perfil","prf_v5","Perfil de vendedor","Completaste todos los campos de tu perfil con foto propia","✅","epico",50,V),
    _l("perfil","prf_v6","Cumpleaños registrado","Registraste tu fecha de cumpleaños","🎂","comun",15,V),
    _l("perfil","prf_v7","Veterano del negocio","Llevas más de 30 días registrado","🌟","raro",25,V,meta=30,campo="dias_registrado"),
    _l("perfil","prf_a1","Identidad admin","Elegiste tu nombre de usuario","🏷️","comun",10,A),
    _l("perfil","prf_a2","Contacto admin","Registraste tu número de teléfono","📱","comun",10,A),
    _l("perfil","prf_a3","Dirección confirmada","Guardaste tu dirección","🏠","comun",10,A),
    _l("perfil","prf_a4","Foto oficial","Subiste una foto de perfil propia (no predeterminada)","📸","raro",20,A),
    _l("perfil","prf_a5","Perfil administrativo","Completaste todos los campos de tu perfil con foto propia","✅","epico",50,A),
    _l("perfil","prf_a6","Cumpleaños anotado","Registraste tu fecha de cumpleaños","🎂","comun",15,A),
    _l("perfil","prf_a7","Administrador veterano","Llevas más de 30 días registrado","🌟","raro",30,A,meta=30,campo="dias_registrado"),
    _l("perfil","prf_c8","Perfil explorado","10 días visitando tu perfil","🔍","comun",20,C,meta=10,campo="v_perfil"),
    _l("perfil","prf_c9","Perfil VIP","25 días visitando tu perfil","💎","raro",35,C,meta=25,campo="v_perfil"),
    _l("perfil","prf_c10","Perfil legendario","50 días visitando tu perfil","👑","epico",65,C,meta=50,campo="v_perfil"),
    _l("perfil","prf_v8","Perfil activo del negocio","10 días visitando tu perfil","🏷️","comun",20,V,meta=10,campo="v_perfil"),
    _l("perfil","prf_v9","Imagen de marca","25 días visitando tu perfil","🎨","raro",35,V,meta=25,campo="v_perfil"),
    _l("perfil","prf_v10","Representación total","50 días visitando tu perfil","🌟","epico",65,V,meta=50,campo="v_perfil"),
    _l("perfil","prf_a8","Perfil oficial explorado","10 días visitando tu perfil","📋","comun",20,A,meta=10,campo="v_perfil"),
    _l("perfil","prf_a9","Autoridad visible","25 días visitando tu perfil","🛡️","raro",35,A,meta=25,campo="v_perfil"),
    _l("perfil","prf_a10","Presencia de élite","50 días visitando tu perfil","🎖️","epico",70,A,meta=50,campo="v_perfil"),
]

_HISTORIAL = [
    _l("historial","fac_c1","Primera factura","Recibiste tu primera factura","🧾","comun",15,C),
    _l("historial","fac_c2","Historial activo","3 facturas generadas","📂","comun",20,C,meta=3,campo="total_facturas"),
    _l("historial","fac_c3","Comprador registrado","5 facturas generadas","📋","raro",30,C,meta=5,campo="total_facturas"),
    _l("historial","fac_c4","Historial completo","10 facturas generadas","📊","raro",45,C,meta=10,campo="total_facturas"),
    _l("historial","fac_c5","Cliente VIP","20 facturas generadas","💎","epico",70,C,meta=20,campo="total_facturas"),
    _l("historial","fac_c6","Dulce inversión","Gastaste más de $50.000 COP en total","💰","raro",30,C,meta=50000,campo="total_gastado"),
    _l("historial","fac_c7","Rey del dulce","Gastaste más de $500.000 COP en total","🤑","legendario",150,C,meta=500000,campo="total_gastado"),
    _l("historial","fac_v1","Gestión de facturas","Primera visita al historial","📊","comun",5,V),
    _l("historial","fac_v2","Seguimiento activo","5 días en el historial","📋","comun",10,V,meta=5,campo="v_historial"),
    _l("historial","fac_v3","Analista financiero","15 días en el historial","💰","raro",20,V,meta=15,campo="v_historial"),
    _l("historial","fac_v4","10 facturas en el sistema","10 facturas totales en el sistema","📂","raro",25,V,meta=10,campo="sistema_facturas"),
    _l("historial","fac_v5","50 facturas en el sistema","50 facturas totales en el sistema","📈","raro",35,V,meta=50,campo="sistema_facturas"),
    _l("historial","fac_v6","200 facturas en el sistema","200 facturas totales en el sistema","🌟","epico",65,V,meta=200,campo="sistema_facturas"),
    _l("historial","fac_v7","500 facturas en el sistema","500 facturas totales en el sistema","🏆","legendario",130,V,meta=500,campo="sistema_facturas"),
    _l("historial","fac_a1","Supervisor de facturas","Primera visita al historial","📊","comun",5,A),
    _l("historial","fac_a2","Auditor de facturas","5 días en el historial","🔎","comun",10,A,meta=5,campo="v_historial"),
    _l("historial","fac_a3","Control fiscal","15 días en el historial","💼","raro",20,A,meta=15,campo="v_historial"),
    _l("historial","fac_a4","Facturación activa","10 facturas totales en el sistema","📂","raro",25,A,meta=10,campo="sistema_facturas"),
    _l("historial","fac_a5","Facturación masiva","50 facturas totales en el sistema","📈","raro",35,A,meta=50,campo="sistema_facturas"),
    _l("historial","fac_a6","Sistema contable","200 facturas totales en el sistema","🌟","epico",65,A,meta=200,campo="sistema_facturas"),
    _l("historial","fac_a7","Contabilidad total","500 facturas totales en el sistema","🏆","legendario",130,A,meta=500,campo="sistema_facturas"),
    _l("historial","fac_c8","Historial extenso","50 facturas generadas","📊","epico",80,C,meta=50,campo="total_facturas"),
    _l("historial","fac_c9","Centenario de compras","100 facturas generadas","💯","legendario",150,C,meta=100,campo="total_facturas"),
    _l("historial","fac_c10","El gran gastador","Gastaste más de $1.000.000 COP en total","💰","legendario",200,C,meta=1000000,campo="total_gastado"),
    _l("historial","fac_v8","Mil facturas en el sistema","1000 facturas totales en el sistema","🏆","legendario",180,V,meta=1000,campo="sistema_facturas"),
    _l("historial","fac_v9","Racha de análisis","10 días consecutivos en el historial","📈","raro",35,V,meta=10,campo="s_historial"),
    _l("historial","fac_v10","Dedicación contable","30 días en el historial","📅","epico",60,V,meta=30,campo="v_historial"),
    _l("historial","fac_a8","Sistema facturado masivo","1000 facturas totales en el sistema","🌟","legendario",180,A,meta=1000,campo="sistema_facturas"),
    _l("historial","fac_a9","Racha de auditoría","10 días consecutivos en el historial","🔎","raro",35,A,meta=10,campo="s_historial"),
    _l("historial","fac_a10","Auditoría permanente","30 días en el historial","💼","epico",65,A,meta=30,campo="v_historial"),
]

_PRODUCTOS = [
    _l("gestion_productos","prod_c1","Explorador de sabores","Primera visita al módulo de productos","🛍️","comun",5,C),
    _l("gestion_productos","prod_c2","Producto favorito","Compraste el mismo producto 3 o más veces","🍩","raro",35,C),
    _l("gestion_productos","prod_c3","Variedad es vida","Compraste 3 productos distintos","🌈","comun",15,C,meta=3,campo="productos_distintos"),
    _l("gestion_productos","prod_c4","Aventurero del sabor","Compraste 5 productos distintos","🗺️","raro",30,C,meta=5,campo="productos_distintos"),
    _l("gestion_productos","prod_c5","Coleccionista de sabores","Compraste 10 productos distintos","🎯","epico",60,C,meta=10,campo="productos_distintos"),
    _l("gestion_productos","prod_c6","Siempre hay algo nuevo","Compraste 20 productos distintos","🌟","epico",80,C,meta=20,campo="productos_distintos"),
    _l("gestion_productos","prod_c7","Catador maestro","Compraste 30 productos distintos","👑","legendario",130,C,meta=30,campo="productos_distintos"),
    _l("gestion_productos","prod_v1","Primer producto creado","Creaste tu primer producto","🆕","comun",15,V),
    _l("gestion_productos","prod_v2","Menú en formación","3 días en gestión de productos","📝","comun",10,V,meta=3,campo="v_gestion_productos"),
    _l("gestion_productos","prod_v3","Portafolio activo","10 días en gestión de productos","📋","raro",20,V,meta=10,campo="v_gestion_productos"),
    _l("gestion_productos","prod_v4","Vendedor completo","20 días en gestión de productos","🏪","raro",30,V,meta=20,campo="v_gestion_productos"),
    _l("gestion_productos","prod_v5","Gran catálogo propio","5 días consecutivos en gestión de productos","🌟","epico",60,V,meta=5,campo="s_gestion_productos"),
    _l("gestion_productos","prod_v6","Producto editado","Editaste un producto","🔧","comun",10,V),
    _l("gestion_productos","prod_v7","Maestro del menú","30 días en gestión de productos","🏆","legendario",120,V,meta=30,campo="v_gestion_productos"),
    _l("gestion_productos","prod_a1","Primer producto supervisado","Primera visita a gestión de productos","👁️","comun",5,A),
    _l("gestion_productos","prod_a2","Curador de productos","5 días en gestión de productos","📋","comun",10,A,meta=5,campo="v_gestion_productos"),
    _l("gestion_productos","prod_a3","Inspector de calidad","15 días en gestión de productos","🔎","raro",20,A,meta=15,campo="v_gestion_productos"),
    _l("gestion_productos","prod_a4","Catálogo supervisado","20 o más productos activos","📦","raro",25,A,meta=20,campo="sistema_productos"),
    _l("gestion_productos","prod_a5","Variedad asegurada","50 o más productos activos","🏪","raro",35,A,meta=50,campo="sistema_productos"),
    _l("gestion_productos","prod_a6","Gran inventario activo","100 o más productos activos","🌟","epico",70,A,meta=100,campo="sistema_productos"),
    _l("gestion_productos","prod_a7","Megatienda activa","200 o más productos activos","🏆","legendario",130,A,meta=200,campo="sistema_productos"),
    _l("gestion_productos","prod_c8","Catador experto","Compraste 40 productos distintos","🎖️","epico",100,C,meta=40,campo="productos_distintos"),
    _l("gestion_productos","prod_c9","Sibarita total","Compraste 50 productos distintos","🌟","legendario",140,C,meta=50,campo="productos_distintos"),
    _l("gestion_productos","prod_c10","El catálogo completo","Compraste 60 productos distintos","👑","legendario",200,C,meta=60,campo="productos_distintos"),
    _l("gestion_productos","prod_v8","Racha de gestión","7 días consecutivos en gestión de productos","🔥","raro",40,V,meta=7,campo="s_gestion_productos"),
    _l("gestion_productos","prod_v9","Portafolio total","45 días en gestión de productos","🏅","epico",80,V,meta=45,campo="v_gestion_productos"),
    _l("gestion_productos","prod_v10","Maestro absoluto","60 días en gestión de productos","👑","legendario",150,V,meta=60,campo="v_gestion_productos"),
    _l("gestion_productos","prod_a8","Inventario masivo","300 o más productos activos","🌐","legendario",160,A,meta=300,campo="sistema_productos"),
    _l("gestion_productos","prod_a9","Racha administrativa","10 días consecutivos en gestión de productos","⚙️","raro",40,A,meta=10,campo="s_gestion_productos"),
    _l("gestion_productos","prod_a10","Control absoluto","30 días en gestión de productos","🏆","epico",70,A,meta=30,campo="v_gestion_productos"),
]

_PUBLICIDAD = [
    _l("publicidad","pub_c1","Primera promo vista","Primera visita a la sección de publicidad","🎯","comun",5,C),
    _l("publicidad","pub_c2","Fan de las promos","5 días en publicidad","💡","comun",10,C,meta=5,campo="v_publicidad"),
    _l("publicidad","pub_c3","Cazador de ofertas","15 días en publicidad","🏷️","raro",20,C,meta=15,campo="v_publicidad"),
    _l("publicidad","pub_c4","Ofertero empedernido","30 días en publicidad","🔥","raro",30,C,meta=30,campo="v_publicidad"),
    _l("publicidad","pub_c5","Comprador por anuncio","Compraste en tu primera visita al catálogo","🛒","raro",30,C),
    _l("publicidad","pub_c6","Seguidor de marcas","5 días consecutivos en publicidad","📢","epico",60,C,meta=5,campo="s_publicidad"),
    _l("publicidad","pub_c7","Fan total","30 días en publicidad","💥","legendario",100,C,meta=30,campo="v_publicidad"),
    _l("publicidad","pub_v1","Primera publicidad","Creaste tu primera publicidad","📢","comun",15,V),
    _l("publicidad","pub_v2","Estrategia visual","3 días en el módulo de publicidad","🎨","comun",10,V,meta=3,campo="v_publicidad"),
    _l("publicidad","pub_v3","Campaña activa","10 días en el módulo de publicidad","📣","raro",20,V,meta=10,campo="v_publicidad"),
    _l("publicidad","pub_v4","Publicista activo","20 días en el módulo de publicidad","🏆","raro",30,V,meta=20,campo="v_publicidad"),
    _l("publicidad","pub_v5","Maestro del marketing","7 días consecutivos en publicidad","🌟","epico",60,V,meta=7,campo="s_publicidad"),
    _l("publicidad","pub_v6","Publicidad editada","Editaste una publicidad","🔧","comun",10,V),
    _l("publicidad","pub_v7","Campaña épica","30 días en el módulo de publicidad","👑","legendario",120,V,meta=30,campo="v_publicidad"),
    _l("publicidad","pub_a1","Gestor de publicidad","Primera visita al módulo de publicidad","📊","comun",5,A),
    _l("publicidad","pub_a2","Supervisor de anuncios","5 días en el módulo de publicidad","📋","comun",10,A,meta=5,campo="v_publicidad"),
    _l("publicidad","pub_a3","Control de campañas","15 días en el módulo de publicidad","🛡️","raro",20,A,meta=15,campo="v_publicidad"),
    _l("publicidad","pub_a4","Plataforma publicitada","1 publicidad activa en el sistema","📢","raro",25,A,meta=1,campo="sistema_publicidades"),
    _l("publicidad","pub_a5","Publicidad activa","5 publicidades en el sistema","📣","raro",35,A,meta=5,campo="sistema_publicidades"),
    _l("publicidad","pub_a6","Gran campaña","10 publicidades en el sistema","🌟","epico",60,A,meta=10,campo="sistema_publicidades"),
    _l("publicidad","pub_a7","Mega campaña","20 publicidades en el sistema","🏆","legendario",120,A,meta=20,campo="sistema_publicidades"),
    _l("publicidad","pub_c8","Racha de ofertas","10 días consecutivos en publicidad","⚡","raro",40,C,meta=10,campo="s_publicidad"),
    _l("publicidad","pub_c9","Fanático de promos","45 días en publicidad","🔥","epico",75,C,meta=45,campo="v_publicidad"),
    _l("publicidad","pub_c10","Maestro del consumo","60 días en publicidad","👑","legendario",130,C,meta=60,campo="v_publicidad"),
    _l("publicidad","pub_v8","Racha de marketing","14 días consecutivos en publicidad","📣","epico",65,V,meta=14,campo="s_publicidad"),
    _l("publicidad","pub_v9","Publicista total","45 días en el módulo de publicidad","🌟","epico",85,V,meta=45,campo="v_publicidad"),
    _l("publicidad","pub_v10","Campaña maestra","60 días en el módulo de publicidad","🏆","legendario",150,V,meta=60,campo="v_publicidad"),
    _l("publicidad","pub_a8","Gran plataforma publicitaria","30 publicidades en el sistema","📊","legendario",160,A,meta=30,campo="sistema_publicidades"),
    _l("publicidad","pub_a9","Racha de gestión","10 días consecutivos en publicidad","🛡️","raro",40,A,meta=10,campo="s_publicidad"),
    _l("publicidad","pub_a10","Supervisor permanente","30 días en el módulo de publicidad","🔧","epico",70,A,meta=30,campo="v_publicidad"),
]

_USUARIOS = [
    _l("gestion_usuarios","usr_c1","Cuenta creada","Registraste tu cuenta en D'Antojitos","🎉","comun",10,C),
    _l("gestion_usuarios","usr_c2","Cuenta activa","7 días desde tu registro","📅","comun",15,C,meta=7,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c3","Mes completado","30 días registrado","🗓️","raro",30,C,meta=30,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c4","Trimestre activo","90 días registrado","⏳","raro",50,C,meta=90,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c5","Medio año contigo","180 días registrado","💙","epico",80,C,meta=180,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c6","Un año con nosotros","365 días registrado","🏆","legendario",150,C,meta=365,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c7","Usuario leal","730 días registrado","👑","legendario",200,C,meta=730,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v1","Vendedor registrado","Primera semana como vendedor","📅","comun",15,V,meta=7,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v2","Vendedor activo","30 días registrado","🗓️","raro",30,V,meta=30,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v3","Vendedor establecido","90 días registrado","⏳","raro",50,V,meta=90,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v4","Vendedor veterano","180 días registrado","💙","epico",80,V,meta=180,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v5","Vendedor del año","365 días registrado","🏆","legendario",150,V,meta=365,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v6","Más usuarios","10 clientes registrados en el sistema","👥","comun",10,V,meta=10,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_v7","Gran comunidad de clientes","50 clientes en el sistema","🌟","raro",30,V,meta=50,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a1","Primera gestión","Primera visita a gestión de usuarios","👁️","comun",5,A),
    _l("gestion_usuarios","usr_a2","Moderador","5 días en gestión de usuarios","📋","comun",10,A,meta=5,campo="v_gestion_usuarios"),
    _l("gestion_usuarios","usr_a3","Administrador activo","15 días en gestión de usuarios","🛡️","raro",20,A,meta=15,campo="v_gestion_usuarios"),
    _l("gestion_usuarios","usr_a4","10 usuarios registrados","10 usuarios en el sistema","👥","raro",25,A,meta=10,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a5","50 usuarios registrados","50 usuarios en el sistema","👨‍👩‍👧‍👦","raro",35,A,meta=50,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a6","Gran comunidad","100 usuarios en el sistema","🌟","epico",65,A,meta=100,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a7","Plataforma masiva","500 usuarios en el sistema","🏆","legendario",130,A,meta=500,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_c8","Tres años con nosotros","1095 días registrado","🌟","legendario",250,C,meta=1095,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c9","Cuatro años contigo","1460 días registrado","💙","legendario",300,C,meta=1460,campo="dias_registrado"),
    _l("gestion_usuarios","usr_c10","Leyenda permanente","50 pedidos realizados","🏆","legendario",200,C,meta=50,campo="total_pedidos"),
    _l("gestion_usuarios","usr_v8","Vendedor de largo plazo","730 días registrado","💙","legendario",200,V,meta=730,campo="dias_registrado"),
    _l("gestion_usuarios","usr_v9","100 clientes en el sistema","100 clientes registrados en el sistema","👨‍👩‍👧‍👦","epico",80,V,meta=100,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_v10","500 clientes en el sistema","500 clientes registrados en el sistema","🌟","legendario",160,V,meta=500,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a8","Mil usuarios registrados","1000 usuarios en el sistema","👑","legendario",200,A,meta=1000,campo="sistema_usuarios"),
    _l("gestion_usuarios","usr_a9","Racha de gestión","10 días consecutivos en gestión de usuarios","⚙️","raro",40,A,meta=10,campo="s_gestion_usuarios"),
    _l("gestion_usuarios","usr_a10","Administrador permanente","30 días en gestión de usuarios","🏆","epico",70,A,meta=30,campo="v_gestion_usuarios"),
]

LOGROS_DEFINIDOS: list[dict] = (
    _INICIO + _CATALOGO + _CARRITO + _PAGOS + _SUGERENCIAS +
    _MENSAJES + _PERFIL + _HISTORIAL + _PRODUCTOS + _PUBLICIDAD + _USUARIOS
)

assert len(LOGROS_DEFINIDOS) == 330, f"Se esperaban 330 logros, hay {len(LOGROS_DEFINIDOS)}"

LOGROS_MAP: dict[str, dict] = {l["codigo"]: l for l in LOGROS_DEFINIDOS}

def _es_hoy_cumpleanos(usuario: dict) -> bool:
    fn = usuario.get("fecha_nacimiento")
    if not fn:
        return False
    try:
        if isinstance(fn, str):
            fn = date.fromisoformat(fn[:10])
        hoy = datetime.now(COLOMBIA_TZ).date()
        return fn.month == hoy.month and fn.day == hoy.day
    except Exception:
        return False

def _tiene_foto_personalizada(usuario: dict) -> bool:
    img = usuario.get("imagen_url") or ""
    if not img:
        return False
    if "default_icon_profile" in img:
        return False
    if "googleusercontent.com" in img:
        return False
    if "lh3.google" in img or "lh4.google" in img or "lh5.google" in img:
        return False
    return True

def _perfil_completo(usuario: dict) -> bool:
    campos = ["nombre", "apellido", "telefono", "correo", "direccion",
              "metodo_pago", "username", "imagen_url", "fecha_nacimiento"]
    for c in campos:
        v = usuario.get(c)
        if not v:
            return False
        if c == "imagen_url" and not _tiene_foto_personalizada(usuario):
            return False
    return True

def verificar_y_otorgar(cedula: str, contexto: dict | None = None) -> list[dict]:
    import database.models as db
    contexto = contexto or {}
    nuevos: list[dict] = []

    try:
        ya_obtenidos_rows = db.usuario_logros_get(cedula)
        ya_obtenidos: set[str] = {r["codigo_logro"] for r in ya_obtenidos_rows}
    except Exception as e:
        logger.warning("logros: no se pudo obtener logros: %s", e)
        return []

    try:
        usuario = db.usuario_get(cedula) or {}
    except Exception:
        usuario = {}

    rol_raw = (
        contexto.get("_rol")
        or usuario.get("rol")
        or (usuario.get("roles") or {}).get("nombre_role", "")
        or "cliente"
    )
    rol = rol_raw.lower() if rol_raw else "cliente"
    if rol not in ("cliente", "vendedor", "admin"):
        rol = "cliente"

    try:
        stats = db.usuario_stats_logros(cedula)
    except Exception:
        stats = {}

    total_pedidos           = int(stats.get("total_pedidos", 0) or 0)
    total_gastado           = float(stats.get("total_gastado", 0) or 0)
    total_comentarios       = int(stats.get("total_comentarios", 0) or 0)
    max_likes_recibidos     = int(stats.get("max_likes", 0) or 0)
    total_mensajes_privados = int(stats.get("total_mensajes_privados", 0) or 0)
    dias_registrado         = int(stats.get("dias_registrado", 0) or 0)
    productos_distintos     = int(stats.get("productos_distintos", 0) or 0)
    total_facturas          = int(stats.get("total_facturas", 0) or 0)

    sis: dict = {}
    if rol in ("admin", "vendedor"):
        try:
            sis = db.sistema_stats_logros()
        except Exception:
            sis = {}

    sistema_pedidos      = int(sis.get("sistema_pedidos", 0) or 0)
    sistema_gastado      = float(sis.get("sistema_gastado", 0) or 0)
    sistema_usuarios     = int(sis.get("sistema_usuarios", 0) or 0)
    sistema_productos    = int(sis.get("sistema_productos", 0) or 0)
    sistema_publicidades = int(sis.get("sistema_publicidades", 0) or 0)
    sistema_comentarios  = int(sis.get("sistema_comentarios", 0) or 0)
    sistema_mensajes     = int(sis.get("sistema_mensajes", 0) or 0)
    sistema_facturas     = int(sis.get("sistema_facturas", 0) or 0)

    _ahora_co    = datetime.now(COLOMBIA_TZ)
    hora_actual  = _ahora_co.hour
    dia_semana   = _ahora_co.weekday()

    num_prod_carrito = int(contexto.get("num_productos_carrito", 0) or 0)
    valor_carrito    = float(contexto.get("valor_carrito", 0) or 0)

    modulo_visita = (contexto.get("modulo") or "").lower()
    es_visita     = contexto.get("tipo") == "visita"

    db_contadores: dict = {}
    if es_visita and modulo_visita:
        try:
            db_contadores = db.logros_contadores_get(cedula)
        except Exception:
            db_contadores = {}

    v_key = f"v_{modulo_visita}"
    s_key = f"s_{modulo_visita}"
    db_visit  = int(db_contadores.get(v_key, 0))
    db_streak = int(db_contadores.get(s_key, 0))

    hoy_co        = datetime.now(COLOMBIA_TZ).date()
    hoy_epoch     = (hoy_co - date(1970, 1, 1)).days
    vd_key        = f"{modulo_visita}_vd"
    sd_key        = f"{modulo_visita}_sd"
    last_visit_d  = int(db_contadores.get(vd_key, 0))
    last_streak_d = int(db_contadores.get(sd_key, 0))

    if es_visita and modulo_visita:
        visit_count = db_visit + 1 if last_visit_d < hoy_epoch else db_visit

        if last_streak_d == hoy_epoch:
            streak_count = db_streak
        elif last_streak_d == hoy_epoch - 1:
            streak_count = db_streak + 1
        elif last_streak_d == 0:
            streak_count = 1
        else:
            streak_count = 1

        save_patch: dict = {v_key: visit_count, s_key: streak_count}
        if last_visit_d < hoy_epoch:
            save_patch[vd_key] = hoy_epoch
        if last_streak_d < hoy_epoch:
            save_patch[sd_key] = hoy_epoch
        if any(save_patch.get(k) != db_contadores.get(k) for k in save_patch):
            try:
                db.logros_contadores_upsert_many(cedula, save_patch)
            except Exception:
                pass
    else:
        visit_count  = db_visit
        streak_count = db_streak
    es_login      = contexto.get("tipo") == "login"
    es_compra     = contexto.get("tipo") == "compra"
    es_comentario = contexto.get("tipo") == "comentario"
    es_mensaje    = contexto.get("tipo") == "mensaje_privado"
    es_accion     = contexto.get("tipo") == "accion"
    accion        = (contexto.get("accion") or "").lower()

    def _chequear(codigo: str, condicion: bool) -> None:
        if codigo not in ya_obtenidos and condicion and codigo in LOGROS_MAP:
            logro_def = LOGROS_MAP[codigo]
            if rol in logro_def.get("roles", []):
                try:
                    db.usuario_logro_award(cedula, codigo)
                    ya_obtenidos.add(codigo)
                    nuevos.append(logro_def)
                except Exception as ex:
                    logger.warning("logros: no se pudo otorgar %s a %s: %s", codigo, cedula, ex)

    _chequear("ini_c1", True)
    _chequear("ini_c2", hora_actual >= 23 or hora_actual < 1)
    _chequear("ini_c3", hora_actual < 6)
    _chequear("ini_c4", dia_semana in (5, 6))
    _chequear("ini_c5", es_login and _es_hoy_cumpleanos(usuario))
    if es_visita and modulo_visita == "inicio":
        _chequear("ini_c6", streak_count >= 5)
        _chequear("ini_c7", visit_count >= 20)
        _chequear("ini_c9", streak_count >= 10)
        _chequear("ini_c10", visit_count >= 30)
        _chequear("ini_v5", streak_count >= 7)
        _chequear("ini_v6", visit_count >= 20)
        _chequear("ini_v7", visit_count >= 30)
        _chequear("ini_v9", streak_count >= 10)
        _chequear("ini_v10", visit_count >= 45)
        _chequear("ini_a4", streak_count >= 7)
        _chequear("ini_a5", visit_count >= 20)
        _chequear("ini_a7", visit_count >= 30)
        _chequear("ini_a9", streak_count >= 14)
        _chequear("ini_a10", visit_count >= 45)
    _chequear("ini_c8", hora_actual in (12, 13))
    _chequear("ini_v1", True)
    _chequear("ini_v2", hora_actual < 7)
    _chequear("ini_v3", hora_actual >= 22)
    _chequear("ini_v4", dia_semana in (5, 6))
    _chequear("ini_v8", hora_actual in (12, 13))
    _chequear("ini_a1", True)
    _chequear("ini_a2", hora_actual >= 23 or hora_actual < 2)
    _chequear("ini_a3", hora_actual < 6)
    _chequear("ini_a6", dia_semana in (5, 6))
    _chequear("ini_a8", hora_actual in (12, 13))

    if es_visita and modulo_visita == "catalogo":
        _chequear("cat_c1", visit_count >= 1)
        _chequear("cat_c2", visit_count >= 5)
        _chequear("cat_c3", visit_count >= 15)
        _chequear("cat_c4", visit_count >= 30)
        _chequear("cat_c8", streak_count >= 7)
        _chequear("cat_c9", visit_count >= 50)
        _chequear("cat_v1", visit_count >= 1)
        _chequear("cat_v2", visit_count >= 5)
        _chequear("cat_v3", visit_count >= 15)
        _chequear("cat_v4", visit_count >= 30)
        _chequear("cat_v5", streak_count >= 7)
        _chequear("cat_v6", visit_count >= 20)
        _chequear("cat_v7", visit_count >= 30)
        _chequear("cat_v8", streak_count >= 10)
        _chequear("cat_v9", visit_count >= 45)
        _chequear("cat_v10", visit_count >= 60)
        _chequear("cat_a1", visit_count >= 1)
        _chequear("cat_a2", visit_count >= 5)
        _chequear("cat_a3", visit_count >= 15)
        _chequear("cat_a4", visit_count >= 30)
        _chequear("cat_a8", streak_count >= 10)
    _chequear("cat_c5", productos_distintos >= 3)
    _chequear("cat_c6", productos_distintos >= 5)
    _chequear("cat_c7", productos_distintos >= 10)
    _chequear("cat_c10", productos_distintos >= 15)
    _chequear("cat_a5", sistema_productos >= 20)
    _chequear("cat_a6", sistema_productos >= 50)
    _chequear("cat_a7", sistema_productos >= 100)
    _chequear("cat_a9", sistema_productos >= 150)
    _chequear("cat_a10", sistema_productos >= 200)

    if es_visita and modulo_visita == "carrito":
        _chequear("cart_v1", visit_count >= 1)
        _chequear("cart_v2", visit_count >= 5)
        _chequear("cart_v3", visit_count >= 15)
        _chequear("cart_v8", streak_count >= 10)
        _chequear("cart_a1", visit_count >= 1)
        _chequear("cart_a2", visit_count >= 5)
        _chequear("cart_a3", visit_count >= 15)
        _chequear("cart_a8", streak_count >= 10)
    if num_prod_carrito >= 1:
        _chequear("cart_c1", True)
    _chequear("cart_c2", num_prod_carrito >= 3)
    _chequear("cart_c3", num_prod_carrito >= 7)
    _chequear("cart_c4", num_prod_carrito >= 10)
    _chequear("cart_c5", valor_carrito >= 50_000)
    _chequear("cart_c6", valor_carrito >= 150_000)
    _chequear("cart_c7", valor_carrito >= 300_000)
    _chequear("cart_c8", num_prod_carrito >= 15)
    _chequear("cart_c9", valor_carrito >= 500_000)
    _chequear("cart_c10", valor_carrito >= 1_000_000)
    _chequear("cart_v4", sistema_pedidos >= 50)
    _chequear("cart_v5", sistema_pedidos >= 100)
    _chequear("cart_v6", sistema_pedidos >= 500)
    _chequear("cart_v7", sistema_pedidos >= 1000)
    _chequear("cart_v9", sistema_pedidos >= 2000)
    _chequear("cart_v10", sistema_pedidos >= 5000)
    _chequear("cart_a4", sistema_pedidos >= 50)
    _chequear("cart_a5", sistema_pedidos >= 100)
    _chequear("cart_a6", sistema_pedidos >= 500)
    _chequear("cart_a7", sistema_pedidos >= 1000)
    _chequear("cart_a9", sistema_pedidos >= 2000)
    _chequear("cart_a10", sistema_pedidos >= 5000)

    _chequear("pago_c1", total_pedidos >= 1)
    _chequear("pago_c2", total_pedidos >= 3)
    _chequear("pago_c3", total_pedidos >= 5)
    _chequear("pago_c4", total_pedidos >= 10)
    _chequear("pago_c5", total_pedidos >= 20)
    _chequear("pago_c6", total_pedidos >= 50)
    _chequear("pago_c7", total_pedidos >= 100)
    _chequear("pago_c8", total_pedidos >= 200)
    _chequear("pago_c9", total_gastado >= 1_000_000)
    _chequear("pago_c10", total_gastado >= 5_000_000)
    if es_visita and modulo_visita == "pagos":
        _chequear("pago_v1", visit_count >= 1)
        _chequear("pago_v2", visit_count >= 5)
        _chequear("pago_v3", visit_count >= 15)
        _chequear("pago_v9", streak_count >= 10)
        _chequear("pago_v10", visit_count >= 30)
        _chequear("pago_a1", visit_count >= 1)
        _chequear("pago_a2", visit_count >= 5)
        _chequear("pago_a3", visit_count >= 15)
        _chequear("pago_a9", streak_count >= 10)
        _chequear("pago_a10", visit_count >= 30)
    _chequear("pago_v4", sistema_gastado >= 50_000)
    _chequear("pago_v5", sistema_gastado >= 500_000)
    _chequear("pago_v6", sistema_gastado >= 2_000_000)
    _chequear("pago_v7", sistema_gastado >= 10_000_000)
    _chequear("pago_v8", sistema_gastado >= 50_000_000)
    _chequear("pago_a4", sistema_gastado >= 500_000)
    _chequear("pago_a5", sistema_gastado >= 2_000_000)
    _chequear("pago_a6", sistema_gastado >= 10_000_000)
    _chequear("pago_a7", sistema_gastado >= 50_000_000)
    _chequear("pago_a8", sistema_gastado >= 100_000_000)

    if es_compra:
        if contexto.get("repite_producto"):
            _chequear("prod_c2", True)
        _chequear("pub_c5", True)

    _chequear("sug_c1", total_comentarios >= 1)
    _chequear("sug_c2", total_comentarios >= 5)
    _chequear("sug_c3", total_comentarios >= 10)
    _chequear("sug_c4", total_comentarios >= 20)
    _chequear("sug_c5", max_likes_recibidos >= 5)
    _chequear("sug_c6", max_likes_recibidos >= 20)
    _chequear("sug_c7", max_likes_recibidos >= 50)
    _chequear("sug_c8", total_comentarios >= 30)
    _chequear("sug_c9", max_likes_recibidos >= 100)
    _chequear("sug_v5", total_comentarios >= 1)
    _chequear("sug_v6", total_comentarios >= 5)
    _chequear("sug_v7", total_comentarios >= 10)
    _chequear("sug_v8", total_comentarios >= 20)
    if es_visita and modulo_visita == "sugerencias":
        _chequear("sug_c10", streak_count >= 7)
        _chequear("sug_v1", visit_count >= 1)
        _chequear("sug_v2", visit_count >= 5)
        _chequear("sug_v3", visit_count >= 15)
        _chequear("sug_v4", visit_count >= 30)
        _chequear("sug_v9", streak_count >= 7)
        _chequear("sug_v10", visit_count >= 45)
        _chequear("sug_a1", visit_count >= 1)
        _chequear("sug_a2", visit_count >= 5)
        _chequear("sug_a3", visit_count >= 15)
        _chequear("sug_a9", streak_count >= 7)
        _chequear("sug_a10", visit_count >= 45)
    _chequear("sug_a4", sistema_comentarios >= 10)
    _chequear("sug_a5", sistema_comentarios >= 50)
    _chequear("sug_a6", sistema_comentarios >= 200)
    _chequear("sug_a7", sistema_comentarios >= 500)
    _chequear("sug_a8", sistema_comentarios >= 1000)

    _chequear("msg_c1", total_mensajes_privados >= 1)
    _chequear("msg_c2", total_mensajes_privados >= 10)
    _chequear("msg_c3", total_mensajes_privados >= 25)
    _chequear("msg_c4", total_mensajes_privados >= 50)
    _chequear("msg_c5", total_mensajes_privados >= 100)
    _chequear("msg_c7", total_mensajes_privados >= 200)
    _chequear("msg_c8", total_mensajes_privados >= 300)
    _chequear("msg_c9", total_mensajes_privados >= 500)
    _chequear("msg_v1", total_mensajes_privados >= 1)
    _chequear("msg_v2", total_mensajes_privados >= 10)
    _chequear("msg_v3", total_mensajes_privados >= 25)
    _chequear("msg_v4", total_mensajes_privados >= 50)
    _chequear("msg_v5", total_mensajes_privados >= 100)
    _chequear("msg_v7", total_mensajes_privados >= 200)
    _chequear("msg_v8", total_mensajes_privados >= 300)
    _chequear("msg_v9", total_mensajes_privados >= 500)
    if contexto.get("foto_chat"):
        _chequear("msg_c6", True)
        _chequear("msg_v6", True)
    if es_visita and modulo_visita == "mensajes":
        _chequear("msg_c10", streak_count >= 7)
        _chequear("msg_v10", streak_count >= 7)
        _chequear("msg_a1", visit_count >= 1)
        _chequear("msg_a2", visit_count >= 5)
        _chequear("msg_a3", visit_count >= 15)
        _chequear("msg_a10", streak_count >= 7)
    _chequear("msg_a4", sistema_mensajes >= 50)
    _chequear("msg_a5", sistema_mensajes >= 200)
    _chequear("msg_a6", sistema_mensajes >= 500)
    _chequear("msg_a7", sistema_mensajes >= 1000)
    _chequear("msg_a8", sistema_mensajes >= 2000)
    _chequear("msg_a9", sistema_mensajes >= 5000)

    _chequear("prf_c1", bool(usuario.get("username")))
    _chequear("prf_c2", bool(usuario.get("telefono")))
    _chequear("prf_c3", bool(usuario.get("direccion")))
    _chequear("prf_c4", bool(usuario.get("fecha_nacimiento")))
    _chequear("prf_c5", _tiene_foto_personalizada(usuario))
    _chequear("prf_c6", _perfil_completo(usuario))
    _chequear("prf_c7", dias_registrado >= 30)
    _chequear("prf_v1", bool(usuario.get("username")))
    _chequear("prf_v2", bool(usuario.get("telefono")))
    _chequear("prf_v3", bool(usuario.get("direccion")))
    _chequear("prf_v4", _tiene_foto_personalizada(usuario))
    _chequear("prf_v5", _perfil_completo(usuario))
    _chequear("prf_v6", bool(usuario.get("fecha_nacimiento")))
    _chequear("prf_v7", dias_registrado >= 30)
    _chequear("prf_a1", bool(usuario.get("username")))
    _chequear("prf_a2", bool(usuario.get("telefono")))
    _chequear("prf_a3", bool(usuario.get("direccion")))
    _chequear("prf_a4", _tiene_foto_personalizada(usuario))
    _chequear("prf_a5", _perfil_completo(usuario))
    _chequear("prf_a6", bool(usuario.get("fecha_nacimiento")))
    _chequear("prf_a7", dias_registrado >= 30)
    if es_visita and modulo_visita == "perfil":
        _chequear("prf_c8", visit_count >= 10)
        _chequear("prf_c9", visit_count >= 25)
        _chequear("prf_c10", visit_count >= 50)
        _chequear("prf_v8", visit_count >= 10)
        _chequear("prf_v9", visit_count >= 25)
        _chequear("prf_v10", visit_count >= 50)
        _chequear("prf_a8", visit_count >= 10)
        _chequear("prf_a9", visit_count >= 25)
        _chequear("prf_a10", visit_count >= 50)

    _chequear("fac_c1", total_facturas >= 1)
    _chequear("fac_c2", total_facturas >= 3)
    _chequear("fac_c3", total_facturas >= 5)
    _chequear("fac_c4", total_facturas >= 10)
    _chequear("fac_c5", total_facturas >= 20)
    _chequear("fac_c6", total_gastado >= 50_000)
    _chequear("fac_c7", total_gastado >= 500_000)
    _chequear("fac_c8", total_facturas >= 50)
    _chequear("fac_c9", total_facturas >= 100)
    _chequear("fac_c10", total_gastado >= 1_000_000)
    if es_visita and modulo_visita == "historial":
        _chequear("fac_v1", visit_count >= 1)
        _chequear("fac_v2", visit_count >= 5)
        _chequear("fac_v3", visit_count >= 15)
        _chequear("fac_v9", streak_count >= 10)
        _chequear("fac_v10", visit_count >= 30)
        _chequear("fac_a1", visit_count >= 1)
        _chequear("fac_a2", visit_count >= 5)
        _chequear("fac_a3", visit_count >= 15)
        _chequear("fac_a9", streak_count >= 10)
        _chequear("fac_a10", visit_count >= 30)
    _chequear("fac_v4", sistema_facturas >= 10)
    _chequear("fac_v5", sistema_facturas >= 50)
    _chequear("fac_v6", sistema_facturas >= 200)
    _chequear("fac_v7", sistema_facturas >= 500)
    _chequear("fac_v8", sistema_facturas >= 1000)
    _chequear("fac_a4", sistema_facturas >= 10)
    _chequear("fac_a5", sistema_facturas >= 50)
    _chequear("fac_a6", sistema_facturas >= 200)
    _chequear("fac_a7", sistema_facturas >= 500)
    _chequear("fac_a8", sistema_facturas >= 1000)

    _chequear("prod_c3", productos_distintos >= 3)
    _chequear("prod_c4", productos_distintos >= 5)
    _chequear("prod_c5", productos_distintos >= 10)
    _chequear("prod_c6", productos_distintos >= 20)
    _chequear("prod_c7", productos_distintos >= 30)
    _chequear("prod_c8", productos_distintos >= 40)
    _chequear("prod_c9", productos_distintos >= 50)
    _chequear("prod_c10", productos_distintos >= 60)
    if es_visita and modulo_visita == "gestion_productos":
        _chequear("prod_c1", visit_count >= 1)
        _chequear("prod_v2", visit_count >= 3)
        _chequear("prod_v3", visit_count >= 10)
        _chequear("prod_v4", visit_count >= 20)
        _chequear("prod_v5", streak_count >= 5)
        _chequear("prod_v7", visit_count >= 30)
        _chequear("prod_v8", streak_count >= 7)
        _chequear("prod_v9", visit_count >= 45)
        _chequear("prod_v10", visit_count >= 60)
        _chequear("prod_a1", visit_count >= 1)
        _chequear("prod_a2", visit_count >= 5)
        _chequear("prod_a3", visit_count >= 15)
        _chequear("prod_a9", streak_count >= 10)
        _chequear("prod_a10", visit_count >= 30)
    if es_accion and accion == "crear_producto":
        _chequear("prod_v1", True)
    if es_accion and accion == "editar_producto":
        _chequear("prod_v6", True)
    _chequear("prod_a4", sistema_productos >= 20)
    _chequear("prod_a5", sistema_productos >= 50)
    _chequear("prod_a6", sistema_productos >= 100)
    _chequear("prod_a7", sistema_productos >= 200)
    _chequear("prod_a8", sistema_productos >= 300)

    if es_visita and modulo_visita == "publicidad":
        _chequear("pub_c1", visit_count >= 1)
        _chequear("pub_c2", visit_count >= 5)
        _chequear("pub_c3", visit_count >= 15)
        _chequear("pub_c4", visit_count >= 30)
        _chequear("pub_c6", streak_count >= 5)
        _chequear("pub_c7", visit_count >= 30)
        _chequear("pub_c8", streak_count >= 10)
        _chequear("pub_c9", visit_count >= 45)
        _chequear("pub_c10", visit_count >= 60)
        _chequear("pub_v2", visit_count >= 3)
        _chequear("pub_v3", visit_count >= 10)
        _chequear("pub_v4", visit_count >= 20)
        _chequear("pub_v5", streak_count >= 7)
        _chequear("pub_v7", visit_count >= 30)
        _chequear("pub_v8", streak_count >= 14)
        _chequear("pub_v9", visit_count >= 45)
        _chequear("pub_v10", visit_count >= 60)
        _chequear("pub_a1", visit_count >= 1)
        _chequear("pub_a2", visit_count >= 5)
        _chequear("pub_a3", visit_count >= 15)
        _chequear("pub_a9", streak_count >= 10)
        _chequear("pub_a10", visit_count >= 30)
    if es_accion and accion == "crear_publicidad":
        _chequear("pub_v1", True)
    if es_accion and accion == "editar_publicidad":
        _chequear("pub_v6", True)
    _chequear("pub_a4", sistema_publicidades >= 1)
    _chequear("pub_a5", sistema_publicidades >= 5)
    _chequear("pub_a6", sistema_publicidades >= 10)
    _chequear("pub_a7", sistema_publicidades >= 20)
    _chequear("pub_a8", sistema_publicidades >= 30)

    _chequear("usr_c1", True)
    _chequear("usr_c2", dias_registrado >= 7)
    _chequear("usr_c3", dias_registrado >= 30)
    _chequear("usr_c4", dias_registrado >= 90)
    _chequear("usr_c5", dias_registrado >= 180)
    _chequear("usr_c6", dias_registrado >= 365)
    _chequear("usr_c7", dias_registrado >= 730)
    _chequear("usr_c8", dias_registrado >= 1095)
    _chequear("usr_c9", dias_registrado >= 1460)
    _chequear("usr_c10", total_pedidos >= 50)
    _chequear("usr_v1", dias_registrado >= 7)
    _chequear("usr_v2", dias_registrado >= 30)
    _chequear("usr_v3", dias_registrado >= 90)
    _chequear("usr_v4", dias_registrado >= 180)
    _chequear("usr_v5", dias_registrado >= 365)
    _chequear("usr_v6", sistema_usuarios >= 10)
    _chequear("usr_v7", sistema_usuarios >= 50)
    _chequear("usr_v8", dias_registrado >= 730)
    _chequear("usr_v9", sistema_usuarios >= 100)
    _chequear("usr_v10", sistema_usuarios >= 500)
    if es_visita and modulo_visita == "gestion_usuarios":
        _chequear("usr_a1", visit_count >= 1)
        _chequear("usr_a2", visit_count >= 5)
        _chequear("usr_a3", visit_count >= 15)
        _chequear("usr_a9", streak_count >= 10)
        _chequear("usr_a10", visit_count >= 30)
    _chequear("usr_a4", sistema_usuarios >= 10)
    _chequear("usr_a5", sistema_usuarios >= 50)
    _chequear("usr_a6", sistema_usuarios >= 100)
    _chequear("usr_a7", sistema_usuarios >= 500)
    _chequear("usr_a8", sistema_usuarios >= 1000)

    if not nuevos:
        return []
    codigos_nuevos = [l["codigo"] for l in nuevos]
    codigos_a_mostrar = set(db.logros_notificados_marcar(cedula, codigos_nuevos))
    return [l for l in nuevos if l["codigo"] in codigos_a_mostrar]

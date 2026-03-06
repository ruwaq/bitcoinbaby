/**
 * Help Page Data
 *
 * FAQ content, glossary terms, and section navigation.
 */

export type HelpSection =
  | "getting-started"
  | "wallet"
  | "mining"
  | "baby-care"
  | "tokens"
  | "transactions"
  | "troubleshooting"
  | "glossary";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface SectionConfig {
  id: HelpSection;
  label: string;
  icon: string;
}

// Section Navigation
export const SECTIONS: SectionConfig[] = [
  { id: "getting-started", label: "Empezar", icon: "🚀" },
  { id: "wallet", label: "Wallet", icon: "💼" },
  { id: "mining", label: "Mineria", icon: "⛏️" },
  { id: "baby-care", label: "Cuidados", icon: "❤️" },
  { id: "tokens", label: "Tokens", icon: "🪙" },
  { id: "transactions", label: "Transacciones", icon: "📤" },
  { id: "troubleshooting", label: "Problemas", icon: "🔧" },
  { id: "glossary", label: "Glosario", icon: "📖" },
];

// FAQ Data
export const FAQS: Record<HelpSection, FAQItem[]> = {
  "getting-started": [
    {
      question: "Que es BitcoinBaby?",
      answer:
        "BitcoinBaby es un juego de crianza digital donde minas Bitcoin mientras cuidas a tu bebe virtual. Tu bebe crece y evoluciona con cada hash que minas, y ganas $BABY tokens como recompensa.",
    },
    {
      question: "Como empiezo?",
      answer:
        "1. Crea una wallet Bitcoin\n2. Nombra a tu baby\n3. Comienza a minar\n4. Cuida de tu baby (alimenta, juega, descansa)\n5. Mira como evoluciona y gana tokens!",
    },
    {
      question: "Es gratis?",
      answer:
        "Si! BitcoinBaby es completamente gratis. Usas tu propia computadora para minar y las recompensas van directamente a tu wallet Bitcoin.",
    },
    {
      question: "Necesito conocimientos tecnicos?",
      answer:
        "No! La interfaz es muy sencilla e intuitiva. El tutorial te guia paso a paso. Solo necesitas un navegador web moderno.",
    },
  ],
  wallet: [
    {
      question: "Como creo una wallet?",
      answer:
        "Ve a la pagina Wallet y sigue estos pasos:\n1. Haz clic en 'Crear Nueva Wallet'\n2. Mueve el mouse para generar entropia aleatoria\n3. Guarda tu frase de recuperacion de 12 palabras en un lugar seguro\n4. Crea una contrasena fuerte\n5. Listo! Tu wallet Taproot esta creada.",
    },
    {
      question: "Que es la frase de recuperacion?",
      answer:
        "Es un conjunto de 12 palabras que te permiten recuperar tu wallet en cualquier dispositivo. NUNCA la compartas con nadie y guardala en un lugar seguro offline.",
    },
    {
      question: "Como importo una wallet existente?",
      answer:
        "En la pagina Wallet, selecciona 'Importar Wallet' e ingresa tu frase de recuperacion de 12 palabras. Tu wallet se restaurara automaticamente.",
    },
    {
      question: "Que es una wallet Taproot?",
      answer:
        "Taproot (P2TR) es el tipo mas moderno de direccion Bitcoin. Ofrece mejor privacidad, menores fees, y es compatible con el protocolo Charms para tokens.",
    },
    {
      question: "Es segura mi wallet?",
      answer:
        "Si! Tu wallet esta encriptada con AES-256-GCM y se almacena localmente en tu dispositivo. Nunca enviamos tu clave privada a ningun servidor.",
    },
  ],
  mining: [
    {
      question: "Como funciona la mineria?",
      answer:
        "BitcoinBaby usa Proof of Useful Work (PoUW). Tu navegador calcula hashes SHA-256 que contribuyen a tareas utiles. Cada hash valido te da XP para tu baby y potencialmente $BABY tokens.",
    },
    {
      question: "Cuanto puedo minar?",
      answer:
        "Depende de tu hardware. Una PC normal puede alcanzar 10-50 KH/s. Dispositivos mas potentes con WebGPU pueden llegar a 1+ MH/s. Mientras mas minas, mas rapido crece tu baby!",
    },
    {
      question: "Afecta la mineria a mi computadora?",
      answer:
        "La mineria usa recursos de CPU/GPU, lo que puede calentar tu dispositivo y consumir mas bateria. Recomendamos minar cuando el dispositivo esta conectado a corriente.",
    },
    {
      question: "Puedo minar en mi telefono?",
      answer:
        "Si, pero el rendimiento sera menor que en una PC. Los telefonos modernos pueden minar, pero recomendamos tenerlos conectados al cargador.",
    },
    {
      question: "Que son los 'shares'?",
      answer:
        "Un share es una prueba de trabajo valida. Cada share te da XP y puede generar recompensas en $BABY tokens. Mientras mas shares, mejores recompensas!",
    },
  ],
  "baby-care": [
    {
      question: "Como cuido a mi baby?",
      answer:
        "Tu baby tiene 4 estadisticas principales:\n- Energia: Sube con descanso, baja minando\n- Felicidad: Sube jugando, baja con el tiempo\n- Hambre: Sube con el tiempo, baja alimentando\n- Salud: Depende de las otras estadisticas",
    },
    {
      question: "Que pasa si no cuido a mi baby?",
      answer:
        "Si las estadisticas bajan demasiado, tu baby puede enfermarse. Si la salud llega a 0, tu baby 'muere' y pierdes progreso. Pero puedes revivirlo perdiendo algunos niveles!",
    },
    {
      question: "Como funciona la evolucion?",
      answer:
        "Tu baby evoluciona cada 5 niveles:\n- Nivel 1-4: Egg (Huevo)\n- Nivel 5-9: Baby (Bebe)\n- Nivel 10-14: Child (Nino)\n- Nivel 15-19: Teen (Adolescente)\n- Nivel 20+: Adult (Adulto)\n\nCada etapa desbloquea bonus de minado!",
    },
    {
      question: "Que es el bonus de minado?",
      answer:
        "Cada evolucion aumenta tu bonus de minado. Un baby nivel 20 puede tener +100% de bonus, duplicando tus recompensas de $BABY tokens!",
    },
    {
      question: "Que es el 'decay'?",
      answer:
        "Si no minas por varios dias, tu baby puede perder XP gradualmente. Esto incentiva la participacion activa. Minar aunque sea un poco cada dia evita el decay.",
    },
  ],
  tokens: [
    {
      question: "Que son los $BABY tokens?",
      answer:
        "$BABY es un token en Bitcoin usando el protocolo Charms. Es una recompensa real por tu trabajo de mineria que puedes enviar, recibir, o guardar.",
    },
    {
      question: "Como gano $BABY tokens?",
      answer:
        "Ganas $BABY tokens cada vez que completas una prueba de trabajo valida (share). La cantidad depende de la dificultad y tu bonus de minado.",
    },
    {
      question: "Donde se guardan mis tokens?",
      answer:
        "Tus $BABY tokens estan en la blockchain de Bitcoin, asociados a tu direccion Taproot. Puedes verlos en cualquier explorador de Bitcoin compatible con Charms.",
    },
    {
      question: "Puedo vender mis $BABY tokens?",
      answer:
        "Los tokens $BABY son reales y transferibles. En el futuro podran ser intercambiados en mercados descentralizados compatibles con el protocolo Charms.",
    },
    {
      question: "Cuantos $BABY tokens existen?",
      answer:
        "El suministro de $BABY es finito y se distribuye unicamente a traves de mineria. Esto garantiza una distribucion justa entre todos los mineros.",
    },
  ],
  transactions: [
    {
      question: "Como recibo Bitcoin?",
      answer:
        "Comparte tu direccion Taproot (empieza con 'tb1p' en testnet o 'bc1p' en mainnet) o muestra tu codigo QR. Cualquiera puede enviarte Bitcoin a esa direccion.",
    },
    {
      question: "Como envio Bitcoin?",
      answer:
        "Ve a Wallet > Send, ingresa la direccion destino y el monto. Confirma la transaccion con tu contrasena. La transaccion se enviara a la red Bitcoin.",
    },
    {
      question: "Cuanto tardan las transacciones?",
      answer:
        "Las transacciones Bitcoin tipicamente se confirman en 10-60 minutos. Puedes ver el estado en un explorador de bloques usando el TXID.",
    },
    {
      question: "Que son los fees?",
      answer:
        "Los fees son pagos a los mineros de Bitcoin por procesar tu transaccion. Fees mas altos = confirmacion mas rapida. BitcoinBaby calcula fees optimos automaticamente.",
    },
    {
      question: "Que es testnet vs mainnet?",
      answer:
        "Testnet es una red de pruebas donde el Bitcoin no tiene valor real. Es perfecta para aprender. Mainnet es la red principal con Bitcoin real.",
    },
  ],
  troubleshooting: [
    {
      question: "La mineria no inicia",
      answer:
        "Verifica que:\n1. Tu wallet esta desbloqueada\n2. Tienes un baby creado\n3. Tu baby no esta dormido\n4. Tu navegador soporta Web Workers\n\nPrueba refrescar la pagina.",
    },
    {
      question: "Mi hashrate es muy bajo",
      answer:
        "El hashrate depende de tu hardware. Prueba:\n1. Cerrar otras pestanas del navegador\n2. Usar Chrome o Edge (mejor soporte WebGPU)\n3. Asegurar que tu dispositivo no esta en modo ahorro de bateria",
    },
    {
      question: "No puedo desbloquear mi wallet",
      answer:
        "Si olvidaste tu contrasena, la unica forma de recuperar tu wallet es usando tu frase de recuperacion de 12 palabras. Ve a Wallet > Delete & Restore.",
    },
    {
      question: "Mi baby esta enfermo/muerto",
      answer:
        "Si tu baby murio, puedes revivirlo perdiendo algunos niveles. Para evitar esto en el futuro, mantén sus estadisticas balanceadas y mina regularmente.",
    },
    {
      question: "No veo mis $BABY tokens",
      answer:
        "Los tokens pueden tardar en aparecer despues de minar. Verifica:\n1. Tu wallet esta en la red correcta (testnet/mainnet)\n2. La transaccion fue confirmada\n3. Refresca la pagina o espera unos minutos",
    },
    {
      question: "La pagina no carga correctamente",
      answer:
        "Prueba:\n1. Limpiar cache del navegador\n2. Deshabilitar extensiones del navegador\n3. Usar otro navegador (Chrome/Edge recomendados)\n4. Verificar tu conexion a internet",
    },
  ],
  glossary: [],
};

// Glossary Data
export const GLOSSARY: GlossaryItem[] = [
  {
    term: "Bitcoin",
    definition:
      "La primera y mas grande criptomoneda del mundo, creada en 2009 por Satoshi Nakamoto.",
  },
  {
    term: "BitcoinOS",
    definition:
      "Sistema operativo para Bitcoin que habilita aplicaciones avanzadas como Charms. Creador del protocolo Charms.",
  },
  {
    term: "Blockchain",
    definition:
      "Un libro contable digital distribuido que registra todas las transacciones de forma inmutable.",
  },
  {
    term: "Charms",
    definition:
      "Metaprotocolo de BitcoinOS para tokens y NFTs programables en Bitcoin. Usa ZK proofs para validacion client-side.",
  },
  {
    term: "Charms Explorer",
    definition:
      "Explorador web (explorer.charms.dev) para ver tokens y NFTs creados con el protocolo Charms.",
  },
  {
    term: "Decay",
    definition:
      "Perdida gradual de XP cuando no minas por un periodo prolongado.",
  },
  {
    term: "Entropia",
    definition:
      "Aleatoriedad usada para generar claves criptograficas seguras.",
  },
  {
    term: "Fee",
    definition:
      "Pago a los mineros de Bitcoin por incluir tu transaccion en un bloque.",
  },
  {
    term: "Hash",
    definition:
      "Una funcion matematica que convierte datos en una cadena unica de caracteres fijos.",
  },
  {
    term: "Hashrate",
    definition:
      "La velocidad de calculo de hashes, medida en hashes por segundo (H/s).",
  },
  {
    term: "HD Wallet",
    definition:
      "Hierarchical Deterministic Wallet. Genera multiples direcciones desde una sola semilla.",
  },
  {
    term: "Mainnet",
    definition:
      "La red principal de Bitcoin donde las transacciones tienen valor real.",
  },
  {
    term: "Merkle Proof",
    definition:
      "Prueba criptografica que demuestra que una transaccion esta incluida en un bloque de Bitcoin.",
  },
  {
    term: "Mnemonic",
    definition:
      "Frase de 12 o 24 palabras que representa tu clave privada de forma legible.",
  },
  {
    term: "Ordinals",
    definition:
      "Protocolo para inscribir datos (imagenes, HTML) permanentemente en Bitcoin. Usado para NFTs visuales.",
  },
  {
    term: "P2TR",
    definition:
      "Pay-to-Taproot. El tipo de direccion Bitcoin mas moderno y eficiente.",
  },
  {
    term: "PoUW",
    definition:
      "Proof of Useful Work. Mineria que contribuye a tareas computacionales utiles.",
  },
  {
    term: "Scrolls",
    definition:
      "Servicio de Charms para co-firmar transacciones con spells validos. API en scrolls.charms.dev.",
  },
  {
    term: "Spell",
    definition:
      "Mensaje especial en transacciones Charms que define operaciones de tokens (mint, transfer, burn).",
  },
  {
    term: "PSBT",
    definition:
      "Partially Signed Bitcoin Transaction. Formato estandar para transacciones no firmadas.",
  },
  {
    term: "Satoshi",
    definition:
      "La unidad mas pequena de Bitcoin. 1 BTC = 100,000,000 satoshis.",
  },
  {
    term: "Share",
    definition:
      "Una prueba de trabajo valida que demuestra que realizaste calculos de mineria.",
  },
  {
    term: "Taproot",
    definition:
      "Actualizacion de Bitcoin de 2021 que mejora privacidad, eficiencia y funcionalidad.",
  },
  {
    term: "Testnet",
    definition:
      "Red de pruebas de Bitcoin donde las monedas no tienen valor real.",
  },
  {
    term: "TXID",
    definition:
      "Transaction ID. Identificador unico de una transaccion en la blockchain.",
  },
  {
    term: "UTXO",
    definition:
      "Unspent Transaction Output. Una 'moneda' de Bitcoin que puedes gastar.",
  },
  {
    term: "WebGPU",
    definition:
      "API de navegador para acceder a la GPU, permitiendo mineria mas rapida.",
  },
  {
    term: "Web Worker",
    definition:
      "Proceso en segundo plano del navegador que permite minar sin bloquear la interfaz.",
  },
  {
    term: "XP",
    definition:
      "Experience Points. Puntos de experiencia que hacen crecer a tu baby.",
  },
  {
    term: "zkVM",
    definition:
      "Zero-Knowledge Virtual Machine. Permite verificar computaciones sin revelar datos privados.",
  },
  {
    term: "ZK Proof",
    definition:
      "Zero-Knowledge Proof. Prueba criptografica que valida algo sin revelar informacion sensible.",
  },
];

// External links configuration
export const SOCIAL_LINKS = [
  {
    href: "https://explorer.charms.dev",
    label: "EXPLORER",
    icon: "🔍",
    bgColor: "bg-pixel-primary",
    textColor: "text-black",
  },
  {
    href: "https://mempool.space/testnet4",
    label: "MEMPOOL",
    icon: "📊",
    bgColor: "bg-pixel-bg-light",
    textColor: "text-pixel-text",
  },
  {
    href: "https://charms.dev",
    label: "CHARMS",
    icon: "🔮",
    bgColor: "bg-pixel-bg-light",
    textColor: "text-pixel-text",
  },
] as const;

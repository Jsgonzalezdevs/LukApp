const NOMBRES: Record<string, string> = {
  ShoppingCart: 'Mercado', Utensils: 'Comida', Coffee: 'Café', Bus: 'Transporte', Lightbulb: 'Servicios', Pill: 'Salud', Home: 'Hogar', Film: 'Cine', Gamepad2: 'Videojuegos', Shirt: 'Ropa', Book: 'Educación', RefreshCw: 'Transferencia', PiggyBank: 'Ahorro', DollarSign: 'Ingresos', Package: 'Otros', Dumbbell: 'Gimnasio', PawPrint: 'Mascotas', Cat: 'Gato', Baby: 'Bebé', Gift: 'Regalo', Plane: 'Viajes', Smartphone: 'Celular', Scissors: 'Belleza', Wrench: 'Herramientas', Sparkles: 'Especial', Wallet: 'Billetera', Tent: 'Camping', Car: 'Carro', GraduationCap: 'Estudios', Laptop: 'Computador', LifeBuoy: 'Emergencias', Gem: 'Objeto valioso', Target: 'Meta',
};

export const etiquetaIcono = (nombre: string): string => NOMBRES[nombre] ?? 'Ícono personal';

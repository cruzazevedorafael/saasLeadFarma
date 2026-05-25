import { Product } from './store'

export const products: Product[] = [
  {
    id: '1',
    name: 'Legging Suplex Premium',
    category: 'Leggings',
    image: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop',
    priceRetail: 89.90,
    priceWholesale: 49.90,
    minWholesale: 6,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Cinza', 'Azul Marinho'],
    description: 'Legging de alta compressão com tecido suplex premium. Cintura alta que modela o corpo.'
  },
  {
    id: '2',
    name: 'Top Nadador Fitness',
    category: 'Tops',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop',
    priceRetail: 59.90,
    priceWholesale: 34.90,
    minWholesale: 10,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Rosa', 'Verde Neon'],
    description: 'Top nadador com sustentação média-alta. Ideal para treinos intensos.'
  },
  {
    id: '3',
    name: 'Conjunto Seamless',
    category: 'Conjuntos',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',
    priceRetail: 159.90,
    priceWholesale: 89.90,
    minWholesale: 4,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Nude', 'Cinza'],
    description: 'Conjunto sem costuras que proporciona conforto máximo. Legging + Top combinando.'
  },
  {
    id: '4',
    name: 'Short Saia Academia',
    category: 'Shorts',
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=500&fit=crop',
    priceRetail: 69.90,
    priceWholesale: 39.90,
    minWholesale: 8,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Vermelho', 'Branco'],
    description: 'Short saia com shorts interno anti-transparência. Perfeito para corrida.'
  },
  {
    id: '5',
    name: 'Regata Dry Fit',
    category: 'Regatas',
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&h=500&fit=crop',
    priceRetail: 49.90,
    priceWholesale: 29.90,
    minWholesale: 12,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Branco', 'Preto', 'Rosa'],
    description: 'Regata com tecnologia dry fit que mantém o corpo seco durante o treino.'
  },
  {
    id: '6',
    name: 'Calça Jogger Fitness',
    category: 'Calcas',
    image: 'https://images.unsplash.com/photo-1556906918-c3071bd15252?w=400&h=500&fit=crop',
    priceRetail: 119.90,
    priceWholesale: 69.90,
    minWholesale: 5,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Cinza Mescla', 'Verde Militar'],
    description: 'Calça jogger estilo esportivo com bolsos laterais e punhos nas pernas.'
  },
  {
    id: '7',
    name: 'Body Fitness Decote V',
    category: 'Bodies',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop',
    priceRetail: 79.90,
    priceWholesale: 44.90,
    minWholesale: 8,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Nude', 'Bordô'],
    description: 'Body com decote V e costas nadador. Tecido com proteção UV.'
  },
  {
    id: '8',
    name: 'Bermuda Ciclista',
    category: 'Bermudas',
    image: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&h=500&fit=crop',
    priceRetail: 59.90,
    priceWholesale: 34.90,
    minWholesale: 10,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Cinza', 'Rosa'],
    description: 'Bermuda ciclista cintura alta com compressão. Não marca celulite.'
  },
  {
    id: '9',
    name: 'Jaqueta Corta Vento',
    category: 'Jaquetas',
    image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=500&fit=crop',
    priceRetail: 129.90,
    priceWholesale: 74.90,
    minWholesale: 4,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Verde Neon', 'Branco'],
    description: 'Jaqueta leve corta vento com capuz. Ideal para corridas ao ar livre.'
  },
  {
    id: '10',
    name: 'Cropped Manga Longa',
    category: 'Croppeds',
    image: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&h=500&fit=crop',
    priceRetail: 69.90,
    priceWholesale: 39.90,
    minWholesale: 8,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Branco', 'Cinza'],
    description: 'Cropped manga longa com proteção solar UV50+. Design moderno.'
  },
  {
    id: '11',
    name: 'Legging Empina Bumbum',
    category: 'Leggings',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=500&fit=crop',
    priceRetail: 99.90,
    priceWholesale: 54.90,
    minWholesale: 6,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Vinho', 'Azul Petróleo'],
    description: 'Legging com tecnologia que realça os glúteos. Costura scrunch no bumbum.'
  },
  {
    id: '12',
    name: 'Top Long Line',
    category: 'Tops',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',
    priceRetail: 64.90,
    priceWholesale: 37.90,
    minWholesale: 10,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preto', 'Lilás', 'Verde Água'],
    description: 'Top alongado com bojo removível. Alta sustentação e conforto.'
  }
]

export const categories = [
  'Todos',
  'Leggings',
  'Tops',
  'Conjuntos',
  'Shorts',
  'Regatas',
  'Calcas',
  'Bodies',
  'Bermudas',
  'Jaquetas',
  'Croppeds'
]

// Jelajah Nusantara - data 8 pulau.
// Tiap pemain hanya melihat clue miliknya sendiri. Jawaban = indeks di 'opsi' (mulai dari 0).

const PERAN = {
  1: 'Penjaga Peta',
  2: 'Penyelidik Budaya'
};

module.exports = [
  {
    pulau: 'Sumatra',
    nama: 'Danau di Atas Kawah Raksasa',
    intro: 'Perjalanan dimulai di Pulau Sumatra. Artefak pertama tersembunyi di tepi sebuah danau besar.',
    peran: PERAN,
    clue: {
      1: 'Danau yang dicari tidak berada di Sumatera Barat.',
      2: 'Danau yang dicari tidak berada di Provinsi Jambi, dan terbentuk dari letusan gunung api super sekitar 74.000 tahun lalu.'
    },
    pertanyaan: 'Di danau manakah artefak pertama tersembunyi?',
    opsi: ['Danau Maninjau', 'Danau Toba', 'Danau Kerinci', 'Danau Singkarak'],
    jawaban: 1,
    artefak: 'Ulos Emas',
    fakta: 'Danau Toba di Sumatera Utara adalah danau vulkanik terbesar di dunia. Di tengahnya ada Pulau Samosir.'
  },
  {
    pulau: 'Jawa',
    nama: 'Candi di Atas Bukit',
    intro: 'Kalian menyeberang ke Pulau Jawa. Artefak kedua dijaga oleh sebuah candi kuno.',
    peran: PERAN,
    clue: {
      1: 'Candi yang dicari bercorak Buddha.',
      2: 'Candi yang dicari berada di Pulau Jawa.'
    },
    pertanyaan: 'Di candi manakah artefak kedua disimpan?',
    opsi: ['Candi Penataran', 'Candi Muara Takus', 'Candi Borobudur', 'Candi Sukuh'],
    jawaban: 2,
    artefak: 'Stupa Emas Mini',
    fakta: 'Borobudur di Magelang dibangun sekitar abad ke-8 sampai ke-9 pada masa Dinasti Syailendra. Ini candi Buddha terbesar di dunia dan masuk Warisan Dunia UNESCO.'
  },
  {
    pulau: 'Kalimantan',
    nama: 'Sungai Terpanjang',
    intro: 'Perahu kalian masuk ke jantung Kalimantan. Artefak ketiga hanyut di sebuah sungai besar.',
    peran: PERAN,
    clue: {
      1: 'Sungai yang dicari adalah sungai terpanjang di Indonesia, panjangnya lebih dari 1.100 km.',
      2: 'Sungai yang dicari mengalir di Pulau Kalimantan dan melewati kota Pontianak.'
    },
    pertanyaan: 'Di sungai manakah artefak ketiga hanyut?',
    opsi: ['Sungai Musi', 'Sungai Mahakam', 'Sungai Kapuas', 'Sungai Barito'],
    jawaban: 2,
    artefak: 'Perisai Talawang',
    fakta: 'Sungai Kapuas sepanjang sekitar 1.143 km adalah sungai terpanjang di Indonesia. Kota Pontianak dilalui garis khatulistiwa.'
  },
  {
    pulau: 'Sulawesi',
    nama: 'Perahu Para Pelaut',
    intro: 'Angin membawa kalian ke Sulawesi. Artefak keempat ada di atas perahu legendaris.',
    peran: PERAN,
    clue: {
      1: 'Perahu yang dicari dibuat oleh pengrajin di Bulukumba, Sulawesi Selatan.',
      2: 'Perahu yang dicari punya dua tiang layar dan tujuh layar.'
    },
    pertanyaan: 'Di perahu manakah artefak keempat tersimpan?',
    opsi: ['Jukung', 'Pinisi', 'Lancang Kuning', 'Sandeq'],
    jawaban: 1,
    artefak: 'Kompas Perunggu',
    fakta: 'Pinisi adalah perahu layar tradisional Bugis-Makassar. Seni pembuatannya diakui UNESCO sebagai Warisan Budaya Takbenda pada 2017.'
  },
  {
    pulau: 'Nusa Tenggara',
    nama: 'Rumah Sang Kadal Raksasa',
    intro: 'Kalian tiba di gugusan pulau kering di timur. Artefak kelima dijaga hewan purba.',
    peran: PERAN,
    clue: {
      1: 'Taman nasional yang dicari tidak berada di Pulau Jawa.',
      2: 'Taman nasional yang dicari tidak berada di Papua, dan termasuk Situs Warisan Dunia UNESCO.'
    },
    pertanyaan: 'Di taman nasional manakah artefak kelima disembunyikan?',
    opsi: ['Taman Nasional Bromo Tengger Semeru', 'Taman Nasional Lorentz', 'Taman Nasional Komodo', 'Taman Nasional Ujung Kulon'],
    jawaban: 2,
    artefak: 'Gong Perunggu',
    fakta: 'Taman Nasional Komodo di Nusa Tenggara Timur adalah habitat alami komodo, kadal terbesar di dunia yang panjangnya bisa sekitar 3 meter.'
  },
  {
    pulau: 'Maluku',
    nama: 'Pulau Rempah',
    intro: 'Kalian berlayar ke Maluku, tempat bangsa-bangsa Eropa dulu berebut rempah. Artefak keenam ada di pulau yang harum.',
    peran: PERAN,
    clue: {
      1: 'Pulau yang dicari tidak berada di Sumatera maupun Nusa Tenggara.',
      2: 'Pulau yang dicari tidak berada di Maluku Utara, dan dulu terkenal sebagai penghasil pala yang diperebutkan VOC dan Inggris.'
    },
    pertanyaan: 'Di pulau manakah artefak keenam terkubur?',
    opsi: ['Pulau Nias', 'Kepulauan Banda', 'Pulau Sumba', 'Pulau Ternate'],
    jawaban: 1,
    artefak: 'Biji Pala Emas',
    fakta: 'Kepulauan Banda dulu penghasil pala utama dunia. Lewat Perjanjian Breda 1667, Belanda menguasai Pulau Run dan menukarnya dengan Manhattan (New Amsterdam) milik Inggris.'
  },
  {
    pulau: 'Papua',
    nama: 'Seniman Kayu dari Rawa',
    intro: 'Hampir di ujung timur negeri. Artefak ketujuh dijaga sebuah suku dengan seni yang mendunia.',
    peran: PERAN,
    clue: {
      1: 'Suku yang dicari tidak tinggal di Pulau Jawa maupun Pulau Lombok.',
      2: 'Suku yang dicari terkenal dengan seni ukir kayu dan patung leluhur.'
    },
    pertanyaan: 'Suku manakah penjaga artefak ketujuh?',
    opsi: ['Suku Baduy', 'Suku Dani', 'Suku Asmat', 'Suku Sasak'],
    jawaban: 2,
    artefak: 'Patung Bisj Mini',
    fakta: 'Suku Asmat tinggal di wilayah rawa pesisir selatan Papua dan terkenal dengan ukiran kayu serta patung leluhur yang dikenal dunia.'
  },
  {
    pulau: 'Seluruh Nusantara',
    nama: 'Semboyan Pemersatu',
    intro: 'Tujuh artefak sudah terkumpul. Artefak terakhir adalah kata-kata yang menyatukan semua pulau.',
    peran: PERAN,
    clue: {
      1: 'Semboyan yang dicari tertulis pada pita yang dicengkeram burung Garuda Pancasila.',
      2: 'Semboyan yang dicari berasal dari Kakawin Sutasoma karya Mpu Tantular pada masa Majapahit.'
    },
    pertanyaan: 'Semboyan manakah artefak terakhir itu?',
    opsi: ['Tut Wuri Handayani', 'Bhinneka Tunggal Ika', 'Gemah Ripah Loh Jinawi', 'Jer Basuki Mawa Beya'],
    jawaban: 1,
    artefak: 'Pita Garuda',
    fakta: 'Bhinneka Tunggal Ika berarti berbeda-beda tetapi tetap satu. Semboyan ini menjadi pengikat ribuan pulau dan ratusan suku di Indonesia.'
  }
];

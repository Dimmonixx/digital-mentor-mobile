export type CaseMedia = {
  uri: string;
  stage: string;
};

export type SpectralShade = {
  zone: string; // Шейка / Тело / Край
  shade: string; // A1, A2, B1...
  value: number; // 0-100 relative intensity for the bar
};

export type RatingStat = {
  avg: number;
  count: number;
};

export type CaseVotes = {
  aesthetics: RatingStat;
  occlusion: RatingStat;
  anatomy: RatingStat;
};

export type RiddleOption = {
  label: string; // A1, A2, B1, C2
  percent: number; // share of other colleagues' votes
};

export type CaseRiddle = {
  question: string;
  options: RiddleOption[];
  correct: string;
};

export type ClinicalCase = {
  id: string;
  author: string;
  role: 'Врач' | 'Техник';
  avatar: string;
  tags: string[];
  description: string;
  fullDescription: string;
  media: CaseMedia[];
  comments: number;
  votes: CaseVotes;
  spectral: SpectralShade[];
  riddle?: CaseRiddle;
};

export const CASES: ClinicalCase[] = [
  {
    id: '1',
    author: 'Кривоносов Д.В.',
    role: 'Врач',
    avatar: 'https://i.pravatar.cc/150?img=12',
    tags: ['#Имплантация', '#Виниры', '#ISO_21'],
    description:
      'Тотальная реабилитация фронтальной группы. Установлено 6 виниров из дисиликата лития с предварительной коррекцией контура десны. Результат через 2 недели.',
    fullDescription:
      'Пациентка 34 лет обратилась с жалобами на эстетику фронтальной группы зубов: диастема, неровный режущий край и потемневшие старые реставрации. После цифрового протокола Digital Smile Design был спланирован эстетический результат.\n\nПроведена минимально-инвазивная препаровка 13–23 с сохранением эмали. Изготовлено 6 виниров из дисиликата лития (e.max Press) с индивидуальной характеризацией. Перед фиксацией выполнена коррекция контура десны диодным лазером для симметрии зенитов.\n\nФиксация на адгезивный протокол (Variolink Esthetic). Контроль через 2 недели: пациентка полностью удовлетворена эстетикой и функцией, отмечена идеальная интеграция с мягкими тканями.',
    media: [
      { uri: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&q=80', stage: 'До' },
      { uri: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=800&q=80', stage: 'В процессе' },
      { uri: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80', stage: 'После' },
    ],
    comments: 24,
    votes: {
      aesthetics: { avg: 4.8, count: 42 },
      occlusion: { avg: 4.5, count: 38 },
      anatomy: { avg: 4.7, count: 40 },
    },
    spectral: [
      { zone: 'Шейка', shade: 'A3', value: 78 },
      { zone: 'Тело', shade: 'A2', value: 62 },
      { zone: 'Край', shade: 'A1', value: 44 },
    ],
    riddle: {
      question: 'Угадайте выбранный оттенок VITA для тела винира',
      options: [
        { label: 'A1', percent: 20 },
        { label: 'A2', percent: 65 },
        { label: 'B1', percent: 10 },
        { label: 'C2', percent: 5 },
      ],
      correct: 'A2',
    },
  },
  {
    id: '2',
    author: 'Литвиненко А.С.',
    role: 'Техник',
    avatar: 'https://i.pravatar.cc/150?img=33',
    tags: ['#Цирконий', '#Мост', '#Окклюзия'],
    description:
      'Изготовление циркониевого моста на жевательную группу. Особое внимание уделено анатомии бугров и точкам окклюзионного контакта для равномерного распределения нагрузки.',
    fullDescription:
      'Поступил заказ на изготовление циркониевого мостовидного протеза 36–38 с опорой на имплантат и собственный зуб. По интраоральному скану смоделирован каркас в exocad с учётом траектории введения и толщины стенок.\n\nОсобое внимание уделено анатомии жевательной поверхности: воспроизведены бугры, фиссуры и краевые гребни с равномерными окклюзионными контактами. Фрезеровка из преспеченного циркония (1100 МПа), окрашивание лайнерами, синтеризация и индивидуальная глазуровка.\n\nКонтроль артикуляции показал равномерное распределение нагрузки без преждевременных контактов в боковых движениях.',
    media: [
      { uri: 'https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?w=800&q=80', stage: 'Модель' },
      { uri: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&q=80', stage: 'Каркас' },
      { uri: 'https://images.unsplash.com/photo-1581585504237-67d4d8c2c5b9?w=800&q=80', stage: 'Готово' },
    ],
    comments: 18,
    votes: {
      aesthetics: { avg: 4.6, count: 31 },
      occlusion: { avg: 4.9, count: 35 },
      anatomy: { avg: 4.8, count: 33 },
    },
    spectral: [
      { zone: 'Шейка', shade: 'A3.5', value: 82 },
      { zone: 'Тело', shade: 'A3', value: 70 },
      { zone: 'Край', shade: 'A2', value: 52 },
    ],
  },
  {
    id: '3',
    author: 'Сергеева М.И.',
    role: 'Врач',
    avatar: 'https://i.pravatar.cc/150?img=45',
    tags: ['#Отбеливание', '#Гигиена', '#Реставрация'],
    description:
      'Комплексное эстетическое лечение: профессиональная гигиена, отбеливание Zoom 4 и композитная реставрация скола центрального резца. Пациент доволен результатом.',
    fullDescription:
      'Пациент 28 лет обратился со сколом угла коронки центрального резца и желанием улучшить цвет зубов. План лечения: профессиональная гигиена, отбеливание и прямая композитная реставрация.\n\nПроведена ультразвуковая чистка и Air-Flow, затем офисное отбеливание Zoom 4 (сдвиг на 6 оттенков по шкале VITA). Через две недели для стабилизации цвета выполнена послойная композитная реставрация 11 с воспроизведением мамелонов и опалесценции режущего края.\n\nИтоговый результат естественный, граница реставрации незаметна. Пациент доволен эстетикой улыбки.',
    media: [
      { uri: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&q=80', stage: 'До' },
      { uri: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=800&q=80', stage: 'После' },
    ],
    comments: 41,
    votes: {
      aesthetics: { avg: 4.7, count: 55 },
      occlusion: { avg: 4.3, count: 47 },
      anatomy: { avg: 4.5, count: 49 },
    },
    spectral: [
      { zone: 'Шейка', shade: 'B2', value: 60 },
      { zone: 'Тело', shade: 'B1', value: 48 },
      { zone: 'Край', shade: 'A1', value: 38 },
    ],
  },
  {
    id: '4',
    author: 'Бондаренко П.Л.',
    role: 'Техник',
    avatar: 'https://i.pravatar.cc/150?img=68',
    tags: ['#Имплантация', '#Абатмент', '#ISO_14'],
    description:
      'Индивидуальный титановый абатмент с цирконевой коронкой в области моляра. Воспроизведена естественная морфология фиссур и натуральный оттенок A3.',
    fullDescription:
      'Изготовление индивидуального титанового абатмента и циркониевой коронки на имплантат в области первого моляра. Сканирование скан-боди, моделирование профиля прорезывания для формирования десны.\n\nАбатмент отфрезерован из титанового блока с учётом ангуляции имплантата. Коронка из многослойного циркония с предустановленным градиентом цвета A3, индивидуальная характеризация фиссур и бугров для естественного вида.\n\nПосле фиксации достигнута гармоничная интеграция с соседними зубами как по цвету, так и по анатомии.',
    media: [
      { uri: 'https://images.unsplash.com/photo-1571772996211-2f02c9727629?w=800&q=80', stage: 'Сканирование' },
      { uri: 'https://images.unsplash.com/photo-1606265752439-1f18756aa8ed?w=800&q=80', stage: 'Фрезеровка' },
      { uri: 'https://images.unsplash.com/photo-1620912189865-1e8a44ee8d6f?w=800&q=80', stage: 'Фиксация' },
    ],
    comments: 12,
    votes: {
      aesthetics: { avg: 4.9, count: 22 },
      occlusion: { avg: 5.0, count: 24 },
      anatomy: { avg: 5.0, count: 25 },
    },
    spectral: [
      { zone: 'Шейка', shade: 'A3.5', value: 80 },
      { zone: 'Тело', shade: 'A3', value: 66 },
      { zone: 'Край', shade: 'A2', value: 50 },
    ],
  },
];

export const getCaseById = (id: string | undefined) =>
  CASES.find((c) => c.id === id);

export type CaseMedia = {
  uri: string;
  stage: string;
};

export type CaseComment = {
  id: string;
  author: string;
  avatar: string;
  text: string;
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
  commentsList: CaseComment[];
  aiReview: string;
  activity: number; // активность за последние 7 дней (для "Работы недели")
  anonymous?: boolean;
  isOwn?: boolean; // принадлежит текущему пользователю
  riddle?: CaseRiddle;
};

export const CASES: ClinicalCase[] = [
  {
    id: '1',
    author: 'Кривоносов Д.И.',
    role: 'Техник',
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
    activity: 96,
    commentsList: [
      { id: 'c1', author: 'Литвиненко А.С.', avatar: 'https://i.pravatar.cc/150?img=33', text: 'Чистая работа! Зениты выровняли идеально.' },
      { id: 'c2', author: 'Сергеева М.И.', avatar: 'https://i.pravatar.cc/150?img=45', text: 'Какой цемент использовали для фиксации?' },
      { id: 'c3', author: 'Бондаренко П.Л.', avatar: 'https://i.pravatar.cc/150?img=68', text: 'Режущий край живой, опалесценция огонь.' },
    ],
    aiReview:
      'Уступ завален, но полировка блестит ярче, чем будущее этого зуба. Симметрия зенитов хороша, но контактный пункт между 21 и 22 просит о помощи. Эстетика на 8/10, а вот фотопротокол — на 3/10: снимайте без вспышки в лоб, это не допрос. Итог: пациент счастлив, перфекционист внутри меня — почти.',
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
    activity: 54,
    commentsList: [
      { id: 'c1', author: 'Кривоносов Д.И.', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Окклюзия выверена безупречно.' },
      { id: 'c2', author: 'Анонимный коллега', avatar: '', text: 'Краевые гребни можно было выразить чуть сильнее.' },
    ],
    aiReview:
      'Каркас плотный, фрезеровка ровная — видно, что руки растут откуда надо. Но фиссуры глубокие, словно Марианская впадина — пациент будет вылавливать оттуда семечки годами. Глазуровка ровная, но блеск на грани "стоматологической дискотеки". 7.5/10 — крепко, но без оваций.',
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
    activity: 70,
    commentsList: [
      { id: 'c1', author: 'Кривоносов Д.И.', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Отличный переход по цвету, реставрация невидима.' },
      { id: 'c2', author: 'Литвиненко А.С.', avatar: 'https://i.pravatar.cc/150?img=33', text: 'Мамелоны выглядят естественно.' },
      { id: 'c3', author: 'Ольга К.', avatar: 'https://i.pravatar.cc/150?img=20', text: 'Zoom 4 и композит — классика жанра.' },
    ],
    aiReview:
      'Отбелили до сияния холодильника — пациент теперь освещает комнату улыбкой. Композитная реставрация аккуратна, граница невидима — респект. Но оттенок на грани: ещё чуть-чуть и это была бы не улыбка, а прожектор. 8/10, но очки выдавать не буду.',
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
    activity: 40,
    commentsList: [
      { id: 'c1', author: 'Сергеева М.И.', avatar: 'https://i.pravatar.cc/150?img=45', text: 'Профиль прорезывания отличный, десна отлично ляжет.' },
      { id: 'c2', author: 'Кривоносов Д.И.', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Анатомия бугров на высоте.' },
    ],
    aiReview:
      'Абатмент хорош, коронка живая, но давайте честно: профиль прорезывания вы сделали лучше, чем некоторые делают карьеру. Градиент A3 пойман точно, фиссуры живые. Единственное — контактный пункт чуть туговат, нить будет рваться с проклятиями. 9/10 — почти завидую.',
  },
];

export const getCaseById = (id: string | undefined) =>
  CASES.find((c) => c.id === id);

// Полное название роли для бейджа
export const roleLabel = (role: ClinicalCase['role']): string =>
  role === 'Техник' ? 'Зубной техник' : 'Стоматолог';

// Короткий едкий тизер AI-разбора (первое предложение)
export const getAiTeaser = (review: string): string => {
  const i = review.search(/[.!?]/);
  return i >= 0 ? review.slice(0, i + 1).trim() : review;
};

/* ---------------- Текущий пользователь ---------------- */
// Имя текущего пользователя (mock). Кейсы с этим автором — его собственные.
export const CURRENT_USER_NAME = 'Кривоносов Д.И.';

// Кейс принадлежит текущему пользователю (по совпадению автора с CURRENT_USER_NAME)
export const isOwnCase = (c: ClinicalCase): boolean =>
  !c.anonymous && (c.isOwn === true || c.author === CURRENT_USER_NAME);

/* ---------------- Работа недели ---------------- */
// Кейс с максимальной активностью (комментарии + реакции) за последние 7 дней
export const getWorkOfTheWeek = (): ClinicalCase =>
  CASES.reduce((best, c) =>
    c.activity + c.commentsList.length > best.activity + best.commentsList.length ? c : best
  , CASES[0]);

/* ---------------- Индекс мастерства ---------------- */
export type MasteryLevel = 'Ученик' | 'Мастер' | 'Эксперт' | 'Легенда';

export type MasteryProgress = {
  publishedWorks: number;
  correctRiddles: number;
  aiLikes: number;
};

// Мутабельный прогресс (mock-геймификация). Стартовые значения для демо.
const masteryProgress: MasteryProgress = {
  publishedWorks: CASES.filter(isOwnCase).length + 2,
  correctRiddles: 3,
  aiLikes: 7,
};

export const getMasteryProgress = (): MasteryProgress => ({ ...masteryProgress });

export const registerCorrectRiddle = () => {
  masteryProgress.correctRiddles += 1;
};

export const registerAiLike = () => {
  masteryProgress.aiLikes += 1;
};

export const computeMasteryIndex = (p: MasteryProgress): number =>
  p.publishedWorks * 10 + p.correctRiddles * 5 + p.aiLikes;

export const getMasteryLevel = (index: number): MasteryLevel => {
  if (index >= 200) return 'Легенда';
  if (index >= 100) return 'Эксперт';
  if (index >= 40) return 'Мастер';
  return 'Ученик';
};

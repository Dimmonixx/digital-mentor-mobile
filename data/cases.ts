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

let CASES_DATA: ClinicalCase[] = [];

export const CASES = CASES_DATA;

export const SEED_CASES: ClinicalCase[] = [
  {
    id: 'seed_1',
    author: 'Кривоносов Д.И.',
    role: 'Техник',
    avatar: '1',
    isOwn: true,
    tags: ['Металлокерамика', 'Цельнолитые', 'Передний сегмент'],
    description: 'Протезирование 11 и 21 зубов металлокерамическими коронками на имплантах. Сложный случай — подбор цвета.',
    fullDescription: 'Пациент обратился с жалобой на отсутствие центральных резцов. После установки имплантов проведено изготовление металлокерамических коронок с тщательным подбором цвета по шкале VITA. Основная сложность — добиться максимальной прозрачности в области режущего края и выраженной мамелонной структуры.',
    media: [],
    commentsList: [],
    aiReview: 'Работа демонстрирует хорошее владение техникой нанесения масс. Режущий край проработан с характеристиками, однако маргинальная посадка требует доработки — зазор в области пришеечной трети превышает допустимые 50 мкм. Цвет подобран корректно, но интенсивность дентинной массы на вестибулярной поверхности избыточна.',
    activity: 0,
    riddle: {
      question: 'Какой цвет VITA Classic наиболее точно соответствует молочным зубам у детей 6-8 лет?',
      options: [
        { label: 'A1', percent: 45 },
        { label: 'B1', percent: 35 },
        { label: 'C1', percent: 10 },
        { label: 'D2', percent: 10 },
      ],
      correct: 'B1',
    },
  },
  {
    id: 'seed_3',
    author: 'Сидоренко М.П.',
    role: 'Техник',
    avatar: '3',
    tags: ['Циркон', 'Безметалловая керамика', 'Эстетика'],
    description: 'Изготовление виниров из диоксида циркония на 12–22 зубы. Минимальная инвазивность.',
    fullDescription: 'Пациентка 28 лет обратилась с целью коррекции формы и цвета передних зубов. Выполнено препарирование под виниры с сохранением эмали. Изготовлены прессованные виниры из IPS e.max Press. Толщина конструкции 0.3–0.5 мм. Фиксация выполнена на двойной адгезив с использованием светоотверждаемого цемента.',
    media: [],
    commentsList: [],
    aiReview: 'Виниры выполнены с соблюдением принципов минимальной инвазивности. Прозрачность материала и характеристики режущего края воссозданы на высоком уровне. Рекомендую обратить внимание на текстуру поверхности — горизонтальная перикиматийная структура слабо выражена на 13 и 23 зубах.',
    activity: 0,
  },
];

export const getCases = () => CASES;

export const addCase = (clinicalCase: ClinicalCase) => {
  CASES.unshift(clinicalCase);
};

export const getCaseById = (id: string | undefined) =>
  CASES.find((c) => c.id === id);

export const deleteCaseById = (id: string): boolean => {
  const index = CASES.findIndex((c) => c.id === id);
  if (index !== -1) {
    CASES.splice(index, 1);
    return true;
  }
  return false;
};

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

// Кейс принадлежит текущему пользователю
export const isOwnCase = (
  c: ClinicalCase,
  currentUserId?: string,
  currentEmail?: string,
  currentAuthorName?: string,
  currentFullName?: string,
): boolean => {
  if (c.anonymous) return false;
  // Строгая проверка по уникальным идентификаторам текущего пользователя
  if (currentUserId && (c as any).authorId && (c as any).authorId === currentUserId) return true;
  if (currentEmail && (c as any).authorEmail && (c as any).authorEmail.toLowerCase() === currentEmail.toLowerCase()) return true;
  return false;
};

/* ---------------- Работа недели ---------------- */
// Кейс с максимальной активностью (комментарии + реакции) за последние 7 дней
// Только кейсы с activity > 0 могут стать работой недели
export const getWorkOfTheWeek = (): ClinicalCase | null => {
  const activeCases = CASES.filter(c => c.activity > 0);
  if (activeCases.length === 0) return null;
  return activeCases.reduce((best, c) =>
    c.activity + c.commentsList.length > best.activity + best.commentsList.length ? c : best
  , activeCases[0]);
};

/* ---------------- Индекс мастерства ---------------- */
export type MasteryLevel = 'Ученик' | 'Мастер' | 'Эксперт' | 'Легенда';

export type MasteryProgress = {
  publishedWorks: number;
  correctRiddles: number;
  aiLikes: number;
};

// Мутабельный прогресс (mock-геймификация). Стартовые значения для демо.
const masteryProgress: MasteryProgress = {
  publishedWorks: CASES.filter((c) => isOwnCase(c)).length + 2,
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

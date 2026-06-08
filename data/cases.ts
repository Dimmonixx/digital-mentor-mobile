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

// Кейс принадлежит текущему пользователю (по совпадению автора с CURRENT_USER_NAME)
export const isOwnCase = (c: ClinicalCase): boolean =>
  !c.anonymous && (c.isOwn === true || c.author === CURRENT_USER_NAME);

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

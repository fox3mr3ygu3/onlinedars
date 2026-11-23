/**
 * Pure data builders for the seed (no DB access) so they can be unit-tested:
 * every lesson must have exactly 4 practices × 6 questions, covering all 5 question types.
 */
import {
  PRACTICES_PER_LESSON,
  QUESTIONS_PER_PRACTICE,
  QuestionType,
  LessonMaterialType,
} from '@onlinedars/shared';

export interface SeedOption {
  text: string;
  isCorrect?: boolean;
  matchText?: string;
  blankIndex?: number;
  imageUrl?: string;
}

export interface SeedQuestion {
  type: QuestionType;
  prompt: string;
  imageUrl?: string;
  explanation?: string;
  isMultiple?: boolean;
  options: SeedOption[];
}

export interface SeedPractice {
  title: string;
  questions: SeedQuestion[];
}

export interface SeedMaterial {
  type: LessonMaterialType;
  title: string;
  content?: string;
  videoUrl?: string;
}

export interface SeedLesson {
  title: string;
  summary: string;
  durationMinutes: number;
  materials: SeedMaterial[];
  practices: SeedPractice[];
}

export interface SeedModule {
  title: string;
  description: string;
  lessons: SeedLesson[];
}

interface Term {
  term: string;
  definition: string;
}

export interface LessonTopic {
  title: string;
  summary: string;
  terms: Term[]; // exactly 6
  fakeTerms: string[]; // plausible but wrong
}

const TYPE_CYCLE: QuestionType[] = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.MATCHING,
  QuestionType.FILL_BLANK,
  QuestionType.IMAGE_BASED,
];

const at = <T>(arr: readonly T[], i: number): T =>
  arr[((i % arr.length) + arr.length) % arr.length] as T;

/** Builds one question of the given type from the lesson's term list. `n` varies the content. */
export function buildQuestion(type: QuestionType, topic: LessonTopic, n: number): SeedQuestion {
  const main = at(topic.terms, n);
  const others = [1, 2, 3].map((k) => at(topic.terms, n + k));
  switch (type) {
    case QuestionType.MULTIPLE_CHOICE:
      if (n % 2 === 1) {
        // multi-select variant
        return {
          type,
          isMultiple: true,
          prompt: `Quyidagilardan qaysilari "${topic.title}" mavzusida o'rganilgan atamalar?`,
          explanation: `${main.term} va ${at(others, 0).term} — darsda ko'rib chiqilgan atamalar.`,
          options: [
            { text: main.term, isCorrect: true },
            { text: at(topic.fakeTerms, n), isCorrect: false },
            { text: at(others, 0).term, isCorrect: true },
            { text: at(topic.fakeTerms, n + 1), isCorrect: false },
          ],
        };
      }
      return {
        type,
        prompt: `"${main.term}" nima?`,
        explanation: `${main.term} — ${main.definition}.`,
        options: rotate(
          [
            { text: main.definition, isCorrect: true },
            ...others.map((o) => ({ text: o.definition, isCorrect: false })),
          ],
          n,
        ),
      };
    case QuestionType.TRUE_FALSE: {
      const truthful = n % 2 === 0;
      const def = truthful ? main.definition : at(others, 0).definition;
      return {
        type,
        prompt: `To'g'rimi: "${main.term}" — ${def}.`,
        explanation: `${main.term} — ${main.definition}.`,
        options: [
          { text: "To'g'ri", isCorrect: truthful },
          { text: "Noto'g'ri", isCorrect: !truthful },
        ],
      };
    }
    case QuestionType.MATCHING:
      return {
        type,
        prompt: "Atamalarni ularning ta'rifi bilan moslang.",
        options: [main, ...others.slice(0, 2)].map((t) => ({
          text: t.term,
          matchText: t.definition,
        })),
      };
    case QuestionType.FILL_BLANK:
      return {
        type,
        prompt: `{{0}} — ${main.definition}.`,
        explanation: `To'g'ri javob: ${main.term}.`,
        options: [{ text: main.term, blankIndex: 0 }],
      };
    case QuestionType.IMAGE_BASED:
      return {
        type,
        prompt: "Rasmda ko'rsatilgan atama nimani anglatadi?",
        imageUrl: `https://placehold.co/600x300/png?text=${encodeURIComponent(main.term)}`,
        explanation: `${main.term} — ${main.definition}.`,
        options: rotate(
          [
            { text: main.definition, isCorrect: true },
            ...others.map((o) => ({ text: o.definition, isCorrect: false })),
          ],
          n + 1,
        ),
      };
  }
}

function rotate<T>(arr: T[], by: number): T[] {
  const k = by % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/** 4 practices × 6 questions; types cycle so each practice mixes types and the lesson covers all 5. */
export function buildPractices(topic: LessonTopic): SeedPractice[] {
  return Array.from({ length: PRACTICES_PER_LESSON }, (_, p) => ({
    title: `${p + 1}-amaliyot: ${topic.title}`,
    questions: Array.from({ length: QUESTIONS_PER_PRACTICE }, (_, q) => {
      const i = p * QUESTIONS_PER_PRACTICE + q;
      return buildQuestion(at(TYPE_CYCLE, i), topic, i);
    }),
  }));
}

const TOPICS: { module: string; description: string; lessons: LessonTopic[] }[] = [
  {
    module: 'HTML asoslari',
    description: 'Veb-sahifa tuzilishi va asosiy teglar bilan tanishamiz.',
    lessons: [
      {
        title: 'HTML hujjat tuzilishi',
        summary: 'HTML hujjatining asosiy qismlari: doctype, head va body.',
        terms: [
          { term: '<!DOCTYPE html>', definition: 'hujjat HTML5 ekanini bildiruvchi e’lon' },
          { term: '<html>', definition: 'butun hujjatni o‘rab turuvchi ildiz element' },
          { term: '<head>', definition: 'sahifa haqidagi meta-ma’lumotlar bo‘limi' },
          { term: '<body>', definition: 'foydalanuvchiga ko‘rinadigan kontent bo‘limi' },
          { term: '<title>', definition: 'brauzer yorlig‘ida ko‘rinadigan sarlavha' },
          { term: '<meta>', definition: 'kodlash va viewport kabi sozlamalarni beruvchi teg' },
        ],
        fakeTerms: ['<header-meta>', '<docbody>', '<pagehead>'],
      },
      {
        title: 'Matn, havolalar va rasmlar',
        summary: "Paragraflar, sarlavhalar, havolalar, ro'yxatlar va rasmlar.",
        terms: [
          { term: '<p>', definition: 'paragraf (matn bloki)' },
          { term: '<a>', definition: 'boshqa sahifaga olib boruvchi havola' },
          { term: '<h1>', definition: 'eng yuqori darajadagi sarlavha' },
          { term: '<strong>', definition: 'muhim (qalin) matn' },
          { term: '<ul>', definition: 'tartiblanmagan ro‘yxat' },
          { term: '<img>', definition: 'rasm joylashtiruvchi teg' },
        ],
        fakeTerms: ['<paragraph>', '<link-to>', '<picture-src>'],
      },
    ],
  },
  {
    module: 'CSS asoslari',
    description: 'Sahifani bezash: selektorlar va box model.',
    lessons: [
      {
        title: 'CSS selektorlar',
        summary: 'Elementlarni tanlash usullari: teg, klass, id va psevdoklasslar.',
        terms: [
          { term: '.card', definition: 'card klassiga ega elementlarni tanlovchi selektor' },
          { term: '#main', definition: 'main id ga ega yagona elementni tanlovchi selektor' },
          { term: '*', definition: 'barcha elementlarni tanlovchi universal selektor' },
          { term: 'p', definition: 'barcha paragraf elementlarini tanlovchi teg selektori' },
          { term: ':hover', definition: 'sichqoncha ustida turgan holatni tanlovchi psevdoklass' },
          { term: 'ul > li', definition: 'ul ning bevosita li farzandlarini tanlovchi selektor' },
        ],
        fakeTerms: ['@card', '$main', '::click'],
      },
      {
        title: 'Box model',
        summary: "margin, padding, border va o'lchamlar qanday ishlaydi.",
        terms: [
          { term: 'margin', definition: 'element tashqarisidagi bo‘sh joy' },
          { term: 'padding', definition: 'kontent va chegara orasidagi ichki bo‘sh joy' },
          { term: 'border', definition: 'element atrofidagi chegara chizig‘i' },
          { term: 'width', definition: 'element kengligi' },
          { term: 'display', definition: 'element qanday joylashishini belgilovchi xossa' },
          {
            term: 'box-sizing',
            definition: 'kenglikka padding va border kirishini belgilovchi xossa',
          },
        ],
        fakeTerms: ['spacing', 'outline-gap', 'box-fill'],
      },
    ],
  },
];

export const DEMO_COURSE = {
  slug: 'veb-dasturlash-asoslari',
  title: 'Veb-dasturlash asoslari',
  shortDescription: 'HTML va CSS bilan birinchi veb-sahifangizni yarating.',
  description:
    'Ushbu kursda HTML hujjat tuzilishi, asosiy teglar, CSS selektorlar va box model bilan tanishasiz. Har bir dars 4 ta amaliyot va 24 ta savoldan iborat. Kurs oxirida yakuniy imtihon topshirib, sertifikat olasiz.',
  goals: [
    'HTML hujjatini to‘g‘ri tuzish',
    'Asosiy HTML teglaridan foydalanish',
    'CSS selektorlar bilan elementlarni bezash',
    'Box model asosida joylashuvni tushunish',
  ],
};

export function buildDemoModules(): SeedModule[] {
  return TOPICS.map((m) => ({
    title: m.module,
    description: m.description,
    lessons: m.lessons.map((topic) => ({
      title: topic.title,
      summary: topic.summary,
      durationMinutes: 20,
      materials: [
        {
          type: LessonMaterialType.TEXT,
          title: topic.title,
          content: `<h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.summary)}</p><ul>${topic.terms
            .map((t) => `<li><code>${escapeHtml(t.term)}</code> — ${escapeHtml(t.definition)}</li>`)
            .join('')}</ul>`,
        },
      ],
      practices: buildPractices(topic),
    })),
  }));
}

/** Exam pool: 2 questions per lesson topic × 5 types worth of variety. */
export function buildExamQuestions(): SeedQuestion[] {
  const topics = TOPICS.flatMap((m) => m.lessons);
  const out: SeedQuestion[] = [];
  topics.forEach((topic, ti) => {
    for (let k = 0; k < 3; k++) {
      const i = 100 + ti * 3 + k;
      out.push(buildQuestion(at(TYPE_CYCLE, ti * 3 + k), topic, i));
    }
  });
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DEFAULT_CERTIFICATE_HTML = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; margin: 0; color: #0f172a; }
  .wrap { box-sizing: border-box; width: 297mm; height: 210mm; padding: 24mm; border: 8mm solid #2563eb; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  h1 { font-size: 40pt; margin: 0 0 8mm; letter-spacing: 2pt; }
  .name { font-size: 30pt; font-weight: 700; margin: 6mm 0; }
  .course { font-size: 18pt; margin-bottom: 12mm; }
  .meta { font-size: 11pt; color: #475569; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>SERTIFIKAT</h1>
    <div>Ushbu sertifikat</div>
    <div class="name">{{fullName}}</div>
    <div class="course">«{{courseTitle}}» kursini muvaffaqiyatli tamomlaganini tasdiqlaydi.</div>
    <div class="meta">Berilgan sana: {{issuedAt}} · ID: {{certificateId}}</div>
    <div class="meta">Tekshirish: {{verifyUrl}}</div>
  </div>
</body>
</html>
`;

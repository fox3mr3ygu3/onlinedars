/**
 * Content for the demo seed (`pnpm db:seed:demo`): realistic courses, teachers, directions, FAQ
 * and student names so every page can be previewed with data. Pure data, no DB access.
 * Each lesson topic has exactly 6 terms (+3 wrong ones) so `buildPractices` yields 4 × 6.
 */
import type { LessonTopic } from './seed-data';

export interface DemoCourse {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  goals: string[];
  direction: string; // direction slug
  teachers: string[]; // teacher slugs
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  /** so'm; 0 = free */
  priceSom: number;
  status: 'PUBLISHED' | 'DRAFT' | 'HIDDEN';
  /** cover colour (hex without #) */
  color: string;
  modules: { title: string; description: string; lessons: LessonTopic[] }[];
}

export const DEMO_DIRECTIONS = [
  {
    slug: 'dasturlash',
    name: 'Dasturlash',
    icon: 'code',
    description: "Veb, mobil va backend dasturlash bo'yicha kurslar.",
  },
  { slug: 'dizayn', name: 'Dizayn', icon: 'palette', description: 'UI/UX va grafik dizayn.' },
  {
    slug: 'mobil',
    name: 'Mobil dasturlash',
    icon: 'smartphone',
    description: 'Android va iOS uchun ilovalar yaratish.',
  },
  {
    slug: 'malumotlar',
    name: "Ma'lumotlar tahlili",
    icon: 'database',
    description: "SQL, ma'lumotlar bazasi va tahlil.",
  },
  {
    slug: 'marketing',
    name: 'Raqamli marketing',
    icon: 'megaphone',
    description: 'SMM, kontent va reklama.',
  },
];

export const DEMO_TEACHERS = [
  {
    slug: 'dilnoza-rahimova',
    fullName: 'Dilnoza Rahimova',
    title: 'Python dasturchi',
    bio: "Ma'lumotlar bilan ishlovchi Python dasturchi, 6 yillik tajriba.",
  },
  {
    slug: 'jasur-tursunov',
    fullName: 'Jasur Tursunov',
    title: 'Senior frontend dasturchi',
    bio: "React va TypeScript bo'yicha mentor, yirik loyihalarda ishlagan.",
  },
  {
    slug: 'malika-yusupova',
    fullName: 'Malika Yusupova',
    title: 'UI/UX dizayner',
    bio: "Mobil va veb ilovalar uchun interfeys dizayneri, Figma bo'yicha mentor.",
  },
  {
    slug: 'bekzod-aliyev',
    fullName: 'Bekzod Aliyev',
    title: 'Mobil dasturchi',
    bio: 'Flutter va Kotlin bilan 20 dan ortiq ilova chiqargan.',
  },
  {
    slug: 'nodira-karimova',
    fullName: 'Nodira Karimova',
    title: 'Raqamli marketolog',
    bio: "SMM va kontent strategiyasi bo'yicha 7 yillik tajriba.",
  },
];

const t = (term: string, definition: string) => ({ term, definition });

export const DEMO_COURSES: DemoCourse[] = [
  {
    slug: 'python-asoslari',
    title: 'Python dasturlash asoslari',
    shortDescription: "Noldan Python: o'zgaruvchilar, shartlar, sikllar va funksiyalar.",
    description:
      "Python — eng ommabop dasturlash tillaridan biri. Kursda sintaksis, ma'lumot turlari, shart va sikllar, funksiyalar hamda ro'yxat va lug'atlar bilan amaliy ishlaysiz. Har bir darsdan keyin amaliyot, oxirida yakuniy imtihon va sertifikat.",
    goals: [
      'Python sintaksisini tushunish',
      'Shart va sikllar bilan ishlash',
      'Funksiyalar yozish',
      "Ro'yxat va lug'atlardan foydalanish",
    ],
    direction: 'dasturlash',
    teachers: ['dilnoza-rahimova'],
    level: 'BEGINNER',
    priceSom: 499_000,
    status: 'PUBLISHED',
    color: '2563eb',
    modules: [
      {
        title: 'Python bilan tanishuv',
        description: "Birinchi dastur va ma'lumot turlari.",
        lessons: [
          {
            title: "O'zgaruvchilar va ma'lumot turlari",
            summary: "int, float, str, bool va o'zgaruvchilar.",
            terms: [
              t('int', 'butun son turi'),
              t('float', 'kasr son turi'),
              t('str', 'matn (satr) turi'),
              t('bool', 'True yoki False qiymatli mantiqiy tur'),
              t('print()', 'ekranga chiqaruvchi funksiya'),
              t('input()', "foydalanuvchidan ma'lumot oluvchi funksiya"),
            ],
            fakeTerms: ['char', 'decimal32', 'echo()'],
          },
          {
            title: 'Shartlar va sikllar',
            summary: 'if/elif/else, for va while.',
            terms: [
              t('if', 'shart bajarilsa kodni ishlatuvchi operator'),
              t('elif', "oldingi shart noto'g'ri bo'lsa tekshiriladigan shart"),
              t('else', 'hech bir shart bajarilmaganda ishlaydigan blok'),
              t('for', "ketma-ketlik bo'ylab takrorlovchi sikl"),
              t('while', 'shart rost ekan takrorlanuvchi sikl'),
              t('break', "siklni darhol to'xtatuvchi operator"),
            ],
            fakeTerms: ['elseif', 'loop', 'stop'],
          },
        ],
      },
      {
        title: "Funksiyalar va to'plamlar",
        description: "Kodni qayta ishlatish va ma'lumotlarni saqlash.",
        lessons: [
          {
            title: "Funksiyalar, ro'yxat va lug'atlar",
            summary: 'def, return, list va dict.',
            terms: [
              t('def', "funksiya e'lon qiluvchi kalit so'z"),
              t('return', 'funksiyadan qiymat qaytaruvchi operator'),
              t('list', "tartiblangan, o'zgaruvchan to'plam"),
              t('dict', "kalit–qiymat juftliklaridan iborat to'plam"),
              t('len()', "to'plam uzunligini qaytaruvchi funksiya"),
              t('append()', "ro'yxat oxiriga element qo'shuvchi metod"),
            ],
            fakeTerms: ['func', 'array()', 'push()'],
          },
        ],
      },
    ],
  },
  {
    slug: 'javascript-zamonaviy',
    title: 'JavaScript: zamonaviy veb',
    shortDescription: 'ES6+, DOM, asinxron kod va fetch bilan interaktiv sahifalar.',
    description:
      "Kurs veb-sahifalarni jonlantirish uchun zarur bo'lgan zamonaviy JavaScriptni o'rgatadi: let/const, arrow funksiyalar, DOM bilan ishlash, hodisalar va asinxron so'rovlar.",
    goals: [
      'ES6+ sintaksisi',
      'DOM bilan ishlash',
      'Hodisalarni boshqarish',
      "fetch va async/await bilan so'rovlar",
    ],
    direction: 'dasturlash',
    teachers: ['jasur-tursunov'],
    level: 'INTERMEDIATE',
    priceSom: 599_000,
    status: 'PUBLISHED',
    color: 'ca8a04',
    modules: [
      {
        title: 'Til asoslari',
        description: 'Zamonaviy JavaScript sintaksisi.',
        lessons: [
          {
            title: 'ES6+ asoslari',
            summary: 'let, const, arrow funksiyalar va destrukturizatsiya.',
            terms: [
              t('let', "blok ichida o'zgaruvchi e'lon qilish"),
              t('const', "qayta tayinlanmaydigan o'zgaruvchi"),
              t('=>', 'arrow funksiya belgisi'),
              t('...', 'spread / rest operatori'),
              t('`${}`', 'shablon satr ichida ifoda'),
              t('?.', 'optional chaining operatori'),
            ],
            fakeTerms: ['var!', '->', '#{}'],
          },
          {
            title: 'DOM va hodisalar',
            summary: "Elementlarni topish, o'zgartirish va hodisalar.",
            terms: [
              t('querySelector', "CSS selektor bo'yicha birinchi elementni topadi"),
              t('addEventListener', "elementga hodisa tinglovchi qo'shadi"),
              t('textContent', 'element matni'),
              t('classList', 'element klasslari bilan ishlash'),
              t('preventDefault', "brauzerning standart amalini to'xtatadi"),
              t('createElement', 'yangi DOM element yaratadi'),
            ],
            fakeTerms: ['findElement', 'onEventAdd', 'innerTextual'],
          },
        ],
      },
      {
        title: 'Asinxron JavaScript',
        description: 'Server bilan ishlash.',
        lessons: [
          {
            title: 'fetch va async/await',
            summary: "Promise, async/await va HTTP so'rovlar.",
            terms: [
              t('Promise', 'kelajakdagi natijani ifodalovchi obyekt'),
              t('async', 'Promise qaytaruvchi funksiya belgisi'),
              t('await', 'Promise natijasini kutish'),
              t('fetch', "HTTP so'rov yuboruvchi funksiya"),
              t('JSON.parse', 'JSON satrni obyektga aylantiradi'),
              t('try/catch', 'xatoliklarni ushlash bloki'),
            ],
            fakeTerms: ['Future', 'waitFor', 'http.get()'],
          },
        ],
      },
    ],
  },
  {
    slug: 'react-amaliyot',
    title: 'React bilan SPA yaratish',
    shortDescription: 'Komponentlar, holat, hooklar va marshrutlash amaliyotda.',
    description:
      "Ilg'or kurs: React komponentlari, props va state, useEffect, kontekst va marshrutlash orqali to'liq bir sahifali ilova yaratasiz.",
    goals: [
      'Komponent arxitekturasi',
      'Hooklar bilan ishlash',
      "Ma'lumot olish va holatni boshqarish",
      'Marshrutlash',
    ],
    direction: 'dasturlash',
    teachers: ['jasur-tursunov'],
    level: 'ADVANCED',
    priceSom: 799_000,
    status: 'PUBLISHED',
    color: '0891b2',
    modules: [
      {
        title: 'React asoslari',
        description: 'Komponentlar va holat.',
        lessons: [
          {
            title: 'Komponentlar va props',
            summary: 'JSX, komponent va props.',
            terms: [
              t('JSX', "JavaScript ichida HTMLga o'xshash sintaksis"),
              t('props', "komponentga tashqaridan beriladigan ma'lumot"),
              t('key', "ro'yxat elementlarini ajratuvchi atribut"),
              t('children', 'komponent ichiga joylangan kontent'),
              t('Fragment', "qo'shimcha DOM elementisiz guruhlash"),
              t('className', 'JSXda CSS klass atributi'),
            ],
            fakeTerms: ['HTMLX', 'attrs', 'class='],
          },
          {
            title: 'Hooklar',
            summary: 'useState, useEffect va boshqalar.',
            terms: [
              t('useState', 'komponent holatini saqlovchi hook'),
              t('useEffect', "render'dan keyingi yon ta'sirlar uchun hook"),
              t('useMemo', 'hisoblangan qiymatni keshlovchi hook'),
              t('useRef', "render'lar orasida qiymat saqlovchi hook"),
              t('useContext', "kontekst qiymatini o'qiydigan hook"),
              t('useCallback', 'funksiyani keshlovchi hook'),
            ],
            fakeTerms: ['useData', 'useWatch', 'useStore'],
          },
        ],
      },
      {
        title: 'Ilova yaratish',
        description: 'Marshrutlar va server bilan ishlash.',
        lessons: [
          {
            title: "Marshrutlash va ma'lumot olish",
            summary: "Sahifalar orasida o'tish va API bilan ishlash.",
            terms: [
              t('Router', "URL bo'yicha sahifani tanlovchi komponent"),
              t('Link', "sahifani qayta yuklamasdan o'tish havolasi"),
              t('params', "URL ichidagi o'zgaruvchi qismlar"),
              t('loading', "ma'lumot yuklanayotgan holat"),
              t('error boundary', "xatolikni ushlab, zaxira UI ko'rsatuvchi komponent"),
              t('lazy', "komponentni kerak bo'lganda yuklash"),
            ],
            fakeTerms: ['Navigator', 'Anchor2', 'slugify'],
          },
        ],
      },
    ],
  },
  {
    slug: 'flutter-mobil',
    title: 'Flutter: mobil ilovalar',
    shortDescription: 'Bitta kod bilan Android va iOS ilovalar yarating.',
    description:
      "Dart tili asoslari, Flutter vidjetlari, sahifalar orasida o'tish va holatni boshqarishni o'rganib, birinchi mobil ilovangizni yaratasiz.",
    goals: ['Dart asoslari', 'Vidjetlar bilan interfeys', 'Navigatsiya', 'Holatni boshqarish'],
    direction: 'mobil',
    teachers: ['bekzod-aliyev'],
    level: 'INTERMEDIATE',
    priceSom: 699_000,
    status: 'PUBLISHED',
    color: '7c3aed',
    modules: [
      {
        title: 'Dart va Flutter',
        description: 'Til va vidjetlar.',
        lessons: [
          {
            title: 'Dart asoslari',
            summary: 'Turlar, funksiyalar va null xavfsizligi.',
            terms: [
              t('var', "turini o'zi aniqlaydigan o'zgaruvchi"),
              t('final', "bir marta tayinlanadigan o'zgaruvchi"),
              t('String?', "null bo'lishi mumkin bo'lgan satr turi"),
              t('List', "tartiblangan to'plam"),
              t('Map', "kalit–qiymat to'plami"),
              t('void', 'qiymat qaytarmaydigan funksiya turi'),
            ],
            fakeTerms: ['let', 'Array<>', 'nil'],
          },
          {
            title: 'Vidjetlar',
            summary: 'Stateless va Stateful vidjetlar, Layout.',
            terms: [
              t('StatelessWidget', 'holatsiz vidjet'),
              t('StatefulWidget', "o'zgaruvchan holatga ega vidjet"),
              t('Column', 'elementlarni vertikal joylashtiradi'),
              t('Row', 'elementlarni gorizontal joylashtiradi'),
              t('Padding', "ichki bo'sh joy qo'shadi"),
              t('setState', "holat o'zgarganini bildirib qayta chizadi"),
            ],
            fakeTerms: ['FlexBox', 'Margin', 'refresh()'],
          },
        ],
      },
      {
        title: 'Ilova tuzilishi',
        description: "Sahifalar va ma'lumotlar.",
        lessons: [
          {
            title: "Navigatsiya va ro'yxatlar",
            summary: 'Navigator, ListView va formalar.',
            terms: [
              t('Navigator.push', "yangi sahifaga o'tadi"),
              t('Navigator.pop', 'oldingi sahifaga qaytadi'),
              t('ListView', "aylantiriladigan ro'yxat"),
              t('Scaffold', 'sahifaning asosiy tuzilmasi'),
              t('TextField', 'matn kiritish maydoni'),
              t('FutureBuilder', "asinxron natija bo'yicha chizuvchi vidjet"),
            ],
            fakeTerms: ['Router.go', 'ScrollList', 'InputBox'],
          },
        ],
      },
    ],
  },
  {
    slug: 'sql-asoslari',
    title: "SQL va ma'lumotlar bazasi",
    shortDescription: "So'rovlar yozish, jadvallarni bog'lash va ma'lumotlarni tahlil qilish.",
    description:
      "Bepul kurs: relyatsion ma'lumotlar bazasi tushunchasi, SELECT so'rovlari, filtrlash, guruhlash va JOIN orqali bir nechta jadval bilan ishlash.",
    goals: [
      "SELECT so'rovlari",
      'Filtrlash va saralash',
      'Guruhlash',
      "JOIN bilan jadvallarni bog'lash",
    ],
    direction: 'malumotlar',
    teachers: ['dilnoza-rahimova'],
    level: 'BEGINNER',
    priceSom: 0,
    status: 'PUBLISHED',
    color: '059669',
    modules: [
      {
        title: "So'rovlar",
        description: "Ma'lumotlarni o'qish.",
        lessons: [
          {
            title: 'SELECT va filtrlash',
            summary: 'SELECT, WHERE, ORDER BY va LIMIT.',
            terms: [
              t('SELECT', "ustunlarni tanlab o'qish"),
              t('FROM', "so'rov qaysi jadvaldan ekanini bildiradi"),
              t('WHERE', "qatorlarni shart bo'yicha filtrlash"),
              t('ORDER BY', 'natijani saralash'),
              t('LIMIT', 'qatorlar sonini cheklash'),
              t('DISTINCT', 'takroriy qiymatlarni olib tashlash'),
            ],
            fakeTerms: ['PICK', 'FILTER BY', 'TOP ALL'],
          },
          {
            title: 'Guruhlash va agregatlar',
            summary: 'COUNT, SUM, AVG va GROUP BY.',
            terms: [
              t('COUNT', 'qatorlar sonini hisoblaydi'),
              t('SUM', "qiymatlar yig'indisi"),
              t('AVG', "o'rtacha qiymat"),
              t('GROUP BY', 'qatorlarni guruhlarga ajratadi'),
              t('HAVING', "guruhlarni shart bo'yicha filtrlash"),
              t('MAX', 'eng katta qiymat'),
            ],
            fakeTerms: ['TOTAL', 'MEAN', 'SPLIT BY'],
          },
        ],
      },
      {
        title: "Jadvallarni bog'lash",
        description: 'JOIN turlari.',
        lessons: [
          {
            title: 'JOIN',
            summary: 'INNER, LEFT JOIN va kalitlar.',
            terms: [
              t('INNER JOIN', 'ikkala jadvalda mos kelgan qatorlar'),
              t('LEFT JOIN', 'chap jadvalning barcha qatorlari'),
              t('PRIMARY KEY', 'qatorni yagona aniqlovchi ustun'),
              t('FOREIGN KEY', 'boshqa jadvalga havola qiluvchi ustun'),
              t('ON', "bog'lanish sharti"),
              t('AS', 'ustun yoki jadvalga taxallus berish'),
            ],
            fakeTerms: ['MERGE ALL', 'LINK KEY', 'WITH ON'],
          },
        ],
      },
    ],
  },
  {
    slug: 'figma-ui-ux',
    title: 'Figma: UI/UX dizayn asoslari',
    shortDescription: "Foydalanuvchiga qulay interfeyslarni Figma'da loyihalash.",
    description:
      'UX tadqiqoti, wireframe, komponentlar va auto layout yordamida mobil ilova interfeysini noldan loyihalaysiz va prototip qilasiz.',
    goals: [
      'UX jarayonini tushunish',
      'Figma asboblari',
      'Komponentlar va auto layout',
      'Prototip yaratish',
    ],
    direction: 'dizayn',
    teachers: ['malika-yusupova'],
    level: 'BEGINNER',
    priceSom: 449_000,
    status: 'PUBLISHED',
    color: 'db2777',
    modules: [
      {
        title: 'UX asoslari',
        description: 'Foydalanuvchini tushunish.',
        lessons: [
          {
            title: 'UX jarayoni',
            summary: "Tadqiqot, persona va foydalanuvchi yo'li.",
            terms: [
              t('persona', 'maqsadli foydalanuvchining umumlashgan obrazi'),
              t('user flow', "foydalanuvchining maqsadga yetish yo'li"),
              t('wireframe', 'interfeysning soddalashtirilgan sxemasi'),
              t('usability test', 'foydalanuvchilar bilan qulaylikni sinash'),
              t('MVP', 'eng kichik ishlaydigan mahsulot'),
              t('pain point', 'foydalanuvchi duch keladigan muammo'),
            ],
            fakeTerms: ['UI sprint', 'mockflow', 'joy point'],
          },
          {
            title: 'Figma asboblari',
            summary: 'Frame, komponent va auto layout.',
            terms: [
              t('Frame', 'ekran yoki blok konteyneri'),
              t('Component', 'qayta ishlatiladigan element'),
              t('Variant', "komponentning holat ko'rinishi"),
              t('Auto layout', 'elementlarni avtomatik joylashtirish'),
              t('Constraints', "o'lcham o'zgarganda joylashuv qoidalari"),
              t('Styles', "rang va matn uslublari to'plami"),
            ],
            fakeTerms: ['Artboard+', 'Symbol set', 'Grid lock'],
          },
        ],
      },
      {
        title: 'Prototip',
        description: 'Interaktiv prototip.',
        lessons: [
          {
            title: 'Prototip va topshirish',
            summary: "Interaktiv o'tishlar va dasturchiga topshirish.",
            terms: [
              t('Prototype', "interaktiv ko'rinish"),
              t('Interaction', "bosish yoki o'tish harakati"),
              t('Smart animate', "o'xshash qatlamlar orasida animatsiya"),
              t('Dev mode', "dasturchilar uchun o'lcham va kod ko'rinishi"),
              t('Export', 'rasm yoki SVG sifatida saqlash'),
              t('Comment', 'jamoa bilan izoh qoldirish'),
            ],
            fakeTerms: ['Play mode', 'Morph link', 'Handoff+'],
          },
        ],
      },
    ],
  },
  {
    slug: 'smm-marketing',
    title: 'SMM va raqamli marketing',
    shortDescription: 'Ijtimoiy tarmoqlarda brendni rivojlantirish va reklama.',
    description:
      "Kontent reja tuzish, auditoriyani aniqlash, Instagram va Telegram uchun post tayyorlash hamda reklama natijalarini o'lchashni o'rganasiz.",
    goals: ['Auditoriyani aniqlash', 'Kontent reja', 'Reklama sozlash', "Natijalarni o'lchash"],
    direction: 'marketing',
    teachers: ['nodira-karimova'],
    level: 'BEGINNER',
    priceSom: 399_000,
    status: 'PUBLISHED',
    color: 'ea580c',
    modules: [
      {
        title: 'Strategiya',
        description: 'Auditoriya va kontent.',
        lessons: [
          {
            title: 'Auditoriya va kontent reja',
            summary: 'Maqsadli auditoriya, kontent turlari va reja.',
            terms: [
              t('target auditoriya', "mahsulot mo'ljallangan odamlar guruhi"),
              t('kontent reja', 'postlar jadvali'),
              t('tone of voice', 'brendning muloqot uslubi'),
              t('UGC', 'foydalanuvchilar yaratgan kontent'),
              t('hashtag', "postni mavzu bo'yicha guruhlovchi belgi"),
              t('engagement', 'auditoriyaning faollik darajasi'),
            ],
            fakeTerms: ['mass-feed', 'brand echo', 'reach box'],
          },
          {
            title: 'Reklama',
            summary: 'Reklama kampaniyasi va byudjet.',
            terms: [
              t('CPC', 'bir marta bosish narxi'),
              t('CPM', "ming marta ko'rsatish narxi"),
              t('CTR', "ko'rishlarga nisbatan bosishlar ulushi"),
              t('retargeting', 'saytga kirganlarga qayta reklama'),
              t('lead', 'potentsial mijoz kontakti'),
              t('A/B test', 'ikki variantni solishtirish'),
            ],
            fakeTerms: ['CPX', 'LTV-box', 'reboost'],
          },
        ],
      },
      {
        title: 'Tahlil',
        description: "Natijalarni o'lchash.",
        lessons: [
          {
            title: 'Metrikalar va hisobot',
            summary: "Asosiy ko'rsatkichlar va hisobot.",
            terms: [
              t('reach', "post ko'rgan noyob foydalanuvchilar"),
              t('impressions', "jami ko'rsatishlar soni"),
              t('conversion', 'maqsadli harakatga aylanish'),
              t('ROI', 'investitsiya qaytimi'),
              t('UTM', 'havolaga manbani bildiruvchi teglar'),
              t('dashboard', "ko'rsatkichlar paneli"),
            ],
            fakeTerms: ['viewcount+', 'ROX', 'trackmark'],
          },
        ],
      },
    ],
  },
  {
    slug: 'git-github',
    title: 'Git va GitHub',
    shortDescription: 'Kod versiyalarini boshqarish va jamoada ishlash.',
    description:
      "Bepul kurs: Git buyruqlari, tarmoqlar (branch), birlashtirish va GitHub'da pull request orqali jamoaviy ish.",
    goals: [
      'Git asosiy buyruqlari',
      'Branch bilan ishlash',
      'Konfliktlarni hal qilish',
      'Pull request',
    ],
    direction: 'dasturlash',
    teachers: ['aziz-karimov'],
    level: 'BEGINNER',
    priceSom: 0,
    status: 'PUBLISHED',
    color: '334155',
    modules: [
      {
        title: 'Git asoslari',
        description: 'Repozitoriy va commitlar.',
        lessons: [
          {
            title: 'Commit va tarix',
            summary: 'init, add, commit, log.',
            terms: [
              t('git init', 'yangi repozitoriy yaratadi'),
              t('git add', "o'zgarishlarni commitga tayyorlaydi"),
              t('git commit', "o'zgarishlarni tarixga saqlaydi"),
              t('git log', "commitlar tarixini ko'rsatadi"),
              t('git status', "joriy holatni ko'rsatadi"),
              t('.gitignore', "kuzatilmaydigan fayllar ro'yxati"),
            ],
            fakeTerms: ['git save', 'git history', '.gitskip'],
          },
          {
            title: 'Branch va merge',
            summary: 'Tarmoqlar, birlashtirish va konfliktlar.',
            terms: [
              t('git branch', "tarmoqlarni ko'rsatadi yoki yaratadi"),
              t('git switch', "boshqa tarmoqqa o'tadi"),
              t('git merge', 'tarmoqlarni birlashtiradi'),
              t('conflict', "bir qatordagi qarama-qarshi o'zgarishlar"),
              t('HEAD', "joriy commitga ko'rsatkich"),
              t('git rebase', "commitlarni boshqa asosga ko'chiradi"),
            ],
            fakeTerms: ['git fork', 'git join', 'TOP'],
          },
        ],
      },
      {
        title: 'GitHub',
        description: 'Jamoaviy ish.',
        lessons: [
          {
            title: 'Pull request va jamoa',
            summary: 'push, pull, PR va code review.',
            terms: [
              t('git push', 'commitlarni serverga yuboradi'),
              t('git pull', "serverdagi o'zgarishlarni oladi"),
              t('pull request', "o'zgarishni ko'rib chiqishga taklif"),
              t('code review', 'kodni hamkasblar tekshirishi'),
              t('fork', "boshqa repozitoriyning o'z nusxasi"),
              t('remote', 'tashqi repozitoriy manzili'),
            ],
            fakeTerms: ['git upload', 'merge ask', 'mirror pull'],
          },
        ],
      },
    ],
  },
  {
    slug: 'docker-asoslari',
    title: 'Docker asoslari (tayyorlanmoqda)',
    shortDescription: 'Ilovalarni konteynerlarda ishga tushirish.',
    description: "Qoralama kurs: hali nashr qilinmagan, faqat admin panelda ko'rinadi.",
    goals: ['Image va container', 'Dockerfile', 'docker compose'],
    direction: 'dasturlash',
    teachers: ['aziz-karimov'],
    level: 'INTERMEDIATE',
    priceSom: 549_000,
    status: 'DRAFT',
    color: '1d4ed8',
    modules: [
      {
        title: 'Konteynerlar',
        description: 'Asosiy tushunchalar.',
        lessons: [
          {
            title: 'Image va container',
            summary: 'Docker asosiy tushunchalari.',
            terms: [
              t('image', 'ilova va muhitning shabloni'),
              t('container', 'image asosida ishlayotgan nusxa'),
              t('Dockerfile', "image qurish yo'riqnomasi"),
              t('volume', "konteynerdan tashqarida saqlanadigan ma'lumot"),
              t('port', 'tashqi va ichki portlarni ulash'),
              t('docker compose', 'bir nechta konteynerni birga boshqarish'),
            ],
            fakeTerms: ['boxfile', 'pod-run', 'imagefile'],
          },
        ],
      },
    ],
  },
  {
    slug: 'jquery-eski',
    title: 'jQuery (eski kurs)',
    shortDescription: 'Arxivlangan kurs: katalogda yashirilgan.',
    description:
      "Yashirilgan kurs: katalogda ko'rinmaydi, lekin unga yozilgan talabalar o'qishda davom etadi.",
    goals: ['Selektorlar', 'Hodisalar', 'AJAX'],
    direction: 'dasturlash',
    teachers: ['jasur-tursunov'],
    level: 'BEGINNER',
    priceSom: 99_000,
    status: 'HIDDEN',
    color: '64748b',
    modules: [
      {
        title: 'jQuery',
        description: 'Asoslar.',
        lessons: [
          {
            title: 'Selektorlar va hodisalar',
            summary: '$, on, ajax.',
            terms: [
              t('$()', 'elementlarni tanlovchi funksiya'),
              t('.on()', "hodisa tinglovchi qo'shadi"),
              t('.addClass()', "klass qo'shadi"),
              t('.ajax()', "server so'rovi"),
              t('.hide()', 'elementni yashiradi'),
              t('.each()', "to'plam bo'ylab aylanadi"),
            ],
            fakeTerms: ['$$find', '.listen()', '.fetchx()'],
          },
        ],
      },
    ],
  },
];

export const DEMO_FAQ = [
  {
    question: "To'lovni qaytarib olsa bo'ladimi?",
    answer: "Ha, xariddan keyin 14 kun ichida murojaat qilsangiz, to'lov qaytariladi.",
  },
  {
    question: 'Kursga qancha vaqt kirish mumkin?',
    answer: 'Sotib olingan kursga muddatsiz kirish beriladi.',
  },
  {
    question: "Darslarni telefonda ko'rsa bo'ladimi?",
    answer: 'Ha, platforma telefon, planshet va kompyuterda ishlaydi.',
  },
  {
    question: "Imtihondan o'ta olmasam nima bo'ladi?",
    answer: 'Imtihonni belgilangan urinishlar soni doirasida qayta topshirishingiz mumkin.',
  },
];

const FIRST = [
  'Aziza',
  'Bobur',
  'Dilshod',
  'Feruza',
  'Gulnora',
  'Islom',
  'Jahongir',
  'Kamola',
  'Laziz',
  'Madina',
  'Nodir',
  'Ozoda',
  'Rustam',
  'Sardor',
  'Shahzoda',
  'Temur',
  'Umida',
  'Vohid',
  'Xurshida',
  'Yusuf',
  'Zarina',
  'Akmal',
  'Barno',
  'Doniyor',
  'Elyor',
  'Farrux',
  'Hilola',
  'Iroda',
  'Javlon',
  'Komil',
];
const LAST = [
  'Abdullayev',
  'Karimova',
  'Rahimov',
  'Tursunova',
  'Yusupov',
  'Aliyeva',
  'Nazarov',
  'Sobirova',
  'Qodirov',
  'Ergasheva',
];

/** 30 demo students with stable emails/phones (demo01…demo30). */
export const DEMO_STUDENTS = FIRST.map((first, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    email: `talaba${n}@demo.onlinedars.uz`,
    phone: `+99890${String(1000000 + i * 7919).slice(-7)}`,
    fullName: `${first} ${LAST[i % LAST.length]}`,
  };
});

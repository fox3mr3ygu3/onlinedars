# OnlineDars — Admin panel bo'yicha qo'llanma

Bu qo'llanma OnlineDars admin panelida ishlash tartibini tushuntiradi: kurs yaratish, darslar va
amaliyotlarni to'ldirish, imtihonni sozlash, talabalarga kursga kirish berish va natijalarni kuzatish.

---

## 1. Tizimga kirish

1. Sayt manziliga kiring va o'ng yuqoridagi **Kirish** tugmasini bosing (yoki `/login` sahifasini oching).
2. Email (yoki telefon raqam) va parolni kiriting, **Kirish** tugmasini bosing.
3. Admin panel manzili: `/admin`.

Test akkauntlari (faqat sinov uchun):

| Rol             | Login                   | Parol         |
| --------------- | ----------------------- | ------------- |
| Administrator   | `admin@onlinedars.uz`   | `Parol12345!` |
| Kontent menejer | `content@onlinedars.uz` | `Parol12345!` |

> Haqiqiy foydalanuvchilarga ochishdan oldin bu parollarni albatta o'zgartiring.

---

## 2. Rollar: kim nimani qila oladi

| Bo'lim                                              | Administrator | Kontent menejer |
| --------------------------------------------------- | :-----------: | :-------------: |
| Bosh sahifa                                         |      ✅       |       ✅        |
| Kurslar, modullar, darslar, amaliyotlar, savollar   |      ✅       |       ✅        |
| Imtihonlar                                          |      ✅       |       ✅        |
| Sertifikat shablonlari                              |      ✅       |       ✅        |
| Yo'nalishlar, O'qituvchilar, Savol-javob            |      ✅       |       ✅        |
| **Kirish so'rovlari**                               |      ✅       |       ❌        |
| **Talabalar** (kursga kirish berish / bekor qilish) |      ✅       |       ❌        |
| **Hisobotlar**                                      |      ✅       |       ❌        |
| **Sozlamalar**                                      |      ✅       |       ❌        |
| **Audit jurnali**                                   |      ✅       |       ❌        |

Kontent menejer faqat o'quv kontentini tayyorlaydi. Talabalarga kursga kirish berish faqat
**Administrator** qo'lida.

---

## 3. Bosh sahifa

**Bosh sahifa**da platformaning umumiy holati ko'rinadi:

- Talabalar soni, faol kurslar, tugatilgan darslar;
- Topshirilgan va muvaffaqiyatli imtihonlar, o'tish darajasi;
- Berilgan sertifikatlar;
- **Kutilayotgan so'rovlar** — javob kutayotgan kirish so'rovlari soni;
- **So'nggi imtihon natijalari** va **Tezkor havolalar** (masalan, **Yangi kurs**).

---

## 4. Kurs tuzilmasi — eng muhim qoida

Kurs quyidagi tartibda quriladi:

```
Kurs → Modul → Dars → Amaliyot → Savol
```

**Har bir darsda aynan 4 ta amaliyot, har bir amaliyotda aynan 6 ta savol bo'lishi shart
(bir darsda jami 24 ta savol).** Bu to'liq bo'lmaguncha dars ham, kurs ham nashr qilinmaydi.
Panelda hisoblagichlar ko'rinib turadi: `Amaliyotlar 3/4`, `Savollar 5/6`, `Darsdagi savollar: 20/24`.

Tavsiya etilgan ish tartibi:

1. Kerak bo'lsa avval **Yo'nalish** va **O'qituvchi** qo'shing (5-bo'lim).
2. Kurs yarating (6-bo'lim).
3. Modullar va darslarni qo'shing (7-bo'lim).
4. Har bir darsga material, 4 ta amaliyot va 24 ta savol kiriting (8–9-bo'limlar).
5. Darslarni nashr qiling.
6. Yakuniy imtihonni sozlang (10-bo'lim).
7. Kursni nashr qiling.
8. Talabalarga kursga kirish bering (12–13-bo'limlar).

---

## 5. Yo'nalishlar, O'qituvchilar, Savol-javob

Bu bo'limlar ochiq saytda (katalog, o'qituvchilar sahifasi, FAQ) ko'rinadigan ma'lumotlarni boshqaradi.

- **Yo'nalishlar** → **Yangi yo'nalish**: Nomi, URL nomi (slug), Tavsif, Belgi, Tartib raqami, Faol.
- **O'qituvchilar** → **Yangi o'qituvchi**: F.I.Sh., URL nomi, Lavozimi, Biografiya, Rasm,
  Tartib raqami, Faol.
- **Savol-javob** → **Yangi savol**: Savol, Javob, Tartib raqami, Faol.

**Tartib raqami** saytdagi ko'rinish tartibini belgilaydi (kichik raqam — yuqorida).
**Faol** belgisi olib tashlansa, yozuv saytda ko'rinmaydi, lekin o'chirilmaydi.

**URL nomi (slug)** — faqat kichik lotin harflari, raqamlar va chiziqcha. Masalan: `python-asoslari`.

---

## 6. Kurs yaratish

1. **Kurslar** → **Yangi kurs**.
2. Maydonlarni to'ldiring:
   - **Nomi**, **URL nomi (slug)**;
   - **Qisqa tavsif** (katalog kartochkasida) va **To'liq tavsif** (kurs sahifasida);
   - **Kurs maqsadlari** — har bir qatorga bitta maqsad;
   - **Muqova rasmi**, **Daraja** (Boshlang'ich / O'rta / Yuqori);
   - **Yo'nalish**, **O'qituvchilar**;
   - **Tanishtiruv videosi** — YouTube yoki Vimeo havolasi, kurs sahifasida hamma uchun ko'rinadi;
   - **Sertifikat shabloni** (bo'sh qoldirilsa — Standart shablon);
   - **Darslarni ketma-ket ochish** — yoqilsa, talaba keyingi darsni faqat oldingisini tugatgandan
     keyin ocha oladi.
3. Saqlang. Yangi kurs **Qoralama** holatida bo'ladi va saytda ko'rinmaydi.

Kurs sahifasida uchta yorliq bor: **Asosiy**, **Dastur (modullar va darslar)**, **Yakuniy imtihon**.

> Kurslarning narxi yo'q. Talabalar kursni sotib olmaydi va o'zi yozila olmaydi — kirishni faqat
> Administrator beradi.

---

## 7. Modullar va darslar

1. Kurs ichida **Dastur (modullar va darslar)** yorlig'ini oching.
2. **Modul qo'shish** → Modul nomi va Tavsif → saqlang.
3. Modul ichida **Dars qo'shish**:
   - **Dars nomi**, **Qisqa mazmuni**, **Davomiyligi (daqiqa)**;
   - **Majburiy dars** — imtihon ochilishi uchun talaba bu darsni tugatishi shart;
   - **Bepul ko'rish** — kursga kirishi bo'lmaganlar ham dars materiallarini ko'ra oladi.
4. Tartibni o'zgartirish uchun modul va darslarni sichqoncha bilan suring yoki ↑ / ↓ tugmalarini bosing.
5. **Darsni ochish** — dars tahrirlash sahifasiga o'tadi.

> Modul o'chirilsa, undagi barcha darslar ham o'chadi.

### Dars materiallari

Dars sahifasida **Material qo'shish** tugmasi orqali qo'shiladi:

| Turi  | Nima kiritiladi                               |
| ----- | --------------------------------------------- |
| Matn  | Formatlangan matn                             |
| Rasm  | Rasm fayli                                    |
| Fayl  | Yuklab olinadigan fayl (PDF va boshqalar)     |
| Video | YouTube, Vimeo yoki to'g'ridan-to'g'ri havola |

---

## 8. Amaliyotlar

1. Dars sahifasida **Amaliyotlar** havolasini bosing.
2. **Amaliyot qo'shish**: Amaliyot nomi, Tavsif, **Majburiy amaliyot**, **O'tish bali (%)**.
   - O'tish bali `0` bo'lsa, har qanday topshirish hisoblanadi.
3. 4 ta amaliyot bo'lgach, yangi qo'shib bo'lmaydi ("chegaraga yetildi").
4. Har bir amaliyotda **Savollarni tahrirlash** orqali 6 ta savol kiriting.

Sahifa pastida holat ko'rinadi: **Dars to'liq: nashr qilish mumkin** yoki **Dars hali to'liq emas**.

---

## 9. Savollar

**Savol qo'shish** → **Savol turi**ni tanlang:

| Tur                        | Qanday to'ldiriladi                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Variantli savol**        | Variantlarni kiriting, to'g'risini belgilang. Bir nechta to'g'ri javob bo'lsa — **Bir nechta to'g'ri javob**ni yoqing.                     |
| **To'g'ri / Noto'g'ri**    | To'g'ri javobni tanlang.                                                                                                                   |
| **Moslashtirish**          | Chap va o'ng tomon juftliklarini kiriting (**Juftlik qo'shish**). Talabaga o'ng tomon aralashtirib ko'rsatiladi.                           |
| **Bo'sh joyni to'ldirish** | Savol matnida bo'sh joylarni `{{0}}`, `{{1}}` … deb belgilang. Har bir bo'sh joy uchun bir yoki bir nechta qabul qilinadigan javob yozing. |
| **Rasmli savol**           | Savol rasmi majburiy, keyin variantlar va to'g'ri javob.                                                                                   |

Har bir savolda yana:

- **Ball** — savol bahosi;
- **Izoh** — talaba javob bergandan keyin ko'rsatiladi.

Misol (Bo'sh joyni to'ldirish): `O'zbekiston poytaxti — {{0}}.` → `{{0}}` uchun javob: `Toshkent`.

> To'g'ri javoblar talabaga savolni topshirgunga qadar hech qachon yuborilmaydi; baholash serverda.

### Darsni nashr qilish

24 ta savol to'liq bo'lgach, dars sahifasida **Darsni nashr qilish** tugmasini bosing.
Darsni yashirish uchun — **Nashrdan olish**.

---

## 10. Yakuniy imtihon

1. **Imtihonlar** bo'limida kursni tanlab **Sozlash**ni bosing (yoki kursning **Yakuniy imtihon**
   yorlig'i).
2. Sozlamalar:
   - **Imtihon nomi**;
   - **Savollar soni (har bir urinishda)**;
   - **Vaqt chegarasi (daqiqa)**;
   - **O'tish bali (%)**;
   - **Urinishlar soni** — bo'sh qoldirilsa, cheklanmagan;
   - **Savollarni aralashtirish**;
   - **Imtihon faol**.
3. Saqlagandan keyin pastda **Imtihon savollar bazasi** paydo bo'ladi. Bu yerga imtihon savollarini
   qo'shing (turlari 9-bo'limdagidek).
4. Bazadagi savollar soni **urinishdagi savollar sonidan kam bo'lmasligi** kerak, aks holda
   ogohlantirish chiqadi.
5. **Savollarni aralashtirish** yoqilgan bo'lsa, har bir urinishda bazadan tasodifiy savollar
   tasodifiy tartibda tanlanadi. O'chirilgan bo'lsa, bazadagi birinchi savollar shu tartibda beriladi.

Imtihon talabaga barcha **majburiy** darslar tugagandan keyin ochiladi. Baholash avtomatik.
Imtihondan o'tgan talabaga **PDF sertifikat avtomatik beriladi**.

---

## 11. Sertifikat shablonlari

1. **Sertifikat shablonlari** → **Yangi shablon**.
2. **Shablon nomi**, **HTML shablon**, **Fon rasmi**, kerak bo'lsa **Standart shablon**.
3. HTML ichida quyidagi o'zgaruvchilardan foydalaning (ustiga bosib nusxa olish mumkin):

| O'zgaruvchi              | Ma'nosi                              |
| ------------------------ | ------------------------------------ |
| `{{fullName}}`           | Talabaning F.I.Sh.                   |
| `{{courseTitle}}`        | Kurs nomi                            |
| `{{issueDate}}`          | Berilgan sana                        |
| `{{certificateId}}`      | Sertifikatning noyob ID raqami       |
| `{{verifyUrl}}`          | Tekshirish havolasi (`/verify/{ID}`) |
| `{{backgroundImageUrl}}` | Fon rasmi manzili                    |

4. O'ngdagi **Jonli ko'rinish**da natijani darhol ko'rasiz. Majburiy o'zgaruvchi tushib qolsa,
   ogohlantirish chiqadi.
5. Shablonni kursga 6-bo'limdagi **Sertifikat shabloni** maydoni orqali biriktiring.

Har qanday odam sertifikat haqiqiyligini saytdagi `/verify/{sertifikat ID}` sahifasida tekshira oladi.

---

## 12. Kursni nashr qilish

Kurs sahifasidagi **Kurs holati** blokida:

| Tugma                    | Natija                                                     |
| ------------------------ | ---------------------------------------------------------- |
| **Nashr qilish**         | Kurs katalogda ko'rinadi, talabalar kirish so'rashi mumkin |
| **Yashirish**            | Kurs katalogdan yashiriladi                                |
| **Arxivlash**            | Kurs arxivga o'tadi                                        |
| **Qoralamaga qaytarish** | Kurs yana tahrirlash holatiga qaytadi                      |

Nashr qilish uchun barcha darslar 4 ta amaliyot × 6 ta savol bilan to'liq bo'lishi kerak.

---

## 13. Kirish so'rovlari (faqat Administrator)

Talaba kurs sahifasida kursga kirish so'raydi. So'rovlar **Kirish so'rovlari** bo'limiga tushadi.

1. Ro'yxatni holat (**Kutilmoqda**, **Tasdiqlangan**, **Rad etilgan**, **Kirish bekor qilingan**),
   kurs yoki talaba bo'yicha filtrlang.
2. **Tasdiqlash** — kurs darhol talaba kabinetida ochiladi.
3. **Rad etish** — **Sabab** yozish majburiy (kamida 3 ta belgi). Sababni talaba ko'radi.
   Masalan: "Guruh to'lgan, keyingi oqimda qayta so'rang".

Har bir qaror haqida talabaga bildirishnoma boradi va qaror **Audit jurnali**ga yoziladi.

---

## 14. Talabalar (faqat Administrator)

1. **Talabalar** bo'limida ism, telefon yoki email bo'yicha qidiring.
2. Talabani ochsangiz: profil, **Kurslarga kirish**, **O'zlashtirish**, **Natijalar**,
   **Sertifikatlar** ko'rinadi.
3. **Kursga kirish berish** — **Kursni tanlang** → tasdiqlang. So'rovsiz to'g'ridan-to'g'ri kirish
   beriladi.
4. **Kirishni bekor qilish** — talaba kursga kira olmay qoladi (tasdiqlash so'raladi).

Kirish manbai ko'rsatiladi: **Administrator** (qo'lda berilgan) yoki **So'rov orqali**.

---

## 15. Hisobotlar (faqat Administrator)

- **Kurslar bo'yicha** — yozilganlar, tugatganlar, tugatish darajasi;
- **Imtihonlar bo'yicha** — urinishlar, o'tganlar, o'rtacha ball;
- **Faollik** — kunlar bo'yicha yangi talabalar, kursga yozilishlar, tugatilgan darslar,
  amaliyot va imtihon urinishlari.

---

## 16. Sozlamalar (faqat Administrator)

- **Platforma nomi**;
- **Qo'llab-quvvatlash telefoni**, **emaili**, **Telegram havolasi**;
- **Sertifikatni tekshirish manzili** — sertifikatdagi tekshirish havolasining asosiy URL manzili
  (masalan, `https://onlinedars.uz`);
- **Texnik ishlar rejimi** — sayt vaqtincha texnik ishlar olib borilayotganini bildiradi;
- **Boshqa sozlamalar** — qo'shimcha sozlamalar JSON ko'rinishida (faqat nima qilayotganingizni
  bilsangiz o'zgartiring).

---

## 17. Audit jurnali (faqat Administrator)

Tizimdagi muhim amallar yoziladi: kim (**Kim**), qachon (**Vaqt**), nima qildi (**Amal**),
qaysi obyektda (**Obyekt**), sabab va IP manzil. Har bir yozuvda o'zgarishdan **Oldin** va
**Keyin**gi qiymatlar ko'rinadi.

Ro'yxatni **Amal bo'yicha** va **Obyekt turi bo'yicha** filtrlash mumkin. Masalan, kursga kirish
berish, bekor qilish, so'rovni tasdiqlash va rad etish shu yerda ko'rinadi.

---

## 18. Tez-tez uchraydigan holatlar

| Muammo                                               | Sabab va yechim                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Nashr qilish** tugmasi ishlamaydi                  | Qaysidir darsda 4 ta amaliyot yoki 6 ta savol yetishmaydi. Hisoblagichlarni tekshiring. |
| **Amaliyot qo'shish** / **Savol qo'shish** bo'lmaydi | Chegara to'lgan (4 ta / 6 ta). Ortiqchasini o'chirib, keyin qo'shing.                   |
| Talaba kursni ko'rmayapti                            | Kurs nashr qilinmagan yoki talabaga kirish berilmagan.                                  |
| Talabada imtihon ochilmayapti                        | Barcha majburiy darslar tugallanmagan, yoki imtihon **faol** emas.                      |
| Imtihonda ogohlantirish chiqyapti                    | Bazadagi savollar urinishdagi savollar sonidan kam — savol qo'shing.                    |
| Kontent menejer "Talabalar" bo'limini ko'rmayapti    | Bu to'g'ri: bu bo'lim faqat Administrator uchun.                                        |

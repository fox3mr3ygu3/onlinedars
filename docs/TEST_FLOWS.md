# OnlineDars — test ssenariylari (testerlar uchun)

Bu hujjat platformadagi har bir asosiy oqimni (flow) qadamma-qadam tasvirlaydi: **qaysi tugma bosiladi → nima bo'lishi kerak**. Kutilgan natijadan farq qilgan har qanday holatni xato (bug) sifatida qayd eting: sahifa manzili, qadam raqami, skrinshot.

## 1. Kirish ma'lumotlari

**Sayt manzili:**

- Lokal: `http://localhost:3000`
- Demo (vaqtinchalik havola, kompyuter yoqiq bo'lgandagina ishlaydi): `https://carriers-gabriel-europe-ben.trycloudflare.com` — havola har safar qayta ishga tushirilganda o'zgaradi, yangisini dasturchidan so'rang.

**Loginlar (barchasi uchun parol: `Parol12345!`)** — faqat demo ma'lumotlar, haqiqiy foydalanuvchilar emas:

| Tomon (rol)           | Login                                               | Qayerga tushadi | Nimani tekshirish uchun                                             |
| --------------------- | --------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| Administrator         | `admin@onlinedars.uz`                               | `/admin`        | Butun boshqaruv paneli: to'lovlar, hisobotlar, sozlamalar, audit    |
| Kontent menejer       | `content@onlinedars.uz`                             | `/admin`        | Faqat kontent: kurslar, darslar, savollar (to'lov va sozlamalarsiz) |
| Talaba (yangi)        | `student@onlinedars.uz` (yoki tel. `+998901234567`) | `/cabinet`      | Noldan o'qish: 1 ta bepul kursga yozilgan, progress yo'q            |
| Talaba (o'qiyapti)    | `talaba01@demo.onlinedars.uz`                       | `/cabinet`      | 3 ta kurs, turli bosqichlarda                                       |
| Talaba (sertifikatli) | `talaba03@demo.onlinedars.uz`                       | `/cabinet`      | Tugatilgan kurs, imtihon natijasi, sertifikat                       |
| Boshqa talabalar      | `talaba01` … `talaba30@demo.onlinedars.uz`          | `/cabinet`      | Turli holatlar: boshlanmagan, yarmida, imtihondan yiqilgan, o'tgan  |
| Mehmon (kirmagan)     | —                                                   | `/`             | Ochiq sahifalar, bepul ko'rish darsi, sertifikatni tekshirish       |

Tekshirish uchun tayyor sertifikat ID: **`OD-0XB2-RQBD-E3PN`** (Dilshod Rahimov, «Figma: UI/UX dizayn asoslari»).

Hisobni almashtirishdan oldin yuqori o'ng burchakdagi **Chiqish** tugmasini bosing.

---

## 2. Umumiy (barcha sahifalar)

| #   | Harakat                                                                | Kutilgan natija                                                                                                   |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2.1 | Yuqori menyu: **Kurslar / Yo'nalishlar / O'qituvchilar / Savol-javob** | Tegishli sahifa ochiladi.                                                                                         |
| 2.2 | Telefon o'lchamida (375 px) **Menyuni ochish** (☰)                    | Yon menyu ochiladi; bandni bossangiz sahifa ochiladi va menyu yopiladi. Gorizontal aylantirish bo'lmasligi kerak. |
| 2.3 | Kirmagan holda: **Kirish** / **Ro'yxatdan o'tish**                     | `/login` yoki `/register` ochiladi.                                                                               |
| 2.4 | Kirgan talaba: **Kabinet**                                             | `/cabinet` ochiladi.                                                                                              |
| 2.5 | **Chiqish**                                                            | Seans tugaydi, kirish tugmalari qaytadi; `/cabinet` ga kirish endi `/login` ga yuboradi.                          |
| 2.6 | Mavjud bo'lmagan manzil, masalan `/abc`                                | «Sahifa topilmadi» va **Bosh sahifaga** tugmasi.                                                                  |

---

## 3. Mehmon (tizimga kirmagan)

### 3.1 Bosh sahifa va katalog

| #     | Harakat                                               | Kutilgan natija                                                                                  |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 3.1.1 | `/` ni oching                                         | Bosh sahifa: platforma haqida, «Qanday ishlaydi», kurs kartalari.                                |
| 3.1.2 | **Kurslar** → `/courses`                              | «Kurslar katalogi», «N ta kurs» soni, kartalar (muqova, nom, darslar soni, narx yoki **Bepul**). |
| 3.1.3 | Qidiruvga `Python` yozib **Qidirish**                 | Faqat mos kurslar; manzilda `search=Python`.                                                     |
| 3.1.4 | Qidiruvga `zzzz` yozing                               | «So'rovingiz bo'yicha kurs topilmadi…» xabari.                                                   |
| 3.1.5 | **Barcha yo'nalishlar** ro'yxatidan yo'nalish tanlang | Faqat shu yo'nalishdagi kurslar.                                                                 |
| 3.1.6 | Narx filtri: **Bepul** / **Pullik**                   | Mos ravishda faqat bepul yoki pullik kurslar.                                                    |
| 3.1.7 | **Tozalash**                                          | Filtrlar olib tashlanadi, barcha kurslar.                                                        |
| 3.1.8 | 12 tadan ko'p kurs bo'lsa: **Keyingi** / **Oldingi**  | Sahifalar almashadi.                                                                             |

### 3.2 Kurs sahifasi (`/courses/veb-dasturlash-asoslari`)

| #     | Harakat                                                                         | Kutilgan natija                                                                             |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 3.2.1 | Kurs kartasini bosing                                                           | Kurs sahifasi: nom, qisqa tavsif, daraja, darslar soni.                                     |
| 3.2.2 | «**Kurs bilan tanishing**» bo'limidagi videoni ishga tushiring                  | Tanishtiruv videosi o'ynaydi (faqat admin video qo'shgan kurslarda bor).                    |
| 3.2.3 | «Kurs dasturi»da modul sarlavhasini bosing                                      | Modul ochiladi/yopiladi; darslar ro'yxati va davomiyligi («20 daq»).                        |
| 3.2.4 | Dars yonidagi **Bepul ko'rish** havolasi                                        | «Bepul ko'rish darsi» sahifasi ochiladi (3.3-bo'lim).                                       |
| 3.2.5 | O'ng kartadagi tugma: bepul kursda **Bepul boshlash**, pullikda **Sotib olish** | Kirmagan bo'lsangiz → `/login?next=…`; kirgandan keyin xarid sahifasiga qaytadi (5-bo'lim). |
| 3.2.6 | Admin yoki kontent menejer sifatida kirib, kurs sahifasini oching               | Tugma o'rniga: «Administrator va kontent menejer hisoblari kursga yozila olmaydi…» xabari.  |

### 3.3 Bepul ko'rish darsi

| #     | Harakat                                                        | Kutilgan natija                                                                                               |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 3.3.1 | Bepul ko'rish sahifasini oching (kirmasdan ham)                | «Bepul ko'rish darsi · Kurs nomi», dars sarlavhasi va **materiallar** (matn, video). Amaliyotlar ko'rinmaydi. |
| 3.3.2 | Pastdagi **Kursga yozilish**                                   | Kurs sahifasiga qaytadi.                                                                                      |
| 3.3.3 | **Kurs sahifasiga qaytish**                                    | Kurs sahifasi.                                                                                                |
| 3.3.4 | Bepul ko'rish **belgilanmagan** dars manzilini qo'lda kiriting | 404 — «Sahifa topilmadi».                                                                                     |

### 3.4 Boshqa ochiq sahifalar

| #     | Harakat                                                                                    | Kutilgan natija                                                      |
| ----- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 3.4.1 | **O'qituvchilar**                                                                          | O'qituvchilar kartalari (ism, lavozim).                              |
| 3.4.2 | **Savol-javob**                                                                            | Savollar ro'yxati; savolni bossangiz javob ochiladi.                 |
| 3.4.3 | Footer → **Sertifikatni tekshirish** (`/verify`), ID: `OD-0XB2-RQBD-E3PN` → **Tekshirish** | «**Sertifikat haqiqiy**»: Egasi, Kurs, Berilgan sana, Sertifikat ID. |
| 3.4.4 | Xuddi shu ID ni kichik harflar yoki tirelarsiz kiriting                                    | Baribir topiladi (kiritish normallashtiriladi).                      |
| 3.4.5 | Noto'g'ri ID: `OD-0000-0000-0000`                                                          | «**Sertifikat topilmadi**».                                          |

---

## 4. Ro'yxatdan o'tish va kirish

| #    | Harakat                                                                                                   | Kutilgan natija                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1  | `/register` → **Email orqali**: To'liq ism, Email, Parol (≥ 8 belgi) → **Ro'yxatdan o'tish**              | Hisob yaratiladi va `/cabinet` ochiladi: «Xush kelibsiz, {ism}!».                                                                          |
| 4.2  | Bo'sh maydonlar yoki 8 belgidan qisqa parol bilan yuboring                                                | Maydon ostida qizil xato; so'rov yuborilmaydi.                                                                                             |
| 4.3  | Mavjud email bilan ro'yxatdan o'ting                                                                      | Xato xabari (email band).                                                                                                                  |
| 4.4  | **Telefon orqali**: raqam → **SMS kod yuborish** → kod → **Tasdiqlash**                                   | «SMS kodni kiriting» bosqichi, 6 xonali kod. ⚠️ Demo'da SMS yuborilmaydi — kod faqat server logida. Testda email orqali ro'yxatdan o'ting. |
| 4.5  | SMS bosqichida **Kodni qayta yuborish**                                                                   | Taymer tugaguncha «Qayta yuborish: N s» ko'rinadi, keyin tugma faollashadi.                                                                |
| 4.6  | `/login`: to'g'ri login va parol → **Kirish**                                                             | Talaba → `/cabinet`; admin/kontent menejer → `/admin`.                                                                                     |
| 4.7  | Noto'g'ri parol → **Kirish**                                                                              | «Login yoki parol noto'g'ri» xabari; sahifa o'zgarmaydi. Keyin to'g'ri parol bilan kirish ishlashi kerak.                                  |
| 4.8  | Kirmagan holda `/cabinet/certificates` ni oching                                                          | `/login?next=/cabinet/certificates` → kirgandan keyin aynan shu sahifaga qaytadi.                                                          |
| 4.9  | **Parolni ko'rsatish** (ko'z belgisi)                                                                     | Parol ko'rinadi/yashiriladi.                                                                                                               |
| 4.10 | **Parolni unutdingizmi?** → telefon → **Kod yuborish** → kod + **Yangi parol** → **Parolni o'zgartirish** | «Parol o'zgartirildi. Endi yangi parol bilan kiring.» ⚠️ Demo'da SMS yuborilmaydi.                                                         |
| 4.11 | Talaba sifatida `/admin` ni oching                                                                        | `/cabinet` ga yo'naltiriladi.                                                                                                              |
| 4.12 | Admin sifatida `/cabinet` ni oching                                                                       | `/admin` ga yo'naltiriladi (xodimlarning talaba kabineti yo'q).                                                                            |

---

## 5. Kursga yozilish va to'lov

### 5.1 Bepul kurs (masalan «SQL va ma'lumotlar bazasi», «Git va GitHub»)

| #     | Harakat                                                  | Kutilgan natija                                                              |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 5.1.1 | Talaba sifatida kurs sahifasida **Bepul boshlash**       | «Buyurtmani rasmiylashtirish» sahifasi: kurs nomi, Jami: **Bepul**.          |
| 5.1.2 | **Kursni boshlash**                                      | Darhol kabinetdagi kurs sahifasi ochiladi; kurs «Kurslarim»da paydo bo'ladi. |
| 5.1.3 | Shu kursda yana **Bepul boshlash** → **Kursni boshlash** | Ikkinchi marta yozilmaydi — to'g'ridan-to'g'ri kurs sahifasiga o'tadi.       |

### 5.2 Pullik kurs (masalan «Python dasturlash asoslari», 499 000 so'm)

| #     | Harakat                                               | Kutilgan natija                                                                                                                                         |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.2.1 | **Sotib olish**                                       | Xarid sahifasi: kurs, narx, «**To'lov usulini tanlang**»: **Payme** / **Click**.                                                                        |
| 5.2.2 | Usulni tanlab **To'lovga o'tish**                     | «To'lov sahifasiga yo'naltirilmoqda…» → Payme/Click test sahifasi ochiladi.                                                                             |
| 5.2.3 | ⚠️ Demo cheklovi                                      | Haqiqiy merchant kalitlari yo'q, to'lov **tasdiqlanmaydi** — bu kutilgan holat. Kursga kirish faqat to'lov tizimi serverdan tasdiqlagandagina ochiladi. |
| 5.2.4 | To'lov holati sahifasi (`/checkout/result?orderId=…`) | «To'lov tekshirilmoqda…»; vaqt o'tsa «Tasdiq hali kelmadi» va **Qayta tekshirish**. Brauzer manzilidagi `status=success` kirish bermaydi.               |
| 5.2.5 | Pullik kursni demo'da talabaga ochish                 | Admin: **Talabalar → talaba → Kursga kirish berish** (7.14).                                                                                            |
| 5.2.6 | Kabinet → **To'lovlar tarixi**                        | Buyurtma #raqam, kurs, summa, usul, sana, holat (**Kutilmoqda / To'langan / Bekor qilingan / Muvaffaqiyatsiz / Qaytarilgan**).                          |

---

## 6. Talaba kabineti va o'qish

### 6.1 Bosh sahifa va kurslar

| #     | Harakat                                  | Kutilgan natija                                                                                                  |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 6.1.1 | `/cabinet`                               | «Xush kelibsiz, {ism}!», umumiy o'zlashtirish %, kurslar, tugatilgan darslar, sertifikatlar, «So'nggi faollik».  |
| 6.1.2 | **Kurslarim**                            | Har bir kurs: «N% bajarildi», «X/Y dars», **Davom etish** yoki **Kursni ochish**.                                |
| 6.1.3 | **Davom etish**                          | Oxirgi to'xtagan dars ochiladi.                                                                                  |
| 6.1.4 | Kursni oching                            | Modullar → darslar. Holatlar: **Tugatildi / Jarayonda / Boshlanmagan / Yopiq** 🔒. «Darslar ketma-ket ochiladi». |
| 6.1.5 | **Yopiq** darsni bosishga urinib ko'ring | Bosilmaydi (havola emas); «Avvalgi darslarni tugatgandan so'ng ochiladi».                                        |

### 6.2 Dars

| #     | Harakat                                                       | Kutilgan natija                                                                       |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 6.2.1 | Ochiq darsni bosing                                           | «Dars materiallari» (matn, rasm, fayl, video) va 4 ta amaliyot ro'yxati.              |
| 6.2.2 | Materialni oxirigacha aylantiring yoki **Materialni ko'rdim** | «Material ko'rildi» belgisi.                                                          |
| 6.2.3 | Fayl materialida **Yuklab olish**                             | Fayl yuklanadi.                                                                       |
| 6.2.4 | Amaliyot kartasi: **Boshlash** / **Qayta topshirish**         | Amaliyot sahifasi ochiladi. Kartada «Eng yaxshi natija: N%» va **Bajarildi** belgisi. |
| 6.2.5 | Barcha majburiy amaliyotlar bajarilib, material ko'rilgach    | «**Dars tugatildi**»; kursda keyingi dars ochiladi; **Keyingi dars** tugmasi.         |

### 6.3 Amaliyot (6 ta savol)

| #     | Harakat                                                      | Kutilgan natija                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.3.1 | Savol turlarini bajaring                                     | **Variantli** (bitta — «Bitta javobni tanlang», ko'p — «Barcha to'g'ri javoblarni tanlang»), **To'g'ri / Noto'g'ri**, **Moslashtirish** (chapni tanlab o'ngdagi javobni bosing yoki sudrang), **Bo'sh joyni to'ldiring**, **Rasm asosida**. |
| 6.3.2 | **Oldingi / Keyingi** va savol raqamlari                     | Savollar orasida o'tadi; javob berilganlari belgilanadi. Javoblar sahifada saqlanib turadi.                                                                                                                                                 |
| 6.3.3 | Ba'zi savollarni bo'sh qoldirib **Javoblarni topshirish**    | Oyna: «N ta savolga javob berilmagan. Baribir topshirasizmi?» → **Ha, topshirish** yoki bekor qilish.                                                                                                                                       |
| 6.3.4 | Hammasiga javob berib **Javoblarni topshirish**              | «Tekshirilmoqda…» → **Natija**: «X/6 to'g'ri javob», foiz; har savolda **To'g'ri/Noto'g'ri**, «Sizning javobingiz», «To'g'ri javob», **Izoh**.                                                                                              |
| 6.3.5 | Topshirishdan **oldin** to'g'ri javoblar ko'rinmasligi kerak | To'g'ri javoblar faqat natija ekranida ko'rinadi (xavfsizlik qoidasi).                                                                                                                                                                      |
| 6.3.6 | **Qayta urinish** / **Darsga qaytish**                       | Amaliyot qaytadan / dars sahifasi.                                                                                                                                                                                                          |

### 6.4 Yakuniy imtihon

| #     | Harakat                                            | Kutilgan natija                                                                                                          |
| ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 6.4.1 | Darslar tugamagan holda imtihon kartasi            | «**Imtihon yopiq**» — «Imtihon barcha majburiy darslar tugagandan so'ng ochiladi», «Majburiy darslar: X/Y».              |
| 6.4.2 | Barcha darslar tugagach: **Imtihonga o'tish**      | Savollar soni, vaqt, o'tish bali, urinishlar; ogohlantirish: «Imtihon boshlangach vaqt to'xtamaydi…».                    |
| 6.4.3 | **Imtihonni boshlash**                             | Savollar va **Qolgan vaqt** taymeri; «Javoblar shu qurilmada avtomatik saqlanadi».                                       |
| 6.4.4 | Imtihon davomida sahifani yangilang (F5)           | **Imtihonni davom ettirish**; avvalgi javoblar va taymer saqlangan.                                                      |
| 6.4.5 | **Imtihonni topshirish**                           | Tasdiqlash: «Imtihonni yakunlaysizmi? N ta savolga javob berilmagan.» → **Ha, topshirish**.                              |
| 6.4.6 | O'tish balidan past natija                         | «Afsuski, o'tish bali to'planmadi»; urinish qolgan bo'lsa **Qayta topshirish**.                                          |
| 6.4.7 | O'tish balidan yuqori natija                       | «**Tabriklaymiz! Siz imtihondan o'tdingiz**» → **Sertifikatlarim**; sertifikat avtomatik beriladi, bildirishnoma keladi. |
| 6.4.8 | O'tgandan keyin imtihonni qayta boshlashga urinish | «Siz imtihondan muvaffaqiyatli o'tgansiz» — qayta topshirib bo'lmaydi.                                                   |
| 6.4.9 | Vaqt tugashi                                       | «Vaqt tugadi. Javoblaringiz avtomatik topshirildi.» (saqlangan javoblar bo'yicha baholanadi).                            |

### 6.5 Natijalar, sertifikatlar, bildirishnomalar, profil

| #     | Harakat                                                          | Kutilgan natija                                                                                                                           |
| ----- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 6.5.1 | **Natijalar**                                                    | Imtihon urinishlari: kurs, sana, natija %, **O'tdi / O'tmadi**.                                                                           |
| 6.5.2 | **Sertifikatlar** (`talaba03` bilan)                             | Sertifikat kartasi: kurs, «Berilgan sana», «ID: OD-…», **PDF yuklab olish**, **Tekshirish sahifasi**.                                     |
| 6.5.3 | **PDF yuklab olish**                                             | PDF yuklanadi yoki «**PDF tayyorlanmoqda**» (demo'da PDF xizmati ishlamasligi mumkin — sertifikatning o'zi haqiqiy).                      |
| 6.5.4 | **Tekshirish sahifasi**                                          | `/verify/OD-…` — «Sertifikat haqiqiy».                                                                                                    |
| 6.5.5 | Yuqoridagi qo'ng'iroqcha yoki **Bildirishnomalar**               | Ro'yxat (to'lov qabul qilindi, sertifikat berildi); o'qilmaganlar soni.                                                                   |
| 6.5.6 | **O'qilgan deb belgilash** / **Faqat o'qilmaganlar**             | Belgi «O'qilgan» bo'ladi, hisoblagich kamayadi / filtr ishlaydi.                                                                          |
| 6.5.7 | **Profil → Profilni tahrirlash** → ismni o'zgartirib **Saqlash** | «Profil saqlandi»; yangi ism kabinet salomlashuvida ko'rinadi.                                                                            |
| 6.5.8 | **Parolni o'zgartirish**: Joriy parol + Yangi parol              | «Parol o'zgartirildi». Noto'g'ri joriy parol → xato. ⚠️ Demo hisoblarda parolni o'zgartirsangiz, boshqa testerlarga yangi parolni ayting. |

---

## 7. Administrator paneli (`admin@onlinedars.uz`)

| #    | Bo'lim / harakat                                                                                                  | Kutilgan natija                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | **Bosh sahifa**                                                                                                   | Talabalar, Faol kurslar, Tugatilgan darslar, Topshirilgan imtihonlar, O'tish darajasi %, Berilgan sertifikatlar, Tushum (so'm); «So'nggi imtihon natijalari» jadvali.                                            |
| 7.2  | **Kurslar**                                                                                                       | Jadval: nom, holat, narx, darslar, talabalar; filtr: **Barchasi / Qoralama / Nashr qilingan / Yashirilgan / Arxivlangan**.                                                                                       |
| 7.3  | **Yangi kurs** → Nomi (slug avtomatik), Narxi yoki **Bepul kurs**, muqova, **Tanishtiruv videosi** → **Yaratish** | «Kurs yaratildi», kurs **Qoralama** holatida, «Dastur» bo'limi ochiladi. Pullik kursda narxsiz → «Pullik kurs narxini kiriting».                                                                                 |
| 7.4  | **Dastur** → **Modul qo'shish** / **Dars qo'shish**; tartibni sudrab o'zgartirish                                 | Modul/dars qo'shiladi, «N ta dars» belgisi; «Tartib saqlandi».                                                                                                                                                   |
| 7.5  | Dars nomi → dars muharriri: **Material qo'shish** (Matn / Rasm / Fayl / **Video** havolasi)                       | Material ro'yxatda paydo bo'ladi. Video uchun YouTube/Vimeo havolasi.                                                                                                                                            |
| 7.6  | Dars muharririda **Bepul ko'rish** belgisini qo'yib **Saqlash**                                                   | Dasturda darsga «Bepul ko'rish» belgisi qo'shiladi; ochiq kurs sahifasida **Bepul ko'rish** havolasi paydo bo'ladi (bir daqiqagacha kesh bo'lishi mumkin).                                                       |
| 7.7  | **Amaliyotlar**: «Amaliyotlar N/4», har birida «Savollar N/6»; **Amaliyot qo'shish**, **Savol qo'shish**          | 4 ta amaliyotdan keyin **Amaliyot qo'shish** o'chadi («chegaraga yetildi»); 6 tadan ortiq savol qo'shib bo'lmaydi. 4×6 to'lmaguncha **Darsni nashr qilish** o'chiq.                                              |
| 7.8  | 4×6 to'lgach **Darsni nashr qilish** / **Nashrdan olish**                                                         | «Dars nashr qilindi» / «Dars nashrdan olindi»; talabalarga faqat nashr qilingan darslar ko'rinadi.                                                                                                               |
| 7.9  | Kurs holati: **Nashr qilish / Yashirish / Arxivlash / Qoralamaga qaytarish**                                      | «Kurs holati o'zgartirildi». Yashirilgan kurs katalogda ko'rinmaydi, lekin yozilgan talabalar o'qishda davom etadi.                                                                                              |
| 7.10 | **Imtihonlar → Sozlash**: savollar soni, vaqt, o'tish bali, urinishlar, aralashtirish, faol; savollar bazasi      | «Imtihon sozlamalari saqlandi»; «Bazada N ta savol».                                                                                                                                                             |
| 7.11 | **Sertifikat shablonlari**: shablonni tahrirlash → **Ko'rib chiqish**                                             | Namuna ma'lumotlar bilan sertifikat ko'rinishi.                                                                                                                                                                  |
| 7.12 | **Yo'nalishlar / O'qituvchilar / Savol-javob**: qo'shish, tahrirlash, o'chirish                                   | O'zgarishlar ochiq saytda ko'rinadi. O'chirishdan oldin tasdiqlash oynasi.                                                                                                                                       |
| 7.13 | **Talabalar**: qidiruv (ism, telefon, email) → talabani oching                                                    | Profil, kurslar va o'zlashtirish %, imtihon natijalari, sertifikatlar.                                                                                                                                           |
| 7.14 | Talaba profilida **Kursni tanlang → Kursga kirish berish**                                                        | «Kursga kirish berildi»; talaba kabinetida kurs paydo bo'ladi; audit jurnaliga yoziladi.                                                                                                                         |
| 7.15 | **Kirishni bekor qilish** → tasdiqlash                                                                            | «Kirish bekor qilindi»; talaba kursni ko'ra olmaydi (progress saqlanadi).                                                                                                                                        |
| 7.16 | **To'lovlar**: holat, to'lov usuli, kurs, sana bo'yicha filtr → **Tozalash**                                      | Jadval filtrlanadi.                                                                                                                                                                                              |
| 7.17 | **Holatni o'zgartirish** → yangi holat + **Sabab** (≥ 5 belgi)                                                    | Sababsiz — «Sababni kiriting (kamida 5 ta belgi)». Ruxsat etilgan o'tishlar: Kutilmoqda → To'langan/Bekor/Muvaffaqiyatsiz; Bekor/Muvaffaqiyatsiz → To'langan; To'langan → Qaytarilgan. Audit jurnaliga yoziladi. |
| 7.18 | **Hisobotlar**: **Kurslar bo'yicha / Imtihonlar bo'yicha / Faollik**, sana oralig'i                               | Jadvallar to'ladi: yozilganlar, tugatganlar, tugatish darajasi; urinishlar, o'tganlar, o'rtacha ball; kunlik faollik.                                                                                            |
| 7.19 | **Sozlamalar** → o'zgartirib **Saqlash**                                                                          | «Sozlamalar saqlandi»; audit jurnaliga yoziladi.                                                                                                                                                                 |
| 7.20 | **Audit jurnali**                                                                                                 | Kim, qachon, nima o'zgartirdi va sababi (demo: to'lov qaytarilishi, kirish berilishi).                                                                                                                           |

### 7.21 Kontent menejer (`content@onlinedars.uz`)

| Harakat                                      | Kutilgan natija                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Kirish                                       | `/admin`; menyuda **To'lovlar**, **Sozlamalar** va boshqa moliyaviy bo'limlar yo'q. |
| **Bosh sahifa**                              | Statistika ko'rinadi, lekin tushum ko'rsatilmaydi.                                  |
| `/admin/settings` ni qo'lda oching           | «Bu bo'lim faqat administratorlar uchun».                                           |
| Kurs, dars, amaliyot, savollar bilan ishlash | Administrator bilan bir xil.                                                        |

---

## 8. Xavfsizlik va chegaraviy holatlar (albatta tekshiring)

| #   | Tekshiruv                                                                     | Kutilgan natija                                      |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 8.1 | Talaba yopiq dars manzilini qo'lda ochadi                                     | Dars ochilmaydi (xato xabari).                       |
| 8.2 | Talaba yozilmagan kursning kabinet manzilini ochadi (`/cabinet/courses/{id}`) | Kirish yo'q — xato xabari.                           |
| 8.3 | Admin/kontent menejer kursga yozilishga urinadi                               | Xabar ko'rsatiladi, server ham rad etadi.            |
| 8.4 | Imtihon yopiq holda imtihon sahifasini qo'lda ochish                          | «Imtihon yopiq».                                     |
| 8.5 | Boshqa talabaning sertifikat PDF havolasi                                     | Topilmaydi (404).                                    |
| 8.6 | To'lov sahifasida manzilga `&status=success` qo'shish                         | Kursga kirish ochilmaydi.                            |
| 8.7 | Bir xil kursga ikki marta yozilish                                            | Ikkinchi yozuv yaratilmaydi; kurs sahifasiga o'tadi. |
| 8.8 | Telefon (375 px) va kompyuterda barcha asosiy sahifalar                       | Joylashuv buzilmaydi, gorizontal aylantirish yo'q.   |

---

## 9. Demo cheklovlari (xato emas)

- **Haqiqiy to'lov** ishlamaydi: Payme/Click merchant kalitlari hali yo'q. Pullik kursni admin «Kursga kirish berish» orqali oching.
- **SMS kodlar** yuborilmaydi (server logida). Email orqali ro'yxatdan o'ting.
- **Sertifikat PDF** «tayyorlanmoqda» bo'lib qolishi mumkin; sertifikat va tekshirish sahifasi ishlaydi.
- Demo havola kompyuter yoqiq va server ishlab turgandagina ochiladi; ochiq sahifalardagi ma'lumot bir daqiqagacha keshlanishi mumkin.
- Barcha kurslar, talabalar va to'lovlar — **demo ma'lumotlar** (`pnpm db:seed:demo`).

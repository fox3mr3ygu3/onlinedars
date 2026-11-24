# OnlineDars — test ssenariylari (testerlar uchun)

Bu hujjat platformadagi har bir asosiy oqimni (flow) qadamma-qadam tasvirlaydi: **qaysi tugma bosiladi → nima bo'lishi kerak**. Kutilgan natijadan farq qilgan har qanday holatni xato (bug) sifatida qayd eting: sahifa manzili, qadam raqami, skrinshot.

> **Muhim (2026-11-24 dan):** kurslar sotilmaydi va to'lov yo'q. Har qanday kursga kirish faqat **administrator ruxsati** bilan ochiladi: talaba kurs sahifasida **Kirish so'rash** tugmasini bosadi, administrator so'rovni tasdiqlaydi yoki rad etadi (5-bo'lim).

## 1. Kirish ma'lumotlari

**Sayt manzili:**

- Lokal: `http://localhost:3000`
- Demo havola: dasturchidan so'rang. Havola kompyuter yoqiq bo'lgandagina ishlaydi va har safar qayta ishga tushirilganda o'zgaradi.

**Loginlar (barchasi uchun parol: `Parol12345!`)** — faqat demo ma'lumotlar, haqiqiy foydalanuvchilar emas:

| Tomon (rol)                    | Login                                               | Qayerga tushadi | Nimani tekshirish uchun                                                      |
| ------------------------------ | --------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Administrator                  | `admin@onlinedars.uz`                               | `/admin`        | Butun boshqaruv paneli: kirish so'rovlari, talabalar, hisobotlar, sozlamalar |
| Kontent menejer                | `content@onlinedars.uz`                             | `/admin`        | Faqat kontent: kurslar, darslar, savollar (so'rovlar va sozlamalarsiz)       |
| Talaba (yangi)                 | `student@onlinedars.uz` (yoki tel. `+998901234567`) | `/cabinet`      | 1 ta kursga kirish berilgan, progress yo'q                                   |
| Talaba (o'qiyapti + so'rov)    | `talaba01@demo.onlinedars.uz`                       | `/cabinet`      | 3 ta kurs turli bosqichlarda + 1 ta **kutilayotgan** so'rov                  |
| Talaba (sertifikatli)          | `talaba03@demo.onlinedars.uz`                       | `/cabinet`      | Tugatilgan kurs, imtihon natijasi, sertifikat                                |
| Talaba (rad etilgan so'rov)    | `talaba04@demo.onlinedars.uz`                       | `/cabinet`      | **Rad etilgan** so'rov va uning sababi                                       |
| Talaba (kirish bekor qilingan) | `talaba05@demo.onlinedars.uz`                       | `/cabinet`      | Administrator kirishni bekor qilgan kurs                                     |
| Boshqa talabalar               | `talaba01` … `talaba30@demo.onlinedars.uz`          | `/cabinet`      | Turli holatlar: boshlanmagan, yarmida, imtihondan yiqilgan, o'tgan           |
| Mehmon (kirmagan)              | —                                                   | `/`             | Ochiq sahifalar, bepul ko'rish darsi, sertifikatni tekshirish                |

Tekshirish uchun sertifikat ID: `talaba03` bilan kiring → **Sertifikatlar** → kartadagi «ID: OD-…» ni nusxalang.

Hisobni almashtirishdan oldin yuqori o'ng burchakdagi **Chiqish** tugmasini bosing. Ikki hisobni (talaba va administrator) bir vaqtda sinash uchun ikkinchisini boshqa brauzerda yoki yashirin (inkognito) oynada oching.

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
| 2.7 | Saytning hech qayerida                                                 | Narx, «so'm», «Bepul / Pullik», **Sotib olish**, Payme yoki Click ko'rinmasligi kerak.                            |

---

## 3. Mehmon (tizimga kirmagan)

### 3.1 Bosh sahifa va katalog

| #     | Harakat                                               | Kutilgan natija                                                                                      |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 3.1.1 | `/` ni oching                                         | Bosh sahifa: platforma haqida, «Qanday ishlaydi», kurs kartalari.                                    |
| 3.1.2 | **Kurslar** → `/courses`                              | «Kurslar katalogi», «N ta kurs» soni, kartalar (muqova, nom, darslar soni, **Batafsil**). Narx yo'q. |
| 3.1.3 | Qidiruvga `Python` yozib **Qidirish**                 | Faqat mos kurslar; manzilda `search=Python`.                                                         |
| 3.1.4 | Qidiruvga `zzzz` yozing                               | «So'rovingiz bo'yicha kurs topilmadi…» xabari.                                                       |
| 3.1.5 | **Barcha yo'nalishlar** ro'yxatidan yo'nalish tanlang | Faqat shu yo'nalishdagi kurslar.                                                                     |
| 3.1.6 | **Tozalash**                                          | Filtrlar olib tashlanadi, barcha kurslar.                                                            |
| 3.1.7 | 12 tadan ko'p kurs bo'lsa: **Keyingi** / **Oldingi**  | Sahifalar almashadi.                                                                                 |

### 3.2 Kurs sahifasi (`/courses/veb-dasturlash-asoslari`)

| #     | Harakat                                                           | Kutilgan natija                                                                                                                             |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.2.1 | Kurs kartasini bosing                                             | Kurs sahifasi: nom, qisqa tavsif, daraja, darslar soni.                                                                                     |
| 3.2.2 | «**Kurs bilan tanishing**» bo'limidagi videoni ishga tushiring    | Tanishtiruv videosi o'ynaydi (faqat admin video qo'shgan kurslarda bor).                                                                    |
| 3.2.3 | «Kurs dasturi»da modul sarlavhasini bosing                        | Modul ochiladi/yopiladi; darslar ro'yxati va davomiyligi («20 daq»).                                                                        |
| 3.2.4 | Dars yonidagi **Bepul ko'rish** havolasi                          | «Bepul ko'rish darsi» sahifasi ochiladi (3.3-bo'lim).                                                                                       |
| 3.2.5 | O'ng kartada «**Kursga kirish**» bloki                            | Matn: «Kursga kirish administrator tomonidan beriladi…» va **Kirish so'rash** tugmasi.                                                      |
| 3.2.6 | Kirmagan holda **Kirish so'rash**                                 | `/login?next=/courses/…` → kirgandan keyin shu kurs sahifasiga qaytadi; so'rov **o'zi yuborilmaydi**, tugmani yana bosish kerak (5-bo'lim). |
| 3.2.7 | Admin yoki kontent menejer sifatida kirib, kurs sahifasini oching | Tugma o'rniga: «Administrator va kontent menejer hisoblari kursga yozila olmaydi…» xabari.                                                  |

### 3.3 Bepul ko'rish darsi

| #     | Harakat                                                        | Kutilgan natija                                                                                               |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 3.3.1 | Bepul ko'rish sahifasini oching (kirmasdan ham)                | «Bepul ko'rish darsi · Kurs nomi», dars sarlavhasi va **materiallar** (matn, video). Amaliyotlar ko'rinmaydi. |
| 3.3.2 | Pastdagi **Kirish so'rash**                                    | Kurs sahifasiga qaytadi (so'rov u yerdan yuboriladi).                                                         |
| 3.3.3 | **Kurs sahifasiga qaytish**                                    | Kurs sahifasi.                                                                                                |
| 3.3.4 | Bepul ko'rish **belgilanmagan** dars manzilini qo'lda kiriting | 404 — «Sahifa topilmadi».                                                                                     |

### 3.4 Boshqa ochiq sahifalar

| #     | Harakat                                                                          | Kutilgan natija                                                      |
| ----- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3.4.1 | **O'qituvchilar**                                                                | O'qituvchilar kartalari (ism, lavozim).                              |
| 3.4.2 | **Savol-javob**                                                                  | Savollar ro'yxati; savolni bossangiz javob ochiladi.                 |
| 3.4.3 | Footer → **Sertifikatni tekshirish** (`/verify`), sertifikat ID → **Tekshirish** | «**Sertifikat haqiqiy**»: Egasi, Kurs, Berilgan sana, Sertifikat ID. |
| 3.4.4 | Xuddi shu ID ni kichik harflar yoki tirelarsiz kiriting                          | Baribir topiladi (kiritish normallashtiriladi).                      |
| 3.4.5 | Noto'g'ri ID: `OD-0000-0000-0000`                                                | «**Sertifikat topilmadi**».                                          |

---

## 4. Ro'yxatdan o'tish va kirish

| #    | Harakat                                                                                                   | Kutilgan natija                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1  | `/register` → **Email orqali**: To'liq ism, Email, Parol (≥ 8 belgi) → **Ro'yxatdan o'tish**              | Hisob yaratiladi va `/cabinet` ochiladi: «Xush kelibsiz, {ism}!». Yangi talabada kurs yo'q.                                                |
| 4.2  | Bo'sh maydonlar yoki 8 belgidan qisqa parol bilan yuboring                                                | Maydon ostida qizil xato; so'rov yuborilmaydi.                                                                                             |
| 4.3  | Mavjud email bilan ro'yxatdan o'ting                                                                      | Xato xabari (email band).                                                                                                                  |
| 4.4  | **Telefon orqali**: raqam → **SMS kod yuborish** → kod → **Tasdiqlash**                                   | «SMS kodni kiriting» bosqichi, 6 xonali kod. ⚠️ Demo'da SMS yuborilmaydi — kod faqat server logida. Testda email orqali ro'yxatdan o'ting. |
| 4.5  | SMS bosqichida **Kodni qayta yuborish**                                                                   | Taymer tugaguncha «Qayta yuborish: N s» ko'rinadi, keyin tugma faollashadi.                                                                |
| 4.6  | `/login`: to'g'ri login va parol → **Kirish**                                                             | Talaba → `/cabinet`; admin/kontent menejer → `/admin`.                                                                                     |
| 4.7  | Noto'g'ri parol → **Kirish**                                                                              | «Login yoki parol noto'g'ri» xabari; sahifa o'zgarmaydi. Keyin to'g'ri parol bilan kirish ishlashi kerak.                                  |
| 4.8  | Kirmagan holda `/cabinet/requests` ni oching                                                              | `/login?next=/cabinet/requests` → kirgandan keyin aynan shu sahifaga qaytadi.                                                              |
| 4.9  | **Parolni ko'rsatish** (ko'z belgisi)                                                                     | Parol ko'rinadi/yashiriladi.                                                                                                               |
| 4.10 | **Parolni unutdingizmi?** → telefon → **Kod yuborish** → kod + **Yangi parol** → **Parolni o'zgartirish** | «Parol o'zgartirildi. Endi yangi parol bilan kiring.» ⚠️ Demo'da SMS yuborilmaydi.                                                         |
| 4.11 | Talaba sifatida `/admin` ni oching                                                                        | `/cabinet` ga yo'naltiriladi.                                                                                                              |
| 4.12 | Admin sifatida `/cabinet` ni oching                                                                       | `/admin` ga yo'naltiriladi (xodimlarning talaba kabineti yo'q).                                                                            |

---

## 5. Kursga kirish (administrator ruxsati bilan)

Barcha kurslar uchun bir xil: talaba so'raydi → administrator tasdiqlaydi yoki rad etadi. Eng qulay usul — ikki oyna: birida yangi talaba (4.1 orqali yarating), ikkinchisida `admin@onlinedars.uz`.

### 5.1 Talaba so'rov yuboradi

| #     | Harakat                                                                         | Kutilgan natija                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1.1 | Talaba sifatida istalgan kurs sahifasida **Kirish so'rash**                     | Tugma o'rniga sariq blok: «**So'rov yuborildi**», «Administrator so'rovingizni ko'rib chiqmoqda…», «Yuborilgan: {sana}». Tugma yo'qoladi.               |
| 5.1.2 | Sahifani yangilang (F5)                                                         | Holat saqlanadi — yana «So'rov yuborildi». Ikkinchi so'rov yuborib bo'lmaydi.                                                                           |
| 5.1.3 | Hali tasdiqlanmagan kursning kabinet manzilini oching (`/cabinet/courses/{id}`) | Kirish yo'q — xato xabari. Kurs «Kurslarim»da ko'rinmaydi.                                                                                              |
| 5.1.4 | Kabinet → **Kirish so'rovlari** (`/cabinet/requests`)                           | So'rovlar ro'yxati: kurs nomi, holat (**Kutilmoqda / Tasdiqlangan / Rad etilgan**), yuborilgan sana. So'rov yo'q bo'lsa — **Kurslar katalogi** tugmasi. |

### 5.2 Administrator qaror qabul qiladi (`admin@onlinedars.uz` → **Kirish so'rovlari**)

| #     | Harakat                                                         | Kutilgan natija                                                                                                                                                     |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.2.1 | Menyu → **Kirish so'rovlari** (`/admin/access-requests`)        | Sahifa holat filtri **Kutilmoqda** bilan ochiladi; tepada «N ta so'rov kutilmoqda». Jadval: talaba (ism, telefon/email, izoh), kurs, yuborilgan sana, holat, qaror. |
| 5.2.2 | Qidiruvga talaba ismi, telefoni, emaili yoki kurs nomini yozing | Jadval filtrlanadi. Holat va kurs bo'yicha filtrlar ham ishlaydi.                                                                                                   |
| 5.2.3 | Qatordagi **Tasdiqlash**                                        | «Kursga kirish berildi» xabari; so'rov «Kutilmoqda» ro'yxatidan chiqadi, hisoblagich kamayadi.                                                                      |
| 5.2.4 | Boshqa so'rovda **Rad etish** → sababsiz **Rad etish**          | Oyna yopilmaydi: «Sababni kiriting (kamida 3 ta belgi)».                                                                                                            |
| 5.2.5 | Sabab yozib (masalan «Guruh to'lgan») **Rad etish**             | «So'rov rad etildi»; holat filtri **Barchasi** bo'lsa — «Rad etilgan», qaror ustunida admin ismi, sana va sabab.                                                    |
| 5.2.6 | Bosh sahifadagi «**Kutilayotgan so'rovlar**» kartasini bosing   | `/admin/access-requests` ochiladi.                                                                                                                                  |

### 5.3 Talaba natijani ko'radi

| #     | Harakat                                         | Kutilgan natija                                                                                                  |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 5.3.1 | Tasdiqlangandan keyin kurs sahifasini yangilang | «Siz bu kursga yozilgansiz» va **Kursni ochish** → kabinetdagi kurs sahifasi. Kurs «Kurslarim»da paydo bo'ladi.  |
| 5.3.2 | Rad etilgandan keyin kurs sahifasini yangilang  | Qizil blok «So'rov rad etildi» + «Sabab: …» va **Qayta so'rash** tugmasi.                                        |
| 5.3.3 | **Qayta so'rash**                               | Yana «So'rov yuborildi» (5.1.1); administrator ro'yxatida so'rov qayta «Kutilmoqda» bo'ladi.                     |
| 5.3.4 | Qo'ng'iroqcha / **Bildirishnomalar**            | «Kursga kirish berildi» yoki «Kursga kirish so'rovi rad etildi» (sabab bilan).                                   |
| 5.3.5 | **Kirish so'rovlari** sahifasi                  | Tasdiqlangan so'rovda **Kursni ochish**, rad etilganda sabab va **Qayta so'rash** (kurs sahifasiga olib boradi). |
| 5.3.6 | Tayyor misollar (demo ma'lumotlar)              | `talaba01` — kutilayotgan so'rov; `talaba04` — rad etilgan so'rov va sababi.                                     |

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
| 6.5.5 | Yuqoridagi qo'ng'iroqcha yoki **Bildirishnomalar**               | Ro'yxat (kursga kirish berildi / rad etildi, sertifikat berildi); o'qilmaganlar soni.                                                     |
| 6.5.6 | **O'qilgan deb belgilash** / **Faqat o'qilmaganlar**             | Belgi «O'qilgan» bo'ladi, hisoblagich kamayadi / filtr ishlaydi.                                                                          |
| 6.5.7 | **Profil → Profilni tahrirlash** → ismni o'zgartirib **Saqlash** | «Profil saqlandi»; yangi ism kabinet salomlashuvida ko'rinadi.                                                                            |
| 6.5.8 | **Parolni o'zgartirish**: Joriy parol + Yangi parol              | «Parol o'zgartirildi». Noto'g'ri joriy parol → xato. ⚠️ Demo hisoblarda parolni o'zgartirsangiz, boshqa testerlarga yangi parolni ayting. |
| 6.5.9 | Kabinet menyusi                                                  | Bandlar: Bosh sahifa, Kurslarim, Natijalar, Sertifikatlar, **Kirish so'rovlari**, Bildirishnomalar, Profil. «To'lovlar tarixi» yo'q.      |

---

## 7. Administrator paneli (`admin@onlinedars.uz`)

| #    | Bo'lim / harakat                                                                                             | Kutilgan natija                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | **Bosh sahifa**                                                                                              | Talabalar, Faol kurslar, Tugatilgan darslar, Topshirilgan imtihonlar, O'tish darajasi %, Berilgan sertifikatlar, **Kutilayotgan so'rovlar**; «So'nggi imtihon natijalari» jadvali. |
| 7.2  | **Kurslar**                                                                                                  | Jadval: nom, holat, darslar, talabalar (narx ustuni yo'q); filtr: **Barchasi / Qoralama / Nashr qilingan / Yashirilgan / Arxivlangan**.                                            |
| 7.3  | **Yangi kurs** → Nomi (slug avtomatik), muqova, **Tanishtiruv videosi** → **Yaratish**                       | «Kurs yaratildi», kurs **Qoralama** holatida, «Dastur» bo'limi ochiladi. Formada narx yoki «Bepul kurs» maydoni yo'q.                                                              |
| 7.4  | **Dastur** → **Modul qo'shish** / **Dars qo'shish**; tartibni sudrab o'zgartirish                            | Modul/dars qo'shiladi, «N ta dars» belgisi; «Tartib saqlandi».                                                                                                                     |
| 7.5  | Dars nomi → dars muharriri: **Material qo'shish** (Matn / Rasm / Fayl / **Video** havolasi)                  | Material ro'yxatda paydo bo'ladi. Video uchun YouTube/Vimeo havolasi.                                                                                                              |
| 7.6  | Dars muharririda **Bepul ko'rish** belgisini qo'yib **Saqlash**                                              | Dasturda darsga «Bepul ko'rish» belgisi qo'shiladi; ochiq kurs sahifasida **Bepul ko'rish** havolasi paydo bo'ladi (bir daqiqagacha kesh bo'lishi mumkin).                         |
| 7.7  | **Amaliyotlar**: «Amaliyotlar N/4», har birida «Savollar N/6»; **Amaliyot qo'shish**, **Savol qo'shish**     | 4 ta amaliyotdan keyin **Amaliyot qo'shish** o'chadi («chegaraga yetildi»); 6 tadan ortiq savol qo'shib bo'lmaydi. 4×6 to'lmaguncha **Darsni nashr qilish** o'chiq.                |
| 7.8  | 4×6 to'lgach **Darsni nashr qilish** / **Nashrdan olish**                                                    | «Dars nashr qilindi» / «Dars nashrdan olindi»; talabalarga faqat nashr qilingan darslar ko'rinadi.                                                                                 |
| 7.9  | Kurs holati: **Nashr qilish / Yashirish / Arxivlash / Qoralamaga qaytarish**                                 | «Kurs holati o'zgartirildi». Yashirilgan kurs katalogda ko'rinmaydi va unga so'rov yuborib bo'lmaydi, lekin kirishi bor talabalar o'qishda davom etadi.                            |
| 7.10 | **Imtihonlar → Sozlash**: savollar soni, vaqt, o'tish bali, urinishlar, aralashtirish, faol; savollar bazasi | «Imtihon sozlamalari saqlandi»; «Bazada N ta savol».                                                                                                                               |
| 7.11 | **Sertifikat shablonlari**: shablonni tahrirlash → **Ko'rib chiqish**                                        | Namuna ma'lumotlar bilan sertifikat ko'rinishi.                                                                                                                                    |
| 7.12 | **Yo'nalishlar / O'qituvchilar / Savol-javob**: qo'shish, tahrirlash, o'chirish                              | O'zgarishlar ochiq saytda ko'rinadi. O'chirishdan oldin tasdiqlash oynasi.                                                                                                         |
| 7.13 | **Kirish so'rovlari**                                                                                        | 5.2-bo'limdagi barcha qadamlar.                                                                                                                                                    |
| 7.14 | **Talabalar**: qidiruv (ism, telefon, email) → talabani oching                                               | Profil, kurslar (manba: **Administrator** yoki **So'rov orqali**) va o'zlashtirish %, imtihon natijalari, sertifikatlar.                                                           |
| 7.15 | Talaba profilida **Kursni tanlang → Kursga kirish berish** (so'rovsiz, to'g'ridan-to'g'ri)                   | «Kursga kirish berildi»; talaba kabinetida kurs paydo bo'ladi, bildirishnoma keladi; shu kursga kutilayotgan so'rovi bo'lsa — «Tasdiqlangan» bo'ladi; audit jurnaliga yoziladi.    |
| 7.16 | **Kirishni bekor qilish** → tasdiqlash                                                                       | «Kirish bekor qilindi»; talaba kursni ko'ra olmaydi (progress saqlanadi) va kurs sahifasida yana **Kirish so'rash** chiqadi.                                                       |
| 7.17 | **Hisobotlar**: **Kurslar bo'yicha / Imtihonlar bo'yicha / Faollik**, sana oralig'i                          | Jadvallar to'ladi: yozilganlar, tugatganlar, tugatish darajasi; urinishlar, o'tganlar, o'rtacha ball; kunlik faollik.                                                              |
| 7.18 | **Sozlamalar** → o'zgartirib **Saqlash**                                                                     | «Sozlamalar saqlandi»; audit jurnaliga yoziladi. To'lovga oid sozlamalar yo'q.                                                                                                     |
| 7.19 | **Audit jurnali**                                                                                            | Kim, qachon, nima o'zgartirdi va sababi (demo: so'rov tasdiqlandi / rad etildi, kirish berildi / bekor qilindi).                                                                   |

### 7.20 Kontent menejer (`content@onlinedars.uz`)

| Harakat                                                          | Kutilgan natija                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kirish                                                           | `/admin`; menyuda **Kirish so'rovlari**, **Talabalar**, **Sozlamalar** va boshqaruv bo'limlari yo'q. |
| **Bosh sahifa**                                                  | Statistika ko'rinadi.                                                                                |
| `/admin/access-requests` yoki `/admin/settings` ni qo'lda oching | «Bu bo'lim faqat administratorlar uchun».                                                            |
| Kurs, dars, amaliyot, savollar bilan ishlash                     | Administrator bilan bir xil.                                                                         |

---

## 8. Xavfsizlik va chegaraviy holatlar (albatta tekshiring)

| #    | Tekshiruv                                                                               | Kutilgan natija                                                                                             |
| ---- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 8.1  | Talaba yopiq dars manzilini qo'lda ochadi                                               | Dars ochilmaydi (xato xabari).                                                                              |
| 8.2  | Talaba kirishi yo'q kursning kabinet manzilini ochadi (`/cabinet/courses/{id}`)         | Kirish yo'q — xato xabari.                                                                                  |
| 8.3  | Admin/kontent menejer kursga so'rov yuborishga urinadi                                  | Tugma yo'q, xabar ko'rsatiladi; server ham rad etadi.                                                       |
| 8.4  | Imtihon yopiq holda imtihon sahifasini qo'lda ochish                                    | «Imtihon yopiq».                                                                                            |
| 8.5  | Boshqa talabaning sertifikat PDF havolasi                                               | Topilmaydi (404).                                                                                           |
| 8.6  | Kurs sahifasini ikki oynada oching; birinchisida, keyin ikkinchisida **Kirish so'rash** | Faqat bitta so'rov yaratiladi; ikkinchisida «So'rovingiz allaqachon yuborilgan…», keyin «So'rov yuborildi». |
| 8.7  | Kirishi bor kursga so'rov                                                               | Tugma o'rniga **Kursni ochish**; yangi so'rov yaratilmaydi.                                                 |
| 8.8  | Bir so'rovni ikki administrator oynasida tasdiqlash / rad etish                         | Ikkinchi urinishda «Bu so'rov allaqachon ko'rib chiqilgan».                                                 |
| 8.9  | Talaba boshqa talabaning so'rovlarini ko'ra oladimi                                     | Yo'q — **Kirish so'rovlari** faqat o'z so'rovlarini ko'rsatadi.                                             |
| 8.10 | Eski manzillar: `/checkout/…`, `/cabinet/payments`, `/admin/payments`                   | «Sahifa topilmadi» (bu bo'limlar olib tashlangan).                                                          |
| 8.11 | Telefon (375 px) va kompyuterda barcha asosiy sahifalar                                 | Joylashuv buzilmaydi, gorizontal aylantirish yo'q.                                                          |

---

## 9. Demo cheklovlari (xato emas)

- **To'lov tizimi yo'q** — bu ataylab: kurslar faqat administrator ruxsati bilan ochiladi.
- **SMS kodlar** yuborilmaydi (server logida). Email orqali ro'yxatdan o'ting.
- **Sertifikat PDF** «tayyorlanmoqda» bo'lib qolishi mumkin; sertifikat va tekshirish sahifasi ishlaydi.
- Demo havola kompyuter yoqiq va server ishlab turgandagina ochiladi; ochiq sahifalardagi ma'lumot bir daqiqagacha keshlanishi mumkin.
- Barcha kurslar, talabalar va so'rovlar — **demo ma'lumotlar** (`pnpm db:seed:demo`).

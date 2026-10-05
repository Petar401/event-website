/* Balkania — content data.
 * Events are fictional samples set in real places. Photos are hotlinked from
 * Unsplash (as their API guidelines require) and always requested with
 * fit=max, so the CDN only resizes and never crops.
 */

window.BALKANIA = (function () {
  const COUNTRIES = {
    bg: { flag: 'assets/flags/bg.svg', accent: '#00966E', greeting: 'Добре дошли', music: 'музика', lang: 'bg' },
    gr: { flag: 'assets/flags/gr.svg', accent: '#0D5EAF', greeting: 'Καλώς ήρθατε', music: 'μουσική', lang: 'el' },
    tr: { flag: 'assets/flags/tr.svg', accent: '#E30A17', greeting: 'Hoş geldiniz', music: 'müzik', lang: 'tr' },
    rs: { flag: 'assets/flags/rs.svg', accent: '#9B2335', greeting: 'Добродошли', music: 'музика', lang: 'sr' }
  };

  // Signature dance rhythms, in eighth notes grouped as they're felt.
  const RHYTHMS = {
    bg: { name: 'Rachenitsa', meter: '7/8', groups: [2, 2, 3], bpm: 380 },
    gr: { name: 'Kalamatianos', meter: '7/8', groups: [3, 2, 2], bpm: 330 },
    tr: { name: 'Karşılama', meter: '9/8', groups: [2, 2, 2, 3], bpm: 360 },
    rs: { name: 'Kolo', meter: '2/4', groups: [2, 2], bpm: 300 }
  };

  const P = (id, path, w, h, alt, author, username) => ({ id, path, w, h, alt, author, username });

  const EVENTS = [
    {
      id: 'guca-brass', country: 'rs', category: 'brass',
      title: 'Guča Brass Nights', local: 'Гучанске трубачке ноћи',
      venue: 'Festival field', city: 'Guča, Dragačevo',
      start: '2026-08-06T19:00:00+02:00', end: '2026-08-09T23:59:00+02:00',
      blurb: 'Three nights of fiery trumpet orchestras battling it out in the hills of Dragačevo — the loudest, happiest brass party in the Balkans.',
      photo: P('Qga8Hcxu-bA', 'photo-1613941921908-be2113bfbd80', 5616, 3744, 'A trumpet player performing on stage under warm light', 'Lucas Alexander', 'ucaslexander')
    },
    {
      id: 'fortress-sound', country: 'rs', category: 'festival',
      title: 'Fortress Sound', local: 'Звук тврђаве',
      venue: 'Petrovaradin Fortress', city: 'Novi Sad',
      start: '2026-07-09T20:00:00+02:00', end: '2026-07-12T06:00:00+02:00',
      blurb: 'Four stages inside the 18th-century Petrovaradin Fortress above the Danube, and a crowd dancing until sunrise.',
      photo: P('aWXVxy8BSzc', 'photo-1506157786151-b8491531f063', 4896, 3264, 'A festival crowd raising their hands towards a lit stage', 'Hanny Naibaho', 'hannynaibaho')
    },
    {
      id: 'rhodope-bagpipes', country: 'bg', category: 'folk',
      title: 'Rhodope Bagpipe Gathering', local: 'Родопски гайдарски събор',
      venue: 'Rozhen meadows', city: 'Smolyan Province',
      start: '2026-07-25T10:00:00+03:00', end: '2026-07-26T20:00:00+03:00',
      blurb: 'A hundred kaba gaida bagpipes sound together on the Rozhen meadows, with horo dances and Rhodope songs echoing off the pines.',
      photo: P('ctwCtGVXqqw', 'photo-1783231607560-0d7dd593be3c', 7008, 4672, 'Musicians in traditional clothing playing folk instruments outdoors', 'Liviu Boldis', 'livioart')
    },
    {
      id: 'burgas-beach', country: 'bg', category: 'festival',
      title: 'Black Sea Beach Fest', local: 'Черноморски плажен фест',
      venue: 'North Beach', city: 'Burgas',
      start: '2026-08-14T18:00:00+03:00', end: '2026-08-16T23:59:00+03:00',
      blurb: 'Sand, sea breeze and golden-hour sets on the Burgas shoreline — indie, pop and Balkan beats until late.',
      photo: P('UbrW6-p6JjU', 'photo-1786529453033-d5ebbce3af02', 4241, 2912, 'A crowd on a beach at a music festival during golden hour', 'snap wander', 'passimage')
    },
    {
      id: 'rebetiko-acropolis', country: 'gr', category: 'folk',
      title: 'Rebetiko Under the Acropolis', local: 'Ρεμπέτικο κάτω από την Ακρόπολη',
      venue: 'Philopappou Hill open-air stage', city: 'Athens',
      start: '2026-06-20T21:00:00+03:00', end: '2026-06-21T01:00:00+03:00',
      blurb: 'A summer night of rebetiko classics — bouzouki, baglamas and voice — with the Parthenon glowing above the audience.',
      photo: P('bZury0_o204', 'photo-1778097925138-dda2340d8ea5', 5438, 3626, 'Street musicians playing string instruments on a sunny day', 'Milan Trninic', 'wedesignmarbella')
    },
    {
      id: 'bosphorus-jazz', country: 'tr', category: 'jazz',
      title: 'Bosphorus Jazz Week', local: 'Boğaziçi Caz Haftası',
      venue: 'Waterfront stages', city: 'Istanbul',
      start: '2026-07-03T19:00:00+03:00', end: '2026-07-10T23:59:00+03:00',
      blurb: 'Saxophones on the waterfront: a week of jazz clubs and open-air concerts on both sides of the Bosphorus.',
      photo: P('dBWvUqBoOU8', 'photo-1415201364774-f6f0bb35f28f', 4368, 2912, 'A saxophonist playing at a colourful jazz concert', 'Jens Thekkeveettil', 'jensth')
    },
    {
      id: 'belgrade-jazz', country: 'rs', category: 'jazz',
      title: 'Belgrade Jazz Autumn', local: 'Београдска џез јесен',
      venue: 'Savamala riverside club', city: 'Belgrade',
      start: '2026-10-29T20:00:00+01:00', end: '2026-11-01T23:59:00+01:00',
      blurb: 'Smoky late-night sets and big-band evenings as the city opens its jazz season by the Sava.',
      photo: P('z_disLOcoKM', 'photo-1725830071503-d705ef4a0975', 5115, 3410, 'A saxophone player performing in a dark club', 'Denny Müller', 'redaquamedia')
    },
    {
      id: 'bouzouki-night', country: 'gr', category: 'folk',
      title: 'Bouzouki & Laïká Night', local: 'Βραδιά μπουζουκιού & λαϊκών',
      venue: 'Ladadika music hall', city: 'Thessaloniki',
      start: '2026-11-21T21:30:00+02:00', end: '2026-11-22T02:00:00+02:00',
      blurb: 'An evening of laïká and Smyrna songs with a live string ensemble. Bring your voice — everyone sings the chorus.',
      photo: P('vUNzy_IZIGo', 'photo-1633592498337-cbec7c3ebcd3', 3452, 3024, 'A musician holding a long-necked wooden string instrument', 'Esmail Jlaly', 'esmail23')
    },
    {
      id: 'sema-ney', country: 'tr', category: 'sacred',
      title: 'Sema & Ney', local: 'Sema ve Ney Gecesi',
      venue: 'Cultural centre hall', city: 'Konya',
      start: '2026-12-17T19:30:00+03:00', end: '2026-12-17T22:00:00+03:00',
      blurb: 'The breath of the ney flute, kudüm drums and the turning Mevlevi sema — a meditative night of Sufi music.',
      photo: P('6lobNvryPs4', 'photo-1764099363036-af650bca3cd7', 5730, 3820, 'Whirling dervishes in white robes performing the sema', 'Karwin Luo', 'karw1n')
    },
    {
      id: 'bulgarian-voices', country: 'bg', category: 'classical',
      title: 'Bulgarian Voices Christmas Gala', local: 'Коледен концерт „Български гласове“',
      venue: 'Concert hall', city: 'Sofia',
      start: '2026-12-20T19:00:00+02:00', end: '2026-12-20T21:30:00+02:00',
      blurb: 'Bulgaria’s legendary polyphonic female voices meet a chamber choir for a candle-lit Christmas concert.',
      photo: P('ZaZcvU_WuF8', 'photo-1720186576697-24c1496a07e1', 6000, 4000, 'A choir singing in front of an ornate golden altar', 'Green Liu', 'greenliustudio')
    },
    {
      id: 'danube-new-year', country: 'rs', category: 'festival',
      title: 'Danube New Year Concert', local: 'Српска нова година на Дунаву',
      venue: 'Danube riverfront', city: 'Belgrade',
      start: '2027-01-13T21:00:00+01:00', end: '2027-01-14T02:00:00+01:00',
      blurb: 'Ring in the Orthodox New Year by the river: brass, rock and a midnight countdown under the fireworks.',
      photo: P('bn-D2bCvpik', 'photo-1533174072545-7a4b6ad7a6c3', 5760, 3844, 'A large crowd in front of a festival stage at night', 'Danny Howe', 'dannyhowe')
    },
    {
      id: 'sofia-electronic', country: 'bg', category: 'club',
      title: 'Sofia Electronic Winter', local: 'Софийска електронна зима',
      venue: 'Former factory hall', city: 'Sofia',
      start: '2027-02-12T22:00:00+02:00', end: '2027-02-14T06:00:00+02:00',
      blurb: 'Two nights of techno and Balkan-electronic crossover — gaida samples over four-to-the-floor — in a converted factory.',
      photo: P('ZhQCZjr9fHo', 'photo-1514525253161-7a46d19cd819', 3909, 2932, 'A club crowd in front of a stage washed in blue and pink light', 'Aditya Chinchure', 'adityachinchure')
    },
    {
      id: 'epidaurus-starlight', country: 'gr', category: 'classical',
      title: 'Epidaurus Starlight Concert', local: 'Συναυλία στο φως των αστεριών',
      venue: 'Ancient Theatre of Epidaurus', city: 'Epidaurus',
      start: '2027-06-26T21:00:00+03:00', end: '2027-06-26T23:30:00+03:00',
      blurb: 'A string orchestra in the ancient theatre’s perfect acoustics — a whisper on stage reaches the last row under a sky full of stars.',
      photo: P('4TNd3hsW3PM', 'photo-1551696785-927d4ac2d35b', 5472, 3648, 'Violinists of an orchestra performing in concert', 'Samuel Sianipar', 'samthewam24')
    },
    {
      id: 'cappadocia-sunrise', country: 'tr', category: 'festival',
      title: 'Cappadocia Sunrise Music Festival', local: 'Kapadokya Gündoğumu Müzik Festivali',
      venue: 'Valley stage', city: 'Göreme, Cappadocia',
      start: '2027-06-18T05:00:00+03:00', end: '2027-06-20T23:59:00+03:00',
      blurb: 'Sunrise sets among the fairy chimneys while hot-air balloons drift over the valley.',
      photo: P('OG9lz8PV3SM', 'photo-1642424209832-1c4e34b1f0de', 4752, 3168, 'A large festival crowd under a blue evening sky', 'Emediong Umoh', 'official_umoh')
    }
  ];

  const I18N = {
    en: {
      nav_upcoming: 'Upcoming', nav_past: 'Past events', nav_rhythms: 'Rhythms', nav_about: 'About',
      lang_label: 'Language', menu: 'Menu', close: 'Close', prev: 'Previous', next: 'Next',
      hero_kicker: 'Music across the Balkans',
      hero_title: 'Four flags. One rhythm.',
      hero_sub: 'Brass in Serbia, bagpipes in the Rhodopes, rebetiko under the Acropolis, the ney in Konya. Spin the flags and pick your night.',
      cta_events: 'See upcoming events', cta_rhythm: 'Play the rhythm', cta_stop: 'Stop the rhythm',
      hint: '← → keys · drag · swipe · scroll',
      show_country: 'Show events in {country}',
      filter_label: 'Filter by country', filter_all: 'All countries',
      upcoming_kicker: 'Coming soon', upcoming_title: 'Upcoming events', upcoming_sub: 'Pick an event and it spins to the front.',
      past_kicker: 'Encore', past_title: 'Past events', past_sub: 'Nights we are still humming.',
      starts_in: 'Starts in', u_d: 'days', u_h: 'hours', u_m: 'min', u_s: 'sec',
      live_now: 'Happening now', add_cal: 'Add to calendar', map: 'Open map',
      recap: 'Event recap', took_place: 'Took place on {date}',
      empty: 'No events here for this country yet. Try another flag.',
      rhythms_kicker: 'Surprise', rhythms_title: 'Feel the Balkan beat',
      rhythms_sub: 'Balkan music loves odd meters. Tap a country to hear its signature dance rhythm, played live in your browser.',
      about_title: 'About Balkania',
      about_text: 'Balkania is a love letter to the music of Bulgaria, Greece, Türkiye and Serbia, from village gatherings to festival stages. The events on this page are samples for a demo site.',
      newsletter_label: 'Get the next lineup in your inbox', newsletter_btn: 'Subscribe',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! You are on the list.',
      footer_photos: 'Photos from Unsplash', footer_sample: 'All events are fictional samples for demonstration.',
      photo_by: 'Photo by {name} on Unsplash',
      c_bg: 'Bulgaria', c_gr: 'Greece', c_tr: 'Türkiye', c_rs: 'Serbia',
      k_festival: 'Festival', k_folk: 'Folk', k_jazz: 'Jazz', k_brass: 'Brass', k_classical: 'Classical', k_sacred: 'Sacred', k_club: 'Club'
    },
    bg: {
      nav_upcoming: 'Предстоящи', nav_past: 'Минали събития', nav_rhythms: 'Ритми', nav_about: 'За нас',
      lang_label: 'Език', menu: 'Меню', close: 'Затвори', prev: 'Предишно', next: 'Следващо',
      hero_kicker: 'Музика от Балканите',
      hero_title: 'Четири знамена. Един ритъм.',
      hero_sub: 'Духова музика в Сърбия, гайди в Родопите, ребетико под Акропола, ней в Коня. Завъртете знамената и изберете своята вечер.',
      cta_events: 'Предстоящи събития', cta_rhythm: 'Пусни ритъма', cta_stop: 'Спри ритъма',
      hint: '← → клавиши · влачене · плъзгане · скрол',
      show_country: 'Събития в {country}',
      filter_label: 'Филтър по държава', filter_all: 'Всички държави',
      upcoming_kicker: 'Очаквайте', upcoming_title: 'Предстоящи събития', upcoming_sub: 'Изберете събитие и то ще се завърти напред.',
      past_kicker: 'Бис', past_title: 'Минали събития', past_sub: 'Вечери, които още си тананикаме.',
      starts_in: 'Започва след', u_d: 'дни', u_h: 'часа', u_m: 'мин', u_s: 'сек',
      live_now: 'Случва се сега', add_cal: 'Добави в календара', map: 'Виж на картата',
      recap: 'Как мина', took_place: 'Състоя се на {date}',
      empty: 'Все още няма събития за тази държава. Опитайте друго знаме.',
      rhythms_kicker: 'Изненада', rhythms_title: 'Почувствай балканския ритъм',
      rhythms_sub: 'Балканската музика обича неравноделните размери. Докоснете държава, за да чуете нейния танцов ритъм, изсвирен на живо в браузъра.',
      about_title: 'За Balkania',
      about_text: 'Balkania е любовно писмо към музиката на България, Гърция, Турция и Сърбия — от селските събори до фестивалните сцени. Събитията тук са примерни, за демонстрация.',
      newsletter_label: 'Получавайте следващата програма по имейл', newsletter_btn: 'Абонирай се',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Вече сте в списъка.',
      footer_photos: 'Снимки от Unsplash', footer_sample: 'Всички събития са измислени примери за демонстрация.',
      photo_by: 'Снимка: {name}, Unsplash',
      c_bg: 'България', c_gr: 'Гърция', c_tr: 'Турция', c_rs: 'Сърбия',
      k_festival: 'Фестивал', k_folk: 'Фолклор', k_jazz: 'Джаз', k_brass: 'Духова музика', k_classical: 'Класика', k_sacred: 'Духовна музика', k_club: 'Клубна музика'
    },
    el: {
      nav_upcoming: 'Προσεχώς', nav_past: 'Περασμένες', nav_rhythms: 'Ρυθμοί', nav_about: 'Σχετικά',
      lang_label: 'Γλώσσα', menu: 'Μενού', close: 'Κλείσιμο', prev: 'Προηγούμενο', next: 'Επόμενο',
      hero_kicker: 'Μουσική από τα Βαλκάνια',
      hero_title: 'Τέσσερις σημαίες. Ένας ρυθμός.',
      hero_sub: 'Χάλκινα στη Σερβία, γκάιντες στη Ροδόπη, ρεμπέτικο κάτω από την Ακρόπολη, νέι στο Ικόνιο. Γυρίστε τις σημαίες και διαλέξτε τη βραδιά σας.',
      cta_events: 'Δείτε τις προσεχείς', cta_rhythm: 'Παίξε τον ρυθμό', cta_stop: 'Σταμάτα τον ρυθμό',
      hint: '← → πλήκτρα · σύρσιμο · σάρωση · κύλιση',
      show_country: 'Εκδηλώσεις: {country}',
      filter_label: 'Φίλτρο ανά χώρα', filter_all: 'Όλες οι χώρες',
      upcoming_kicker: 'Έρχονται', upcoming_title: 'Προσεχείς εκδηλώσεις', upcoming_sub: 'Διαλέξτε μια εκδήλωση και θα γυρίσει μπροστά.',
      past_kicker: 'Μπις', past_title: 'Περασμένες εκδηλώσεις', past_sub: 'Βραδιές που ακόμα σιγοτραγουδάμε.',
      starts_in: 'Ξεκινά σε', u_d: 'ημέρες', u_h: 'ώρες', u_m: 'λεπ.', u_s: 'δευτ.',
      live_now: 'Γίνεται τώρα', add_cal: 'Προσθήκη στο ημερολόγιο', map: 'Άνοιγμα χάρτη',
      recap: 'Απολογισμός', took_place: 'Πραγματοποιήθηκε στις {date}',
      empty: 'Δεν υπάρχουν ακόμη εκδηλώσεις για αυτή τη χώρα. Δοκιμάστε άλλη σημαία.',
      rhythms_kicker: 'Έκπληξη', rhythms_title: 'Νιώσε τον βαλκανικό παλμό',
      rhythms_sub: 'Η βαλκανική μουσική αγαπά τα ασύμμετρα μέτρα. Πατήστε μια χώρα για να ακούσετε τον χορευτικό της ρυθμό, ζωντανά στον browser σας.',
      about_title: 'Σχετικά με το Balkania',
      about_text: 'Το Balkania είναι ένα ερωτικό γράμμα στη μουσική της Βουλγαρίας, της Ελλάδας, της Τουρκίας και της Σερβίας — από τα πανηγύρια ως τις σκηνές των φεστιβάλ. Οι εκδηλώσεις εδώ είναι ενδεικτικές, για επίδειξη.',
      newsletter_label: 'Λάβετε το επόμενο πρόγραμμα στο email σας', newsletter_btn: 'Εγγραφή',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Είστε στη λίστα.',
      footer_photos: 'Φωτογραφίες από το Unsplash', footer_sample: 'Όλες οι εκδηλώσεις είναι φανταστικά παραδείγματα για επίδειξη.',
      photo_by: 'Φωτογραφία: {name}, Unsplash',
      c_bg: 'Βουλγαρία', c_gr: 'Ελλάδα', c_tr: 'Τουρκία', c_rs: 'Σερβία',
      k_festival: 'Φεστιβάλ', k_folk: 'Παραδοσιακή', k_jazz: 'Τζαζ', k_brass: 'Χάλκινα', k_classical: 'Κλασική', k_sacred: 'Θρησκευτική', k_club: 'Κλαμπ'
    },
    tr: {
      nav_upcoming: 'Yaklaşan', nav_past: 'Geçmiş', nav_rhythms: 'Ritimler', nav_about: 'Hakkında',
      lang_label: 'Dil', menu: 'Menü', close: 'Kapat', prev: 'Önceki', next: 'Sonraki',
      hero_kicker: 'Balkanlar’dan müzik',
      hero_title: 'Dört bayrak. Tek ritim.',
      hero_sub: 'Sırbistan’da bando, Rodoplar’da gayda, Akropolis’in altında rebetiko, Konya’da ney. Bayrakları çevirin ve gecenizi seçin.',
      cta_events: 'Yaklaşan etkinlikler', cta_rhythm: 'Ritmi çal', cta_stop: 'Ritmi durdur',
      hint: '← → tuşlar · sürükle · kaydır · tekerlek',
      show_country: 'Etkinlikler: {country}',
      filter_label: 'Ülkeye göre filtrele', filter_all: 'Tüm ülkeler',
      upcoming_kicker: 'Yakında', upcoming_title: 'Yaklaşan etkinlikler', upcoming_sub: 'Bir etkinlik seçin, öne doğru dönsün.',
      past_kicker: 'Bis', past_title: 'Geçmiş etkinlikler', past_sub: 'Hâlâ mırıldandığımız geceler.',
      starts_in: 'Başlamasına', u_d: 'gün', u_h: 'saat', u_m: 'dk', u_s: 'sn',
      live_now: 'Şu anda sürüyor', add_cal: 'Takvime ekle', map: 'Haritada aç',
      recap: 'Etkinlik özeti', took_place: 'Tarih: {date}',
      empty: 'Bu ülke için henüz etkinlik yok. Başka bir bayrak deneyin.',
      rhythms_kicker: 'Sürpriz', rhythms_title: 'Balkan ritmini hisset',
      rhythms_sub: 'Balkan müziği aksak ritimleri sever. Bir ülkeye dokunun, imza dans ritmini tarayıcınızda canlı dinleyin.',
      about_title: 'Balkania hakkında',
      about_text: 'Balkania; Bulgaristan, Yunanistan, Türkiye ve Sırbistan müziğine yazılmış bir aşk mektubudur — köy şenliklerinden festival sahnelerine. Buradaki etkinlikler tanıtım amaçlı örneklerdir.',
      newsletter_label: 'Bir sonraki programı e-postanıza alın', newsletter_btn: 'Abone ol',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Listedesiniz.',
      footer_photos: 'Fotoğraflar Unsplash’ten', footer_sample: 'Tüm etkinlikler tanıtım amaçlı kurgusal örneklerdir.',
      photo_by: 'Fotoğraf: {name}, Unsplash',
      c_bg: 'Bulgaristan', c_gr: 'Yunanistan', c_tr: 'Türkiye', c_rs: 'Sırbistan',
      k_festival: 'Festival', k_folk: 'Halk müziği', k_jazz: 'Caz', k_brass: 'Bando', k_classical: 'Klasik', k_sacred: 'Tasavvuf', k_club: 'Kulüp'
    },
    sr: {
      nav_upcoming: 'Предстојеће', nav_past: 'Прошли догађаји', nav_rhythms: 'Ритмови', nav_about: 'О нама',
      lang_label: 'Језик', menu: 'Мени', close: 'Затвори', prev: 'Претходно', next: 'Следеће',
      hero_kicker: 'Музика са Балкана',
      hero_title: 'Четири заставе. Један ритам.',
      hero_sub: 'Трубе у Србији, гајде у Родопима, ребетико испод Акропоља, неј у Коњи. Заврти заставе и изабери своје вече.',
      cta_events: 'Предстојећи догађаји', cta_rhythm: 'Пусти ритам', cta_stop: 'Заустави ритам',
      hint: '← → тастери · превлачење · свајп · скрол',
      show_country: 'Догађаји: {country}',
      filter_label: 'Филтер по земљи', filter_all: 'Све земље',
      upcoming_kicker: 'Ускоро', upcoming_title: 'Предстојећи догађаји', upcoming_sub: 'Изабери догађај и окренуће се напред.',
      past_kicker: 'Бис', past_title: 'Прошли догађаји', past_sub: 'Вечери које још певушимо.',
      starts_in: 'Почиње за', u_d: 'дана', u_h: 'сати', u_m: 'мин', u_s: 'сек',
      live_now: 'Управо траје', add_cal: 'Додај у календар', map: 'Отвори мапу',
      recap: 'Како је било', took_place: 'Одржано {date}',
      empty: 'Још нема догађаја за ову земљу. Пробај другу заставу.',
      rhythms_kicker: 'Изненађење', rhythms_title: 'Осети балкански ритам',
      rhythms_sub: 'Балканска музика воли неправилне тактове. Додирни земљу да чујеш њен плесни ритам, одсвиран уживо у прегледачу.',
      about_title: 'О пројекту Balkania',
      about_text: 'Balkania је љубавно писмо музици Бугарске, Грчке, Турске и Србије — од сеоских сабора до фестивалских бина. Догађаји на овој страници су примери за демонстрацију.',
      newsletter_label: 'Добијај следећи програм на имејл', newsletter_btn: 'Пријави се',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! На листи си.',
      footer_photos: 'Фотографије са Unsplash-а', footer_sample: 'Сви догађаји су измишљени примери за демонстрацију.',
      photo_by: 'Фотографија: {name}, Unsplash',
      c_bg: 'Бугарска', c_gr: 'Грчка', c_tr: 'Турска', c_rs: 'Србија',
      k_festival: 'Фестивал', k_folk: 'Фолклор', k_jazz: 'Џез', k_brass: 'Трубачи', k_classical: 'Класика', k_sacred: 'Духовна музика', k_club: 'Клупска музика'
    }
  };

  const LOCALES = { en: 'en-GB', bg: 'bg-BG', el: 'el-GR', tr: 'tr-TR', sr: 'sr-Cyrl-RS' };

  return { COUNTRIES, RHYTHMS, EVENTS, I18N, LOCALES };
})();

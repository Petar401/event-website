/* Balkania — content data.
 * Events are illustrative samples set in real places. Photos are hotlinked
 * from Unsplash (as their API guidelines require) and always requested with
 * fit=max, so the CDN only resizes and never crops.
 *
 * Every event carries its text in all five site languages:
 *   t: { en: [title, venue, city, blurb, photoAlt], bg: [...], el: [...], tr: [...], sr: [...] }
 * The title in the event country's own language doubles as the "native" subtitle.
 *
 * Tickets: set `ticketUrl` to send buyers to an external box office; leave it
 * empty to use the built-in (demo) checkout with the tiers listed in `tickets`.
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
    bg: { meter: '7/8', groups: [2, 2, 3], bpm: 380, name: { en: 'Rachenitsa', bg: 'Ръченица', el: 'Ρατσενίτσα', tr: 'Raçenitsa', sr: 'Рученица' } },
    gr: { meter: '7/8', groups: [3, 2, 2], bpm: 330, name: { en: 'Kalamatianos', bg: 'Каламатианос', el: 'Καλαματιανός', tr: 'Kalamatianos', sr: 'Каламатијанос' } },
    tr: { meter: '9/8', groups: [2, 2, 2, 3], bpm: 360, name: { en: 'Karşılama', bg: 'Каршилама', el: 'Καρσιλαμάς', tr: 'Karşılama', sr: 'Каршилама' } },
    rs: { meter: '2/4', groups: [2, 2], bpm: 300, name: { en: 'Kolo', bg: 'Коло', el: 'Κόλο', tr: 'Kolo', sr: 'Коло' } }
  };

  const P = (id, path, w, h, author, username) => ({ id, path, w, h, author, username });
  const T = (currency, tiers) => ({ currency, tiers: tiers.map(([id, price, status]) => ({ id, price, status })) });

  const EVENTS = [
    {
      id: 'guca-brass', country: 'rs', category: 'brass', attendance: 60000,
      start: '2026-08-06T19:00:00+02:00', end: '2026-08-09T23:59:00+02:00',
      photo: P('Qga8Hcxu-bA', 'photo-1613941921908-be2113bfbd80', 5616, 3744, 'Lucas Alexander', 'ucaslexander'),
      t: {
        en: ['Guča Brass Nights', 'Festival field', 'Guča, Dragačevo', 'Three nights of fiery trumpet orchestras battling it out in the hills of Dragačevo — the loudest, happiest brass party in the Balkans.', 'A trumpet player performing on stage under warm light'],
        bg: ['Гучански нощи на духовите оркестри', 'Фестивалната поляна', 'Гуча, Драгачево', 'Три нощи огнени тромпетни оркестри се надсвирват в хълмовете на Драгачево — най-шумният и най-веселият духов купон на Балканите.', 'Тромпетист свири на сцена под топла светлина'],
        el: ['Νύχτες χάλκινων στη Γκούτσα', 'Χώρος του φεστιβάλ', 'Γκούτσα, Ντραγκάτσεβο', 'Τρεις νύχτες με φλογερές ορχήστρες τρομπέτας να αναμετριούνται στους λόφους του Ντραγκάτσεβο — το πιο δυνατό και χαρούμενο πάρτι χάλκινων στα Βαλκάνια.', 'Τρομπετίστας παίζει στη σκηνή κάτω από ζεστό φως'],
        tr: ['Guča Bando Geceleri', 'Festival alanı', 'Guča, Dragačevo', 'Dragačevo tepelerinde kıyasıya yarışan ateşli trompet orkestralarıyla üç gece — Balkanların en gürültülü, en neşeli bando şenliği.', 'Sıcak ışık altında sahnede trompet çalan bir müzisyen'],
        sr: ['Гучанске трубачке ноћи', 'Фестивалска ливада', 'Гуча, Драгачево', 'Три ноћи ватрених трубачких оркестара који се надсвиравају у брдима Драгачева — најгласнија и највеселија трубачка журка на Балкану.', 'Трубач свира на бини под топлим светлом']
      }
    },
    {
      id: 'fortress-sound', country: 'rs', category: 'festival', attendance: 45000,
      start: '2026-07-09T20:00:00+02:00', end: '2026-07-12T06:00:00+02:00',
      photo: P('aWXVxy8BSzc', 'photo-1506157786151-b8491531f063', 4896, 3264, 'Hanny Naibaho', 'hannynaibaho'),
      t: {
        en: ['Fortress Sound', 'Petrovaradin Fortress', 'Novi Sad', 'Four stages inside the 18th-century Petrovaradin Fortress above the Danube, and a crowd dancing until sunrise.', 'A festival crowd raising their hands towards a lit stage'],
        bg: ['Звукът на крепостта', 'Петроварадинската крепост', 'Нови Сад', 'Четири сцени в Петроварадинската крепост от XVIII век над Дунав и публика, която танцува до изгрев.', 'Фестивална публика вдига ръце към осветената сцена'],
        el: ['Ο ήχος του φρουρίου', 'Φρούριο Πετροβαραντίν', 'Νόβι Σαντ', 'Τέσσερις σκηνές μέσα στο φρούριο Πετροβαραντίν του 18ου αιώνα, πάνω από τον Δούναβη, και ένα πλήθος που χορεύει ως την ανατολή.', 'Πλήθος φεστιβάλ σηκώνει τα χέρια προς τη φωτισμένη σκηνή'],
        tr: ['Kale Sesi', 'Petrovaradin Kalesi', 'Novi Sad', 'Tuna’ya bakan 18. yüzyıldan kalma Petrovaradin Kalesi’nde dört sahne ve gün doğana kadar dans eden bir kalabalık.', 'Işıklı sahneye doğru ellerini kaldıran festival kalabalığı'],
        sr: ['Звук тврђаве', 'Петроварадинска тврђава', 'Нови Сад', 'Четири бине у Петроварадинској тврђави из 18. века изнад Дунава и публика која игра до свитања.', 'Фестивалска публика подиже руке ка осветљеној бини']
      }
    },
    {
      id: 'rhodope-bagpipes', country: 'bg', category: 'folk', attendance: 8000,
      start: '2026-07-25T10:00:00+03:00', end: '2026-07-26T20:00:00+03:00',
      photo: P('ctwCtGVXqqw', 'photo-1783231607560-0d7dd593be3c', 7008, 4672, 'Liviu Boldis', 'livioart'),
      t: {
        en: ['Rhodope Bagpipe Gathering', 'Rozhen meadows', 'Smolyan Province', 'A hundred kaba gaida bagpipes sound together on the Rozhen meadows, with horo dances and Rhodope songs echoing off the pines.', 'Musicians in traditional clothing playing folk instruments outdoors'],
        bg: ['Родопски гайдарски събор', 'Поляните на Рожен', 'Смолянска област', 'Сто каба гайди засвирват заедно на поляните на Рожен, а хора и родопски песни отекват сред боровете.', 'Музиканти в традиционни дрехи свирят на народни инструменти на открито'],
        el: ['Συνάντηση γκάιντας της Ροδόπης', 'Λιβάδια του Ρόζεν', 'Περιφέρεια Σμόλιαν', 'Εκατό γκάιντες κάμπα ηχούν μαζί στα λιβάδια του Ρόζεν, με χορούς και τραγούδια της Ροδόπης να αντηχούν ανάμεσα στα πεύκα.', 'Μουσικοί με παραδοσιακές φορεσιές παίζουν λαϊκά όργανα στο ύπαιθρο'],
        tr: ['Rodop Gayda Buluşması', 'Rojen çayırları', 'Smolyan ili', 'Rojen çayırlarında yüz kaba gayda birlikte çalıyor; horo dansları ve Rodop türküleri çam ağaçları arasında yankılanıyor.', 'Geleneksel kıyafetli müzisyenler açık havada halk çalgıları çalıyor'],
        sr: ['Родопски сабор гајдаша', 'Рожењске ливаде', 'Смољанска област', 'Сто каба гајди засвира заједно на ливадама Рожења, док ора и родопске песме одјекују међу боровима.', 'Музичари у традиционалној одећи свирају народне инструменте на отвореном']
      }
    },
    {
      id: 'burgas-beach', country: 'bg', category: 'festival', attendance: 22000,
      start: '2026-08-14T18:00:00+03:00', end: '2026-08-16T23:59:00+03:00',
      photo: P('UbrW6-p6JjU', 'photo-1786529453033-d5ebbce3af02', 4241, 2912, 'snap wander', 'passimage'),
      t: {
        en: ['Black Sea Beach Fest', 'North Beach', 'Burgas', 'Sand, sea breeze and golden-hour sets on the Burgas shoreline — indie, pop and Balkan beats until late.', 'A crowd on a beach at a music festival during golden hour'],
        bg: ['Черноморски плажен фест', 'Северният плаж', 'Бургас', 'Пясък, морски бриз и сетове по залез на брега на Бургас — инди, поп и балкански ритми до късно.', 'Публика на плажа по време на музикален фестивал по залез'],
        el: ['Φεστιβάλ παραλίας της Μαύρης Θάλασσας', 'Βόρεια παραλία', 'Μπουργκάς', 'Άμμος, θαλασσινή αύρα και σετ στη χρυσή ώρα στην ακτή του Μπουργκάς — indie, pop και βαλκανικοί ρυθμοί ως αργά.', 'Πλήθος σε παραλία σε μουσικό φεστιβάλ τη χρυσή ώρα'],
        tr: ['Karadeniz Plaj Festivali', 'Kuzey Plajı', 'Burgaz', 'Burgaz sahilinde kum, deniz meltemi ve gün batımı setleri — gece geç saatlere kadar indie, pop ve Balkan ritimleri.', 'Gün batımında bir müzik festivalinde plajdaki kalabalık'],
        sr: ['Црноморски фестивал на плажи', 'Северна плажа', 'Бургас', 'Песак, морски поветарац и сетови у златни сат на обали Бургаса — инди, поп и балкански ритмови до касно.', 'Публика на плажи на музичком фестивалу у златни сат']
      }
    },
    {
      id: 'rebetiko-acropolis', country: 'gr', category: 'folk', attendance: 3500,
      start: '2026-06-20T21:00:00+03:00', end: '2026-06-21T01:00:00+03:00',
      photo: P('bZury0_o204', 'photo-1778097925138-dda2340d8ea5', 5438, 3626, 'Milan Trninic', 'wedesignmarbella'),
      t: {
        en: ['Rebetiko Under the Acropolis', 'Philopappou Hill open-air stage', 'Athens', 'A summer night of rebetiko classics — bouzouki, baglamas and voice — with the Parthenon glowing above the audience.', 'Street musicians playing string instruments on a sunny day'],
        bg: ['Ребетико под Акропола', 'Открита сцена на хълма Филопапу', 'Атина', 'Лятна нощ с класики на ребетикото — бузуки, багламас и глас — а над публиката сияе Партенонът.', 'Улични музиканти свирят на струнни инструменти в слънчев ден'],
        el: ['Ρεμπέτικο κάτω από την Ακρόπολη', 'Υπαίθρια σκηνή στον λόφο Φιλοπάππου', 'Αθήνα', 'Μια καλοκαιρινή νύχτα με κλασικά ρεμπέτικα — μπουζούκι, μπαγλαμάς και φωνή — με τον Παρθενώνα να λάμπει πάνω από το κοινό.', 'Μουσικοί του δρόμου παίζουν έγχορδα σε μια ηλιόλουστη μέρα'],
        tr: ['Akropolis’in Altında Rebetiko', 'Filopappu Tepesi açık hava sahnesi', 'Atina', 'Rebetiko klasikleriyle bir yaz gecesi — buzuki, bağlama ve ses — seyircinin üzerinde parıldayan Partenon eşliğinde.', 'Güneşli bir günde telli çalgılar çalan sokak müzisyenleri'],
        sr: ['Ребетико испод Акропоља', 'Сцена на отвореном на брду Филопапу', 'Атина', 'Летња ноћ ребетико класика — бузуки, багламас и глас — док изнад публике сија Партенон.', 'Улични музичари свирају жичане инструменте једног сунчаног дана']
      }
    },
    {
      id: 'bosphorus-jazz', country: 'tr', category: 'jazz', attendance: 15000,
      start: '2026-07-03T19:00:00+03:00', end: '2026-07-10T23:59:00+03:00',
      photo: P('dBWvUqBoOU8', 'photo-1415201364774-f6f0bb35f28f', 4368, 2912, 'Jens Thekkeveettil', 'jensth'),
      t: {
        en: ['Bosphorus Jazz Week', 'Waterfront stages', 'Istanbul', 'Saxophones on the waterfront: a week of jazz clubs and open-air concerts on both sides of the Bosphorus.', 'A saxophonist playing at a colourful jazz concert'],
        bg: ['Седмица на джаза на Босфора', 'Сцени на брега', 'Истанбул', 'Саксофони на брега: седмица джаз клубове и концерти на открито от двете страни на Босфора.', 'Саксофонист свири на шарен джаз концерт'],
        el: ['Εβδομάδα τζαζ στον Βόσπορο', 'Σκηνές στην προκυμαία', 'Κωνσταντινούπολη', 'Σαξόφωνα στην προκυμαία: μια εβδομάδα με τζαζ κλαμπ και υπαίθριες συναυλίες και στις δύο πλευρές του Βοσπόρου.', 'Σαξοφωνίστας παίζει σε μια πολύχρωμη συναυλία τζαζ'],
        tr: ['Boğaziçi Caz Haftası', 'Sahil sahneleri', 'İstanbul', 'Sahilde saksafonlar: Boğaz’ın iki yakasında caz kulüpleri ve açık hava konserleriyle dolu bir hafta.', 'Renkli bir caz konserinde saksafon çalan müzisyen'],
        sr: ['Недеља џеза на Босфору', 'Бине на обали', 'Истанбул', 'Саксофони на обали: недеља џез клубова и концерата на отвореном на обе стране Босфора.', 'Саксофониста свира на шареном џез концерту']
      }
    },
    {
      id: 'belgrade-jazz', country: 'rs', category: 'jazz', ticketUrl: '',
      tickets: T('RSD', [['early', 1800, 'soldout'], ['ga', 2500, 'few'], ['vip', 6000, 'available']]),
      start: '2026-10-29T20:00:00+01:00', end: '2026-11-01T23:59:00+01:00',
      photo: P('z_disLOcoKM', 'photo-1725830071503-d705ef4a0975', 5115, 3410, 'Denny Müller', 'redaquamedia'),
      t: {
        en: ['Belgrade Jazz Autumn', 'Savamala riverside club', 'Belgrade', 'Smoky late-night sets and big-band evenings as the city opens its jazz season by the Sava.', 'A saxophone player performing in a dark club'],
        bg: ['Белградска джаз есен', 'Клуб на брега на Сава, Савамала', 'Белград', 'Нощни сетове в задимени клубове и вечери с биг бенд, докато градът открива джаз сезона на брега на Сава.', 'Саксофонист свири в тъмен клуб'],
        el: ['Φθινόπωρο τζαζ στο Βελιγράδι', 'Κλαμπ στην όχθη του Σάβα, Σαβαμάλα', 'Βελιγράδι', 'Μεταμεσονύχτια σετ σε καπνισμένα κλαμπ και βραδιές με big band, καθώς η πόλη ανοίγει τη σεζόν της τζαζ δίπλα στον Σάβα.', 'Σαξοφωνίστας παίζει σε ένα σκοτεινό κλαμπ'],
        tr: ['Belgrad Caz Sonbaharı', 'Savamala nehir kıyısı kulübü', 'Belgrad', 'Şehir, Sava kıyısında caz sezonunu açarken dumanlı gece setleri ve big band akşamları.', 'Karanlık bir kulüpte saksafon çalan müzisyen'],
        sr: ['Београдска џез јесен', 'Клуб на обали Саве, Савамала', 'Београд', 'Касноноћни сетови у задимљеним клубовима и биг бенд вечери док град отвара џез сезону на Сави.', 'Саксофониста свира у мрачном клубу']
      }
    },
    {
      id: 'bouzouki-night', country: 'gr', category: 'folk', ticketUrl: '',
      tickets: T('EUR', [['ga', 25, 'available'], ['vip', 45, 'few']]),
      start: '2026-11-21T21:30:00+02:00', end: '2026-11-22T02:00:00+02:00',
      photo: P('vUNzy_IZIGo', 'photo-1633592498337-cbec7c3ebcd3', 3452, 3024, 'Esmail Jlaly', 'esmail23'),
      t: {
        en: ['Bouzouki & Laïká Night', 'Ladadika music hall', 'Thessaloniki', 'An evening of laïká and Smyrna songs with a live string ensemble. Bring your voice — everyone sings the chorus.', 'A musician holding a long-necked wooden string instrument'],
        bg: ['Вечер на бузукито и лайка', 'Музикална зала в Лададика', 'Солун', 'Вечер на лайка и смирненски песни с жив струнен състав. Елате с глас — всички пеят припева.', 'Музикант държи дървен струнен инструмент с дълъг гриф'],
        el: ['Βραδιά μπουζουκιού & λαϊκών', 'Μουσική σκηνή στα Λαδάδικα', 'Θεσσαλονίκη', 'Μια βραδιά με λαϊκά και σμυρνέικα τραγούδια με ζωντανή κομπανία. Φέρτε τη φωνή σας — το ρεφρέν το τραγουδάνε όλοι.', 'Μουσικός κρατά ένα ξύλινο έγχορδο με μακρύ μπράτσο'],
        tr: ['Buzuki ve Laika Gecesi', 'Ladadika müzik salonu', 'Selanik', 'Canlı bir telli çalgı topluluğuyla laika ve İzmir şarkıları gecesi. Sesinizi getirin — nakaratı herkes söylüyor.', 'Uzun saplı ahşap bir telli çalgı tutan müzisyen'],
        sr: ['Вече бузукија и лаика', 'Музичка сала у Лададики', 'Солун', 'Вече лаика и смирнских песама уз живи гудачки састав. Понеси глас — рефрен певају сви.', 'Музичар држи дрвени жичани инструмент дугог врата']
      }
    },
    {
      id: 'sema-ney', country: 'tr', category: 'sacred', ticketUrl: '',
      tickets: T('TRY', [['ga', 900, 'few'], ['vip', 2000, 'soldout']]),
      start: '2026-12-17T19:30:00+03:00', end: '2026-12-17T22:00:00+03:00',
      photo: P('6lobNvryPs4', 'photo-1764099363036-af650bca3cd7', 5730, 3820, 'Karwin Luo', 'karw1n'),
      t: {
        en: ['Sema & Ney', 'Cultural centre hall', 'Konya', 'The breath of the ney flute, kudüm drums and the turning Mevlevi sema — a meditative night of Sufi music.', 'Whirling dervishes in white robes performing the sema'],
        bg: ['Сема и ней', 'Зала на културния център', 'Коня', 'Дъхът на флейтата ней, барабаните кудюм и въртящата се мевлевийска сема — медитативна нощ на суфийска музика.', 'Въртящи се дервиши в бели одежди изпълняват сема'],
        el: ['Σεμά και νέι', 'Αίθουσα πολιτιστικού κέντρου', 'Ικόνιο', 'Η ανάσα του νέι, τα τύμπανα κουντούμ και η περιστροφή της σεμά των Μεβλεβί — μια διαλογιστική βραδιά σουφικής μουσικής.', 'Περιστρεφόμενοι δερβίσηδες με λευκούς χιτώνες εκτελούν τη σεμά'],
        tr: ['Sema ve Ney Gecesi', 'Kültür merkezi salonu', 'Konya', 'Neyin nefesi, kudüm sesleri ve dönen Mevlevi seması — tasavvuf müziğiyle dolu, huzur veren bir gece.', 'Beyaz tennureli semazenler sema ediyor'],
        sr: ['Сема и неј', 'Сала културног центра', 'Коња', 'Дах неј фруле, бубњеви кудум и вртложна мевлевијска сема — медитативна ноћ суфијске музике.', 'Дервиши у белим одорама изводе сему']
      }
    },
    {
      id: 'bulgarian-voices', country: 'bg', category: 'classical', ticketUrl: '',
      tickets: T('EUR', [['early', 20, 'soldout'], ['ga', 30, 'few'], ['vip', 60, 'available']]),
      start: '2026-12-20T19:00:00+02:00', end: '2026-12-20T21:30:00+02:00',
      photo: P('ZaZcvU_WuF8', 'photo-1720186576697-24c1496a07e1', 6000, 4000, 'Green Liu', 'greenliustudio'),
      t: {
        en: ['Bulgarian Voices Christmas Gala', 'Concert hall', 'Sofia', 'Bulgaria’s legendary polyphonic female voices meet a chamber choir for a candle-lit Christmas concert.', 'A choir singing in front of an ornate golden altar'],
        bg: ['Коледен концерт „Български гласове“', 'Концертна зала', 'София', 'Легендарните многогласни женски гласове на България се срещат с камерен хор за коледен концерт на свещи.', 'Хор пее пред богато украсен златен олтар'],
        el: ['Χριστουγεννιάτικη γιορτή «Βουλγαρικές φωνές»', 'Αίθουσα συναυλιών', 'Σόφια', 'Οι θρυλικές πολυφωνικές γυναικείες φωνές της Βουλγαρίας συναντούν μια χορωδία δωματίου σε μια χριστουγεννιάτικη συναυλία υπό το φως των κεριών.', 'Χορωδία τραγουδά μπροστά σε περίτεχνο χρυσό ιερό'],
        tr: ['“Bulgar Sesleri” Noel Galası', 'Konser salonu', 'Sofya', 'Bulgaristan’ın efsanevi çok sesli kadın vokalleri, mum ışığında bir Noel konserinde oda korosuyla buluşuyor.', 'Süslü, altın bir sunağın önünde şarkı söyleyen koro'],
        sr: ['Божићни гала концерт „Бугарски гласови“', 'Концертна дворана', 'Софија', 'Легендарни вишегласни женски гласови Бугарске сусрећу се са камерним хором на божићном концерту уз свеће.', 'Хор пева испред раскошног позлаћеног олтара']
      }
    },
    {
      id: 'danube-new-year', country: 'rs', category: 'festival', ticketUrl: '',
      tickets: T('RSD', [['ga', 1500, 'available'], ['vip', 8000, 'few']]),
      start: '2027-01-13T21:00:00+01:00', end: '2027-01-14T02:00:00+01:00',
      photo: P('bn-D2bCvpik', 'photo-1533174072545-7a4b6ad7a6c3', 5760, 3844, 'Danny Howe', 'dannyhowe'),
      t: {
        en: ['Danube New Year Concert', 'Danube riverfront', 'Belgrade', 'Ring in the Orthodox New Year by the river: brass, rock and a midnight countdown under the fireworks.', 'A large crowd in front of a festival stage at night'],
        bg: ['Новогодишен концерт на Дунав', 'Брегът на Дунав', 'Белград', 'Посрещнете Православната Нова година край реката: духова музика, рок и обратно броене в полунощ под фойерверките.', 'Голяма публика пред фестивална сцена през нощта'],
        el: ['Πρωτοχρονιάτικη συναυλία στον Δούναβη', 'Όχθη του Δούναβη', 'Βελιγράδι', 'Υποδεχτείτε την Ορθόδοξη Πρωτοχρονιά δίπλα στο ποτάμι: χάλκινα, ροκ και αντίστροφη μέτρηση τα μεσάνυχτα κάτω από τα πυροτεχνήματα.', 'Μεγάλο πλήθος μπροστά σε σκηνή φεστιβάλ τη νύχτα'],
        tr: ['Tuna’da Yılbaşı Konseri', 'Tuna kıyısı', 'Belgrad', 'Ortodoks Yılbaşı’nı nehir kıyısında karşılayın: bando, rock ve havai fişekler altında gece yarısı geri sayımı.', 'Gece bir festival sahnesinin önündeki büyük kalabalık'],
        sr: ['Новогодишњи концерт на Дунаву', 'Обала Дунава', 'Београд', 'Дочекај Српску нову годину поред реке: трубе, рок и одбројавање у поноћ под ватрометом.', 'Велика публика испред фестивалске бине ноћу']
      }
    },
    {
      id: 'sofia-electronic', country: 'bg', category: 'club', ticketUrl: '',
      tickets: T('EUR', [['early', 25, 'soldout'], ['ga', 35, 'available'], ['vip', 60, 'available']]),
      start: '2027-02-12T22:00:00+02:00', end: '2027-02-14T06:00:00+02:00',
      photo: P('ZhQCZjr9fHo', 'photo-1514525253161-7a46d19cd819', 3909, 2932, 'Aditya Chinchure', 'adityachinchure'),
      t: {
        en: ['Sofia Electronic Winter', 'Former factory hall', 'Sofia', 'Two nights of techno and Balkan-electronic crossover — gaida samples over four-to-the-floor — in a converted factory.', 'A club crowd in front of a stage washed in blue and pink light'],
        bg: ['Софийска електронна зима', 'Бивш фабричен цех', 'София', 'Две нощи техно и балканска електроника — семпли от гайда върху прав бас — в преустроена фабрика.', 'Клубна публика пред сцена в синя и розова светлина'],
        el: ['Ηλεκτρονικός χειμώνας της Σόφιας', 'Πρώην εργοστάσιο', 'Σόφια', 'Δύο νύχτες techno και βαλκανικής ηλεκτρονικής — samples από γκάιντα πάνω σε four-to-the-floor — σε ένα ανακαινισμένο εργοστάσιο.', 'Πλήθος σε κλαμπ μπροστά σε σκηνή λουσμένη σε μπλε και ροζ φως'],
        tr: ['Sofya Elektronik Kışı', 'Eski fabrika salonu', 'Sofya', 'Dönüştürülmüş bir fabrikada iki gece tekno ve Balkan elektronik füzyonu — dört vuruşluk ritim üzerinde gayda sample’ları.', 'Mavi ve pembe ışıklarla yıkanan sahnenin önündeki kulüp kalabalığı'],
        sr: ['Софијска електронска зима', 'Бивша фабричка хала', 'Софија', 'Две ноћи техна и балканске електронике — семплови гајди преко равног бита — у преуређеној фабрици.', 'Клупска публика испред бине окупане плавим и ружичастим светлом']
      }
    },
    {
      id: 'epidaurus-starlight', country: 'gr', category: 'classical', ticketUrl: '',
      tickets: T('EUR', [['ga', 40, 'available'], ['vip', 90, 'few']]),
      start: '2027-06-26T21:00:00+03:00', end: '2027-06-26T23:30:00+03:00',
      photo: P('4TNd3hsW3PM', 'photo-1551696785-927d4ac2d35b', 5472, 3648, 'Samuel Sianipar', 'samthewam24'),
      t: {
        en: ['Epidaurus Starlight Concert', 'Ancient Theatre of Epidaurus', 'Epidaurus', 'A string orchestra in the ancient theatre’s perfect acoustics — a whisper on stage reaches the last row under a sky full of stars.', 'Violinists of an orchestra performing in concert'],
        bg: ['Концерт под звездите в Епидавър', 'Античният театър в Епидавър', 'Епидавър', 'Струнен оркестър в съвършената акустика на античния театър — шепотът от сцената стига до последния ред под небе, пълно със звезди.', 'Цигулари от оркестър на концерт'],
        el: ['Συναυλία υπό το φως των αστεριών', 'Αρχαίο Θέατρο Επιδαύρου', 'Επίδαυρος', 'Μια ορχήστρα εγχόρδων στην τέλεια ακουστική του αρχαίου θεάτρου — ένας ψίθυρος στη σκηνή φτάνει ως την τελευταία σειρά, κάτω από έναν ουρανό γεμάτο αστέρια.', 'Βιολονίστες ορχήστρας σε συναυλία'],
        tr: ['Epidavros’ta Yıldızlar Altında Konser', 'Epidavros Antik Tiyatrosu', 'Epidavros', 'Antik tiyatronun kusursuz akustiğinde bir yaylı çalgılar orkestrası — sahnedeki bir fısıltı, yıldızlarla dolu gökyüzü altında son sıraya ulaşıyor.', 'Konserde çalan bir orkestranın kemancıları'],
        sr: ['Концерт под звездама у Епидауру', 'Античко позориште у Епидауру', 'Епидаур', 'Гудачки оркестар у савршеној акустици античког позоришта — шапат са сцене стиже до последњег реда под небом пуним звезда.', 'Виолинисти оркестра на концерту']
      }
    },
    {
      id: 'cappadocia-sunrise', country: 'tr', category: 'festival', ticketUrl: '',
      tickets: T('TRY', [['early', 2500, 'soldout'], ['ga', 3500, 'available'], ['vip', 7500, 'few']]),
      start: '2027-06-18T05:00:00+03:00', end: '2027-06-20T23:59:00+03:00',
      photo: P('OG9lz8PV3SM', 'photo-1642424209832-1c4e34b1f0de', 4752, 3168, 'Emediong Umoh', 'official_umoh'),
      t: {
        en: ['Cappadocia Sunrise Music Festival', 'Valley stage', 'Göreme, Cappadocia', 'Sunrise sets among the fairy chimneys while hot-air balloons drift over the valley.', 'A large festival crowd under a blue evening sky'],
        bg: ['Музикален фестивал „Изгрев в Кападокия“', 'Сцена в долината', 'Гьореме, Кападокия', 'Сетове по изгрев сред „приказните комини“, докато балони с горещ въздух се носят над долината.', 'Голяма фестивална публика под синьо вечерно небе'],
        el: ['Μουσικό φεστιβάλ «Ανατολή στην Καππαδοκία»', 'Σκηνή στην κοιλάδα', 'Γκιόρεμε, Καππαδοκία', 'Σετ στην ανατολή του ηλίου ανάμεσα στις «καμινάδες των νεράιδων», ενώ αερόστατα πλανιούνται πάνω από την κοιλάδα.', 'Μεγάλο πλήθος φεστιβάλ κάτω από γαλάζιο βραδινό ουρανό'],
        tr: ['Kapadokya Gündoğumu Müzik Festivali', 'Vadi sahnesi', 'Göreme, Kapadokya', 'Peri bacaları arasında gündoğumu setleri, vadinin üzerinde süzülen sıcak hava balonları eşliğinde.', 'Mavi akşam göğü altında büyük bir festival kalabalığı'],
        sr: ['Музички фестивал „Излазак сунца у Кападокији“', 'Бина у долини', 'Гереме, Кападокија', 'Сетови у свитање међу „вилинским димњацима“ док балони на топли ваздух лебде изнад долине.', 'Велика фестивалска публика под плавим вечерњим небом']
      }
    }
  ];

  const I18N = {
    en: {
      doc_title: 'Balkania — Music events across the Balkans',
      doc_desc: 'Upcoming and past music events in Bulgaria, Greece, Türkiye and Serbia — brass, folk, jazz, sacred and festival nights. Book your tickets.',
      skip: 'Skip to events', home: 'Balkania home', countries_label: 'Countries',
      nav_upcoming: 'Upcoming', nav_past: 'Past events', nav_rhythms: 'Rhythms', nav_about: 'About', nav_tickets: 'Tickets',
      lang_label: 'Language', menu: 'Menu', close: 'Close', prev: 'Previous', next: 'Next',
      hero_kicker: 'Music across the Balkans',
      hero_title: 'Four flags. One rhythm.',
      hero_sub: 'Brass in Serbia, bagpipes in the Rhodopes, rebetiko under the Acropolis, the ney in Konya. Spin the flags and pick your night.',
      next_up: 'Next up',
      cta_events: 'See upcoming events', cta_rhythm: 'Play the rhythm', cta_stop: 'Stop the rhythm',
      hint: '← → keys · drag · swipe · scroll',
      show_country: 'Show events in {country}',
      filter_label: 'Filter by country', filter_all: 'All countries',
      upcoming_kicker: 'Coming soon', upcoming_title: 'Upcoming events', upcoming_sub: 'Pick an event and it spins to the front.',
      past_kicker: 'Encore', past_title: 'Past events', past_sub: 'Nights we are still humming.',
      starts_in: 'Starts in', u_d: 'days', u_h: 'hours', u_m: 'min', u_s: 'sec',
      live_now: 'Happening now', add_cal: 'Add to calendar', map: 'Open map',
      recap: 'Event recap', took_place: 'Took place on {date}', guests: '{n} guests',
      empty: 'No events here for this country yet. Try another flag.',
      buy_tickets: 'Buy tickets', from_price: 'From {price}', selling_fast: 'Selling fast', sold_out: 'Sold out', few_left: 'Few left', available: 'Available',
      tier_early: 'Early bird', tier_early_desc: 'Discounted price for the first tickets',
      tier_ga: 'General admission', tier_ga_desc: 'Entry to all stages and areas',
      tier_vip: 'VIP', tier_vip_desc: 'Best view, fast-track entry and a welcome drink',
      qty_less: 'Remove one', qty_more: 'Add one',
      choose_tickets: 'Choose your tickets', your_order: 'Your order', total: 'Total',
      continue: 'Continue', back: 'Back', confirm: 'Confirm order', done: 'Done',
      name_on_ticket: 'Name on ticket', name_placeholder: 'Your name', ticket_holder: 'Ticket holder', guest: 'Guest',
      demo_note: 'Demo checkout — no payment is taken.',
      ticket_ready: 'Your tickets are ready!', ticket_hint: 'Show this QR code at the entrance.', order_no: 'Order',
      rhythms_kicker: 'Surprise', rhythms_title: 'Feel the Balkan beat',
      rhythms_sub: 'Balkan music loves odd meters. Tap a country to hear its signature dance rhythm, played live in your browser.',
      about_title: 'About Balkania',
      about_text: 'Balkania is a love letter to the music of Bulgaria, Greece, Türkiye and Serbia, from village gatherings to festival stages. We pick the nights worth travelling for and get you through the door.',
      newsletter_label: 'Get the next lineup in your inbox', newsletter_btn: 'Subscribe',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! You are on the list.',
      footer_photos: 'Photos from Unsplash', footer_sample: 'Demo website — events and tickets are illustrative.',
      photo_by: 'Photo by {name} on Unsplash',
      c_bg: 'Bulgaria', c_gr: 'Greece', c_tr: 'Türkiye', c_rs: 'Serbia',
      k_festival: 'Festival', k_folk: 'Folk', k_jazz: 'Jazz', k_brass: 'Brass', k_classical: 'Classical', k_sacred: 'Sacred', k_club: 'Club'
    },
    bg: {
      doc_title: 'Balkania — Музикални събития на Балканите',
      doc_desc: 'Предстоящи и минали музикални събития в България, Гърция, Турция и Сърбия — духова музика, фолклор, джаз и фестивали. Купете билети.',
      skip: 'Към събитията', home: 'Начало на Balkania', countries_label: 'Държави',
      nav_upcoming: 'Предстоящи', nav_past: 'Минали събития', nav_rhythms: 'Ритми', nav_about: 'За нас', nav_tickets: 'Билети',
      lang_label: 'Език', menu: 'Меню', close: 'Затвори', prev: 'Предишно', next: 'Следващо',
      hero_kicker: 'Музика от Балканите',
      hero_title: 'Четири знамена. Един ритъм.',
      hero_sub: 'Духова музика в Сърбия, гайди в Родопите, ребетико под Акропола, ней в Коня. Завъртете знамената и изберете своята вечер.',
      next_up: 'Следва',
      cta_events: 'Предстоящи събития', cta_rhythm: 'Пусни ритъма', cta_stop: 'Спри ритъма',
      hint: '← → клавиши · влачене · плъзгане · скрол',
      show_country: 'Събития в {country}',
      filter_label: 'Филтър по държава', filter_all: 'Всички държави',
      upcoming_kicker: 'Очаквайте', upcoming_title: 'Предстоящи събития', upcoming_sub: 'Изберете събитие и то ще се завърти напред.',
      past_kicker: 'Бис', past_title: 'Минали събития', past_sub: 'Вечери, които още си тананикаме.',
      starts_in: 'Започва след', u_d: 'дни', u_h: 'часа', u_m: 'мин', u_s: 'сек',
      live_now: 'Случва се сега', add_cal: 'Добави в календара', map: 'Виж на картата',
      recap: 'Как мина', took_place: 'Състоя се на {date}', guests: '{n} посетители',
      empty: 'Все още няма събития за тази държава. Опитайте друго знаме.',
      buy_tickets: 'Купи билети', from_price: 'От {price}', selling_fast: 'Продават се бързо', sold_out: 'Разпродадено', few_left: 'Последни бройки', available: 'Налични',
      tier_early: 'Ранна цена', tier_early_desc: 'Намалена цена за първите билети',
      tier_ga: 'Общ вход', tier_ga_desc: 'Вход за всички сцени и зони',
      tier_vip: 'VIP', tier_vip_desc: 'Най-добра гледка, бърз вход и напитка за добре дошли',
      qty_less: 'Премахни един', qty_more: 'Добави един',
      choose_tickets: 'Изберете билети', your_order: 'Вашата поръчка', total: 'Общо',
      continue: 'Продължи', back: 'Назад', confirm: 'Потвърди поръчката', done: 'Готово',
      name_on_ticket: 'Име на билета', name_placeholder: 'Вашето име', ticket_holder: 'Притежател', guest: 'Гост',
      demo_note: 'Демо поръчка — не се извършва плащане.',
      ticket_ready: 'Билетите ви са готови!', ticket_hint: 'Покажете този QR код на входа.', order_no: 'Поръчка',
      rhythms_kicker: 'Изненада', rhythms_title: 'Почувствай балканския ритъм',
      rhythms_sub: 'Балканската музика обича неравноделните размери. Докоснете държава, за да чуете нейния танцов ритъм, изсвирен на живо в браузъра.',
      about_title: 'За Balkania',
      about_text: 'Balkania е любовно писмо към музиката на България, Гърция, Турция и Сърбия — от селските събори до фестивалните сцени. Избираме вечерите, заради които си струва да пътувате, и ви осигуряваме място.',
      newsletter_label: 'Получавайте следващата програма по имейл', newsletter_btn: 'Абонирай се',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Вече сте в списъка.',
      footer_photos: 'Снимки от Unsplash', footer_sample: 'Демо сайт — събитията и билетите са примерни.',
      photo_by: 'Снимка: {name}, Unsplash',
      c_bg: 'България', c_gr: 'Гърция', c_tr: 'Турция', c_rs: 'Сърбия',
      k_festival: 'Фестивал', k_folk: 'Фолклор', k_jazz: 'Джаз', k_brass: 'Духова музика', k_classical: 'Класика', k_sacred: 'Духовна музика', k_club: 'Клубна музика'
    },
    el: {
      doc_title: 'Balkania — Μουσικές εκδηλώσεις στα Βαλκάνια',
      doc_desc: 'Προσεχείς και περασμένες μουσικές εκδηλώσεις σε Βουλγαρία, Ελλάδα, Τουρκία και Σερβία — χάλκινα, παραδοσιακά, τζαζ και φεστιβάλ. Κλείστε εισιτήρια.',
      skip: 'Μετάβαση στις εκδηλώσεις', home: 'Αρχική σελίδα Balkania', countries_label: 'Χώρες',
      nav_upcoming: 'Προσεχώς', nav_past: 'Περασμένες', nav_rhythms: 'Ρυθμοί', nav_about: 'Σχετικά', nav_tickets: 'Εισιτήρια',
      lang_label: 'Γλώσσα', menu: 'Μενού', close: 'Κλείσιμο', prev: 'Προηγούμενο', next: 'Επόμενο',
      hero_kicker: 'Μουσική από τα Βαλκάνια',
      hero_title: 'Τέσσερις σημαίες. Ένας ρυθμός.',
      hero_sub: 'Χάλκινα στη Σερβία, γκάιντες στη Ροδόπη, ρεμπέτικο κάτω από την Ακρόπολη, νέι στο Ικόνιο. Γυρίστε τις σημαίες και διαλέξτε τη βραδιά σας.',
      next_up: 'Επόμενη',
      cta_events: 'Δείτε τις προσεχείς', cta_rhythm: 'Παίξε τον ρυθμό', cta_stop: 'Σταμάτα τον ρυθμό',
      hint: '← → πλήκτρα · σύρσιμο · σάρωση · κύλιση',
      show_country: 'Εκδηλώσεις: {country}',
      filter_label: 'Φίλτρο ανά χώρα', filter_all: 'Όλες οι χώρες',
      upcoming_kicker: 'Έρχονται', upcoming_title: 'Προσεχείς εκδηλώσεις', upcoming_sub: 'Διαλέξτε μια εκδήλωση και θα γυρίσει μπροστά.',
      past_kicker: 'Μπις', past_title: 'Περασμένες εκδηλώσεις', past_sub: 'Βραδιές που ακόμα σιγοτραγουδάμε.',
      starts_in: 'Ξεκινά σε', u_d: 'ημέρες', u_h: 'ώρες', u_m: 'λεπ.', u_s: 'δευτ.',
      live_now: 'Γίνεται τώρα', add_cal: 'Προσθήκη στο ημερολόγιο', map: 'Άνοιγμα χάρτη',
      recap: 'Απολογισμός', took_place: 'Πραγματοποιήθηκε στις {date}', guests: '{n} επισκέπτες',
      empty: 'Δεν υπάρχουν ακόμη εκδηλώσεις για αυτή τη χώρα. Δοκιμάστε άλλη σημαία.',
      buy_tickets: 'Αγορά εισιτηρίων', from_price: 'Από {price}', selling_fast: 'Φεύγουν γρήγορα', sold_out: 'Εξαντλήθηκαν', few_left: 'Λίγα έμειναν', available: 'Διαθέσιμα',
      tier_early: 'Προπώληση', tier_early_desc: 'Μειωμένη τιμή για τα πρώτα εισιτήρια',
      tier_ga: 'Γενική είσοδος', tier_ga_desc: 'Είσοδος σε όλες τις σκηνές και τους χώρους',
      tier_vip: 'VIP', tier_vip_desc: 'Καλύτερη θέα, γρήγορη είσοδος και ποτό καλωσορίσματος',
      qty_less: 'Αφαίρεση ενός', qty_more: 'Προσθήκη ενός',
      choose_tickets: 'Επιλέξτε εισιτήρια', your_order: 'Η παραγγελία σας', total: 'Σύνολο',
      continue: 'Συνέχεια', back: 'Πίσω', confirm: 'Επιβεβαίωση παραγγελίας', done: 'Τέλος',
      name_on_ticket: 'Όνομα στο εισιτήριο', name_placeholder: 'Το όνομά σας', ticket_holder: 'Κάτοχος', guest: 'Επισκέπτης',
      demo_note: 'Δοκιμαστική αγορά — δεν γίνεται καμία χρέωση.',
      ticket_ready: 'Τα εισιτήριά σας είναι έτοιμα!', ticket_hint: 'Δείξτε αυτόν τον κωδικό QR στην είσοδο.', order_no: 'Παραγγελία',
      rhythms_kicker: 'Έκπληξη', rhythms_title: 'Νιώσε τον βαλκανικό παλμό',
      rhythms_sub: 'Η βαλκανική μουσική αγαπά τα ασύμμετρα μέτρα. Πατήστε μια χώρα για να ακούσετε τον χορευτικό της ρυθμό, ζωντανά στον browser σας.',
      about_title: 'Σχετικά με το Balkania',
      about_text: 'Το Balkania είναι ένα ερωτικό γράμμα στη μουσική της Βουλγαρίας, της Ελλάδας, της Τουρκίας και της Σερβίας — από τα πανηγύρια ως τις σκηνές των φεστιβάλ. Διαλέγουμε τις βραδιές που αξίζουν το ταξίδι και σας εξασφαλίζουμε θέση.',
      newsletter_label: 'Λάβετε το επόμενο πρόγραμμα στο email σας', newsletter_btn: 'Εγγραφή',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Είστε στη λίστα.',
      footer_photos: 'Φωτογραφίες από το Unsplash', footer_sample: 'Δοκιμαστικός ιστότοπος — οι εκδηλώσεις και τα εισιτήρια είναι ενδεικτικά.',
      photo_by: 'Φωτογραφία: {name}, Unsplash',
      c_bg: 'Βουλγαρία', c_gr: 'Ελλάδα', c_tr: 'Τουρκία', c_rs: 'Σερβία',
      k_festival: 'Φεστιβάλ', k_folk: 'Παραδοσιακή', k_jazz: 'Τζαζ', k_brass: 'Χάλκινα', k_classical: 'Κλασική', k_sacred: 'Θρησκευτική', k_club: 'Κλαμπ'
    },
    tr: {
      doc_title: 'Balkania — Balkanlar’da müzik etkinlikleri',
      doc_desc: 'Bulgaristan, Yunanistan, Türkiye ve Sırbistan’da yaklaşan ve geçmiş müzik etkinlikleri — bando, halk müziği, caz ve festivaller. Biletinizi alın.',
      skip: 'Etkinliklere geç', home: 'Balkania ana sayfa', countries_label: 'Ülkeler',
      nav_upcoming: 'Yaklaşan', nav_past: 'Geçmiş', nav_rhythms: 'Ritimler', nav_about: 'Hakkında', nav_tickets: 'Biletler',
      lang_label: 'Dil', menu: 'Menü', close: 'Kapat', prev: 'Önceki', next: 'Sonraki',
      hero_kicker: 'Balkanlar’dan müzik',
      hero_title: 'Dört bayrak. Tek ritim.',
      hero_sub: 'Sırbistan’da bando, Rodoplar’da gayda, Akropolis’in altında rebetiko, Konya’da ney. Bayrakları çevirin ve gecenizi seçin.',
      next_up: 'Sıradaki',
      cta_events: 'Yaklaşan etkinlikler', cta_rhythm: 'Ritmi çal', cta_stop: 'Ritmi durdur',
      hint: '← → tuşlar · sürükle · kaydır · tekerlek',
      show_country: 'Etkinlikler: {country}',
      filter_label: 'Ülkeye göre filtrele', filter_all: 'Tüm ülkeler',
      upcoming_kicker: 'Yakında', upcoming_title: 'Yaklaşan etkinlikler', upcoming_sub: 'Bir etkinlik seçin, öne doğru dönsün.',
      past_kicker: 'Bis', past_title: 'Geçmiş etkinlikler', past_sub: 'Hâlâ mırıldandığımız geceler.',
      starts_in: 'Başlamasına', u_d: 'gün', u_h: 'saat', u_m: 'dk', u_s: 'sn',
      live_now: 'Şu anda sürüyor', add_cal: 'Takvime ekle', map: 'Haritada aç',
      recap: 'Etkinlik özeti', took_place: 'Tarih: {date}', guests: '{n} misafir',
      empty: 'Bu ülke için henüz etkinlik yok. Başka bir bayrak deneyin.',
      buy_tickets: 'Bilet al', from_price: 'Başlangıç: {price}', selling_fast: 'Hızla tükeniyor', sold_out: 'Tükendi', few_left: 'Son biletler', available: 'Mevcut',
      tier_early: 'Erken bilet', tier_early_desc: 'İlk biletlere özel indirimli fiyat',
      tier_ga: 'Genel giriş', tier_ga_desc: 'Tüm sahnelere ve alanlara giriş',
      tier_vip: 'VIP', tier_vip_desc: 'En iyi manzara, hızlı giriş ve karşılama içeceği',
      qty_less: 'Bir azalt', qty_more: 'Bir artır',
      choose_tickets: 'Biletlerinizi seçin', your_order: 'Siparişiniz', total: 'Toplam',
      continue: 'Devam et', back: 'Geri', confirm: 'Siparişi onayla', done: 'Tamam',
      name_on_ticket: 'Bilet üzerindeki ad', name_placeholder: 'Adınız', ticket_holder: 'Bilet sahibi', guest: 'Misafir',
      demo_note: 'Demo ödeme — hiçbir ücret alınmaz.',
      ticket_ready: 'Biletleriniz hazır!', ticket_hint: 'Bu QR kodunu girişte gösterin.', order_no: 'Sipariş',
      rhythms_kicker: 'Sürpriz', rhythms_title: 'Balkan ritmini hisset',
      rhythms_sub: 'Balkan müziği aksak ritimleri sever. Bir ülkeye dokunun, imza dans ritmini tarayıcınızda canlı dinleyin.',
      about_title: 'Balkania hakkında',
      about_text: 'Balkania; Bulgaristan, Yunanistan, Türkiye ve Sırbistan müziğine yazılmış bir aşk mektubudur — köy şenliklerinden festival sahnelerine. Yolculuğa değecek geceleri seçiyor, size yer ayırıyoruz.',
      newsletter_label: 'Bir sonraki programı e-postanıza alın', newsletter_btn: 'Abone ol',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! Listedesiniz.',
      footer_photos: 'Fotoğraflar Unsplash’ten', footer_sample: 'Demo web sitesi — etkinlikler ve biletler örnek amaçlıdır.',
      photo_by: 'Fotoğraf: {name}, Unsplash',
      c_bg: 'Bulgaristan', c_gr: 'Yunanistan', c_tr: 'Türkiye', c_rs: 'Sırbistan',
      k_festival: 'Festival', k_folk: 'Halk müziği', k_jazz: 'Caz', k_brass: 'Bando', k_classical: 'Klasik', k_sacred: 'Tasavvuf', k_club: 'Kulüp'
    },
    sr: {
      doc_title: 'Balkania — Музички догађаји на Балкану',
      doc_desc: 'Предстојећи и прошли музички догађаји у Бугарској, Грчкој, Турској и Србији — трубе, фолклор, џез и фестивали. Купи карте.',
      skip: 'Пређи на догађаје', home: 'Почетна страна Balkania', countries_label: 'Земље',
      nav_upcoming: 'Предстојеће', nav_past: 'Прошли догађаји', nav_rhythms: 'Ритмови', nav_about: 'О нама', nav_tickets: 'Карте',
      lang_label: 'Језик', menu: 'Мени', close: 'Затвори', prev: 'Претходно', next: 'Следеће',
      hero_kicker: 'Музика са Балкана',
      hero_title: 'Четири заставе. Један ритам.',
      hero_sub: 'Трубе у Србији, гајде у Родопима, ребетико испод Акропоља, неј у Коњи. Заврти заставе и изабери своје вече.',
      next_up: 'Следеће',
      cta_events: 'Предстојећи догађаји', cta_rhythm: 'Пусти ритам', cta_stop: 'Заустави ритам',
      hint: '← → тастери · превлачење · свајп · скрол',
      show_country: 'Догађаји: {country}',
      filter_label: 'Филтер по земљи', filter_all: 'Све земље',
      upcoming_kicker: 'Ускоро', upcoming_title: 'Предстојећи догађаји', upcoming_sub: 'Изабери догађај и окренуће се напред.',
      past_kicker: 'Бис', past_title: 'Прошли догађаји', past_sub: 'Вечери које још певушимо.',
      starts_in: 'Почиње за', u_d: 'дана', u_h: 'сати', u_m: 'мин', u_s: 'сек',
      live_now: 'Управо траје', add_cal: 'Додај у календар', map: 'Отвори мапу',
      recap: 'Како је било', took_place: 'Одржано {date}', guests: '{n} посетилаца',
      empty: 'Још нема догађаја за ову земљу. Пробај другу заставу.',
      buy_tickets: 'Купи карте', from_price: 'Од {price}', selling_fast: 'Брзо се продаје', sold_out: 'Распродато', few_left: 'Још мало карата', available: 'Доступно',
      tier_early: 'Рана цена', tier_early_desc: 'Снижена цена за прве карте',
      tier_ga: 'Општи улаз', tier_ga_desc: 'Улаз на све бине и зоне',
      tier_vip: 'VIP', tier_vip_desc: 'Најбољи поглед, брз улаз и пиће добродошлице',
      qty_less: 'Уклони једну', qty_more: 'Додај једну',
      choose_tickets: 'Изабери карте', your_order: 'Твоја поруџбина', total: 'Укупно',
      continue: 'Настави', back: 'Назад', confirm: 'Потврди поруџбину', done: 'Готово',
      name_on_ticket: 'Име на карти', name_placeholder: 'Твоје име', ticket_holder: 'Власник карте', guest: 'Гост',
      demo_note: 'Демо куповина — ништа се не наплаћује.',
      ticket_ready: 'Твоје карте су спремне!', ticket_hint: 'Покажи овај QR код на улазу.', order_no: 'Поруџбина',
      rhythms_kicker: 'Изненађење', rhythms_title: 'Осети балкански ритам',
      rhythms_sub: 'Балканска музика воли неправилне тактове. Додирни земљу да чујеш њен плесни ритам, одсвиран уживо у прегледачу.',
      about_title: 'О пројекту Balkania',
      about_text: 'Balkania је љубавно писмо музици Бугарске, Грчке, Турске и Србије — од сеоских сабора до фестивалских бина. Бирамо вечери због којих вреди путовати и обезбеђујемо ти место.',
      newsletter_label: 'Добијај следећи програм на имејл', newsletter_btn: 'Пријави се',
      newsletter_thanks: 'Благодаря! Ευχαριστώ! Teşekkürler! Хвала! На листи си.',
      footer_photos: 'Фотографије са Unsplash-а', footer_sample: 'Демо сајт — догађаји и карте су примери.',
      photo_by: 'Фотографија: {name}, Unsplash',
      c_bg: 'Бугарска', c_gr: 'Грчка', c_tr: 'Турска', c_rs: 'Србија',
      k_festival: 'Фестивал', k_folk: 'Фолклор', k_jazz: 'Џез', k_brass: 'Трубачи', k_classical: 'Класика', k_sacred: 'Духовна музика', k_club: 'Клупска музика'
    }
  };

  const LOCALES = { en: 'en-GB', bg: 'bg-BG', el: 'el-GR', tr: 'tr-TR', sr: 'sr-Cyrl-RS' };

  return { COUNTRIES, RHYTHMS, EVENTS, I18N, LOCALES };
})();

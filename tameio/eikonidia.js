/*
  Ταμεία
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Απαγορεύεται η αντιγραφή, τροποποίηση και διάθεση, εν όλω ή εν μέρει, χωρίς προηγούμενη γραπτή άδεια του κατόχου.
  Copying, modification and distribution, in whole or in part, without the owner's prior written permission are prohibited.
*/
const ICON_LIB=[["Σπίτι και λογαριασμοί","🏠",`🏠 σπίτι κατοικία οικία home house
🏡 σπίτι κήπος εξοχικό house garden
🏘️ σπίτια γειτονιά πολυκατοικία houses
🏢 πολυκατοικία κτίριο γραφείο building office
🏬 κατάστημα εμπορικό store mall
🏚️ παλιό σπίτι ερείπιο old house
🛖 καλύβα hut
🔑 κλειδί ενοίκιο μίσθωμα key rent
🗝️ κλειδί παλιό key
🚪 πόρτα door
🪟 παράθυρο τζάμι window
🛋️ καναπές έπιπλα σαλόνι sofa furniture
🛏️ κρεβάτι στρώμα bed
🪑 καρέκλα chair
🛁 μπανιέρα μπάνιο bath
🚿 ντους shower
🚽 τουαλέτα wc toilet
🧻 χαρτί υγείας toilet paper
🧼 σαπούνι soap
🧽 σφουγγάρι καθαριότητα sponge cleaning
🧹 σκούπα καθαριότητα σκάλα broom cleaning stairs
🧺 καλάθι πλυντήριο ρούχα laundry
🪣 κουβάς σφουγγαρίστρα bucket
🧴 καθαριστικό απορρυπαντικό lotion detergent
💡 ρεύμα δεη λάμπα φως electricity light bulb
🔌 πρίζα ρεύμα plug power
⚡ ρεύμα ενέργεια ηλεκτρισμός power energy
🔋 μπαταρία battery
💧 νερό εύδαπ ύδρευση water
🚰 νερό βρύση πόσιμο tap water
🔥 θέρμανση φωτιά αέριο πετρέλαιο heating fire gas
🛢️ πετρέλαιο βαρέλι δεξαμενή oil tank
♨️ ζεστό νερό θερμοσίφωνας hot water
❄️ κλιματιστικό κρύο air condition cold
🌡️ θερμοκρασία θερμόμετρο temperature
📞 τηλέφωνο σταθερό phone
☎️ τηλέφωνο σταθερό telephone
📱 κινητό τηλέφωνο mobile phone
🌐 ίντερνετ διαδίκτυο internet
📶 σήμα wifi δίκτυο signal
📺 τηλεόραση συνδρομή tv television
📡 δορυφορική κεραία satellite
🗑️ σκουπίδια δημοτικά τέλη κάδος trash
♻️ ανακύκλωση recycle
🧯 πυροσβεστήρας πυρασφάλεια fire extinguisher
🛗 ανελκυστήρας ασανσέρ elevator lift
🪜 σκάλα stairs ladder
🔒 κλειδαριά ασφάλεια lock
🛡️ ασφάλεια ασφάλιστρα insurance
🏗️ οικοδομή ανακαίνιση construction
🧱 τούβλα οικοδομικά bricks
🪵 ξύλα τζάκι wood
🌿 κήπος φυτά garden plants
🪴 γλάστρα φυτό plant pot
🌳 δέντρο tree
🌻 λουλούδι flower
🐜 απεντόμωση έντομα insect
🪳 κατσαρίδα απεντόμωση cockroach
🐭 ποντίκι μυοκτονία mouse`],["Φαγητό και σούπερ μάρκετ","🛒",`🛒 σούπερ μάρκετ ψώνια καρότσι supermarket shopping
🧺 καλάθι ψώνια λαϊκή basket market
🍎 φρούτα μήλο λαϊκή fruit apple
🍌 μπανάνα banana
🍇 σταφύλια grapes
🍊 πορτοκάλι orange
🍋 λεμόνι lemon
🍓 φράουλα strawberry
🍉 καρπούζι watermelon
🥕 λαχανικά καρότο vegetables carrot
🥦 μπρόκολο λαχανικά broccoli
🍅 ντομάτα tomato
🥔 πατάτες potato
🧅 κρεμμύδι onion
🥖 ψωμί φούρνος αρτοποιείο bread bakery
🥐 κρουασάν φούρνος croissant
🍞 ψωμί bread
🥩 κρέας κρεοπωλείο meat butcher
🍗 κοτόπουλο chicken
🐟 ψάρι ιχθυοπωλείο fish
🦐 θαλασσινά γαρίδες seafood
🧀 τυρί cheese
🥚 αυγά eggs
🥛 γάλα milk
🧈 βούτυρο butter
🍯 μέλι honey
🫒 ελιές λάδι olives oil
🍝 μακαρόνια pasta
🍚 ρύζι rice
🥫 κονσέρβα can
🧂 αλάτι μπαχαρικά salt
🍫 σοκολάτα γλυκά chocolate
🍬 καραμέλα γλυκά candy
🍰 γλυκό ζαχαροπλαστείο cake pastry
🎂 τούρτα γενέθλια birthday cake
🍪 μπισκότα cookies
🍦 παγωτό ice cream
🍕 πίτσα delivery pizza
🍔 μπέργκερ φαστφουντ burger
🌭 χοτ ντογκ hot dog
🌯 σουβλάκι γύρος πίτα souvlaki gyros
🥙 πίτα γύρος pita
🍟 πατάτες τηγανητές fries
🥗 σαλάτα salad
🍲 φαγητό μαγειρευτό food stew
🍽️ εστιατόριο ταβέρνα φαγητό έξω restaurant
🥡 φαγητό σε πακέτο takeaway
🛵 delivery διανομή παράδοση scooter
☕ καφές καφετέρια coffee cafe
🧃 χυμός juice
🥤 αναψυκτικό soda
🍺 μπίρα μπαρ beer
🍷 κρασί wine
🥂 ποτά γιορτή drinks celebration
🍸 κοκτέιλ ποτό cocktail
🚬 τσιγάρα καπνός cigarettes
🍼 μπιμπερό μωρό baby bottle`],["Αυτοκίνητο και μετακινήσεις","🚗",`🚗 αυτοκίνητο αμάξι car
🚙 τζιπ αυτοκίνητο suv
🏎️ αγωνιστικό car race
🛻 αγροτικό pickup
🚚 φορτηγό μεταφορά προμηθευτές truck delivery
🚐 βαν van
🏍️ μηχανή μοτοσυκλέτα motorbike
🛵 παπάκι σκούτερ scooter
🚲 ποδήλατο bicycle
🛴 πατίνι scooter
⛽ βενζίνη καύσιμα πρατήριο fuel gas petrol
🔌 φόρτιση ηλεκτρικό charging
🅿️ πάρκινγκ στάθμευση parking
🛣️ διόδια εθνική οδός toll highway
🚦 φανάρι traffic light
🚧 έργα δρόμος roadworks
🔧 συνεργείο σέρβις επισκευή service repair
🛞 λάστιχα ελαστικά tyres
🧰 εργαλεία tools
🚿 πλυντήριο αυτοκινήτου car wash
🪪 δίπλωμα άδεια license
📄 ΚΤΕΟ χαρτιά έγγραφα documents
🚕 ταξί taxi
🚌 λεωφορείο συγκοινωνία bus
🚎 τρόλεϊ trolley
🚇 μετρό metro subway
🚆 τρένο train
🚊 τραμ tram
✈️ αεροπλάνο πτήση εισιτήριο plane flight
🛳️ πλοίο καράβι ferry ship
⛴️ φέρι πλοίο ferry
🚢 καράβι ship
⚓ λιμάνι μαρίνα port
🚁 ελικόπτερο helicopter
🗺️ χάρτης ταξίδι map
🧳 βαλίτσα ταξίδι luggage travel
🎫 εισιτήριο ticket
🛂 διαβατήριο passport
🏨 ξενοδοχείο hotel
🏕️ κάμπινγκ camping
🏖️ παραλία διακοπές beach holiday
⛷️ σκι ski`],["Υγεία και προσωπική φροντίδα","🏥",`🏥 νοσοκομείο κλινική hospital
💊 φάρμακα φαρμακείο medicine pharmacy
💉 εμβόλιο ένεση vaccine
🩺 γιατρός ιατρός doctor
🦷 οδοντίατρος δόντια dentist
👓 γυαλιά οπτικά οφθαλμίατρος glasses
🩹 τσιρότο πρώτες βοήθειες bandage
🩻 ακτινογραφία εξετάσεις xray
🧪 εξετάσεις μικροβιολογικό lab test
🧬 εξετάσεις dna
❤️ υγεία καρδιά health heart
🫀 καρδιολόγος heart
🧠 ψυχολόγος brain
🦴 ορθοπεδικός φυσιοθεραπεία bone
♿ αναπηρία accessibility
🤰 εγκυμοσύνη pregnancy
💆 μασάζ σπα massage
💇 κομμωτήριο κούρεμα hair salon
💈 κουρείο barber
💅 νύχια μανικιούρ nails
💄 καλλυντικά μακιγιάζ makeup cosmetics
🧴 κρέμα αντηλιακό cream
🪥 οδοντόβουρτσα toothbrush
🧖 σάουνα σπα spa
🏋️ γυμναστήριο γυμναστική gym
🧘 γιόγκα yoga
🏊 κολύμβηση πισίνα swimming
🏃 τρέξιμο running
⚽ ποδόσφαιρο football
🏀 μπάσκετ basketball
🎾 τένις tennis`],["Οικογένεια, παιδιά, ζώα","👶",`👶 μωρό παιδί baby
🧒 παιδί child
👧 κόρη κορίτσι girl
👦 γιος αγόρι boy
👨‍👩‍👧 οικογένεια family
👪 οικογένεια family
👵 γιαγιά μαμά γονείς grandmother
👴 παππούς γονείς grandfather
🧓 ηλικιωμένος elderly
🎒 σχολείο τσάντα school bag
🏫 σχολείο school
✏️ μολύβι γραφική ύλη pencil
📚 βιβλία φροντιστήριο books tutoring
🎓 σπουδές πανεπιστήμιο δίδακτρα university
🧸 παιχνίδι αρκουδάκι toy
🪀 παιχνίδια toys
🎈 μπαλόνι πάρτι party
🍼 γάλα μωρού baby milk
🚼 πάνες μωρό diapers
🐶 σκύλος κατοικίδιο dog pet
🐱 γάτα κατοικίδιο cat
🐾 κατοικίδια κτηνίατρος pets vet
🐟 ψαράκι ενυδρείο fish
🐦 πουλί bird
🐴 άλογο horse
🐔 κότες αυγά hen
🐄 αγελάδα cow
🐑 πρόβατα sheep
🐐 κατσίκα goat
🐝 μέλισσα μέλι bee`],["Ρούχα και ψώνια","👕",`👕 ρούχα μπλούζα clothes shirt
👖 παντελόνι τζιν jeans
👗 φόρεμα dress
🧥 μπουφάν παλτό coat
🧦 κάλτσες socks
👟 παπούτσια αθλητικά shoes
👞 παπούτσια shoes
👠 γόβες heels
🩴 σαγιονάρες flip flops
👜 τσάντα bag
🎒 σακίδιο backpack
👓 γυαλιά glasses
🕶️ γυαλιά ηλίου sunglasses
⌚ ρολόι watch
💍 δαχτυλίδι κοσμήματα ring jewelry
💎 διαμάντι κόσμημα diamond
🛍️ ψώνια τσάντες αγορές shopping
🎁 δώρο δώρα gift
🧵 ράψιμο μοδίστρα sewing
🧶 πλέξιμο knitting
✂️ ψαλίδι scissors`],["Δουλειά, γραφείο, επιχείρηση","💼",`💼 δουλειά εργασία χαρτοφύλακας work business
💶 χρήματα ευρώ πωλήσεις money euro sales
💰 σακούλα χρήματα κέρδος money bag
💵 χαρτονομίσματα μετρητά cash
🪙 κέρματα coins
💳 κάρτα πληρωμή card
🏦 τράπεζα bank
🧾 απόδειξη τιμολόγιο παραστατικό receipt invoice
📒 λογιστής βιβλία accountant
📊 στατιστικά αναφορές chart
📈 άνοδος επένδυση growth
📉 πτώση decline
🧮 υπολογισμός λογιστική abacus
🏛️ εφορία δημόσιο φόροι tax office
⚖️ δικηγόρος νομικά lawyer legal
📝 συμβόλαιο σημειώσεις contract notes
📄 έγγραφο document
📋 λίστα clipboard
📎 συνδετήρας γραφική ύλη paperclip
🖊️ στυλό pen
📦 πακέτο αποθήκη αγορές package
📮 ταχυδρομείο courier mail
✉️ φάκελος γράμμα envelope
📧 email ταχυδρομείο email
🖨️ εκτυπωτής printer
💻 υπολογιστής laptop computer
🖥️ οθόνη desktop
⌨️ πληκτρολόγιο keyboard
🖱️ ποντίκι mouse
💾 δισκέτα αρχεία save
☁️ cloud σύννεφο συνδρομή cloud
📢 διαφήμιση advertising
🏪 μαγαζί κατάστημα shop
🏭 εργοστάσιο factory
🏗️ έργο project construction
👷 εργάτης προσωπικό μεροκάματα worker staff
🧑‍💼 υπάλληλος employee
🤝 συνεργασία συμφωνία deal
📆 ημερολόγιο calendar
⏰ ξυπνητήρι ώρα alarm
🛠️ εργαλεία συντήρηση tools
🔨 σφυρί hammer
🪛 κατσαβίδι screwdriver
🪚 πριόνι saw
🔩 βίδες bolts
⚙️ γρανάζι ρυθμίσεις μηχάνημα gear
🧰 εργαλειοθήκη toolbox
🪜 σκάλα μάστορας ladder
🎨 μπογιά βάψιμο paint
🖌️ πινέλο brush
🔦 φακός flashlight
🧯 πυρασφάλεια fire safety
🌾 αγροτικά σιτάρι farming
🚜 τρακτέρ αγρότης tractor
🐄 κτηνοτροφία ζωοτροφές livestock
☕ καφές αναψυκτήριο cafe
🍽️ εστίαση restaurant`],["Ψυχαγωγία και συνδρομές","🎬",`🎬 σινεμά ταινίες cinema movies
🍿 ποπ κορν σινεμά popcorn
🎭 θέατρο theatre
🎵 μουσική music
🎧 ακουστικά spotify μουσική headphones
🎤 μικρόφωνο καραόκε mic
🎸 κιθάρα μαθήματα guitar
🎹 πιάνο piano
🎮 παιχνίδια κονσόλα games
🕹️ παιχνίδια games
🎲 ζάρια επιτραπέζια dice
🃏 χαρτιά cards
🎰 τυχερά παίγνια στοίχημα betting
🎟️ εισιτήριο συναυλία ticket
🎪 τσίρκο circus
🎨 τέχνη art
📷 φωτογραφία camera
📸 φωτογραφίες photos
📚 βιβλία books
📰 εφημερίδα περιοδικό newspaper
📺 συνδρομή τηλεόρασης tv subscription
🎉 πάρτι γιορτή party
🥳 γιορτή celebration
💐 λουλούδια ανθοπωλείο flowers
⛪ εκκλησία church
🕯️ κερί candle
🙏 δωρεά φιλανθρωπία donation
❤️ δωρεά donation`],["Σύμβολα και διάφορα","⭐",`⭐ αστέρι αγαπημένο star
🌟 λαμπερό αστέρι star
✅ εντάξει έγινε check
❌ όχι ακύρωση cross
⚠️ προσοχή warning
❗ σημαντικό important
❓ ερώτηση question
➕ συν άλλα έσοδα plus
➖ πλην minus
💯 εκατό hundred
🔴 κόκκινο red
🟠 πορτοκαλί orange
🟡 κίτρινο yellow
🟢 πράσινο green
🔵 μπλε blue
🟣 μωβ purple
⚫ μαύρο black
⚪ άσπρο white
🟥 κόκκινο τετράγωνο red square
🟩 πράσινο τετράγωνο green square
🟦 μπλε τετράγωνο blue square
📌 πινέζα pin
📍 τοποθεσία location
🔔 κουδούνι υπενθύμιση bell
🔁 επανάληψη πάγιο repeat
📅 ημερομηνία πάγιο date
⏳ αναμονή δόσεις wait
💤 ύπνος sleep
🎯 στόχος προϋπολογισμός target
🏆 κύπελλο trophy
🎀 φιόγκος bow
🌈 ουράνιο τόξο rainbow
☀️ ήλιος sun
🌙 φεγγάρι moon
🌍 κόσμος world
🇬🇷 Ελλάδα σημαία greece flag
👤 άτομο προσωπικά person
👥 άτομα ομάδα people
🙂 χαμόγελο smile
😊 χαρά happy
😎 cool
🤑 χρήματα money face
🐷 κουμπαράς αποταμίευση piggy savings
👻 φάντασμα ghost
🤖 ρομπότ robot`]],ICON_ALL=(()=>{const e=new Set,t=[];return ICON_LIB.forEach(([r,,i],s)=>i.split(`
`).forEach(c=>{const a=c.trim();if(!a)return;const o=a.indexOf(" "),n=o<0?a:a.slice(0,o),l=o<0?"":a.slice(o+1);t.push([n,l,s]),e.add(n)})),t})(),ICON_GR_PH=()=>[T("Σπίτι και λογαριασμοί"),T("Φαγητό και σούπερ μάρκετ"),T("Αυτοκίνητο και μετακινήσεις"),T("Υγεία και προσωπική φροντίδα"),T("Οικογένεια, παιδιά, ζώα"),T("Ρούχα και ψώνια"),T("Δουλειά, γραφείο, επιχείρηση"),T("Ψυχαγωγία και συνδρομές"),T("Σύμβολα και διάφορα")];function icRecent(){const e=S&&S.settings&&S.settings.icRecent||[];return Array.isArray(e)?e:[]}function icRemember(e){if(!e||!S||!S.settings)return;const t=icRecent().filter(r=>r!==e);t.unshift(e),S.settings.icRecent=t.slice(0,16);try{write()}catch{}}function icSearch(e){const t=norm(e).split(/\s+/).filter(Boolean);if(!t.length)return[];const r=[],i=new Set;return ICON_ALL.forEach(([s,c,a])=>{if(i.has(s))return;const o=norm(c+" "+T(ICON_LIB[a][0])).split(/\s+/);t.every(n=>o.some(l=>l.startsWith(n)))&&(i.add(s),r.push(s))}),r}

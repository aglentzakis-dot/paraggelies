/* Παραγγελίες — τι παίρνει ο παραλήπτης «Μεταφορά στοιχείων» (metafora-lipsi.js) από την παλιά διεύθυνση
   aglentzakis-dot.github.io/paraggelies/ → paraggelies.glenapps.gr.
   © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
   ls   : όλα τα «paraggelies-…» (γλώσσα, και του ενσωματωμένου Ταμείου: βιβλίο, πρόχειρο, γλώσσα, γραμματοκιβώτιο πληρωμών),
          η σήμανση της επίδειξης και το κοινό κλειδί GlenApps
   idb  : «paraggelies» (όλα τα στοιχεία: κατάλογος, παραγγελίες, πελάτες, ρυθμίσεις) και τα κλειδιά των αντιγράφων
   opfs : κανένα (τα αντίγραφα του ενσωματωμένου Ταμείου μένουν μαζί με των «Ταμείων», στο «antigrafa-tameia»)
   Ο φάκελος αντιγράφων του κινητού («shared-backups») ΔΕΝ μεταφέρεται: ξαναδιαλέγεται στη νέα διεύθυνση.
   exei : αν εδώ υπάρχουν ήδη πραγματικά στοιχεία (για την προειδοποίηση πριν από την αντικατάσταση). */
window.GLEN_METAFORA={app:"paraggelies",onoma:"Παραγγελίες",
  ls:["paraggelies-","glen-epideixi-paraggelies","glenapps-kleidi"],
  idb:["paraggelies","glenapps-kleidia-paraggelies"],
  opfs:[],
  exei:function(){try{var A=window.App,s=A&&A.S&&A.S();if(!s||A.DEMO)return true;
    var n=function(x){return x?(Array.isArray(x)?x.length:Object.keys(x).length):0};
    return n(s.orders)>0||n(s.products)>0||n(s.customers)>0||n(s.menu)>0||!!(s.shop&&s.shop.name)}catch(e){return true}}};

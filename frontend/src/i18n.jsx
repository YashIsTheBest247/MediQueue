import { createContext, useContext, useState, useCallback } from "react";

export const LANGS = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "ta", label: "த" },
];

const DICT = {
  hi: {
    "Log in": "लॉग इन",
    "Sign up": "साइन अप",
    "Get started": "शुरू करें",
    "Live Queues": "लाइव कतारें",
    "Our Solution": "हमारा समाधान",
    "Why MediQueue?": "मेडीक्यू क्यों?",
    "About Us": "हमारे बारे में",
    "For Clinics": "क्लीनिक के लिए",
    "For Patients": "मरीज़ों के लिए",
    "or compare live clinic queues →": "या लाइव क्लीनिक कतारें देखें →",
    "Where Healing": "जहाँ इलाज",
    "Feels Like": "लगता है जैसे",
    "Home": "घर",
    Patient: "मरीज़",
    "Join a": "शामिल हों",
    "clinic queue": "क्लीनिक कतार में",
    "Your active queues": "आपकी सक्रिय कतारें",
    "Join now": "अभी शामिल हों",
    Book: "बुक करें",
    "Join queue": "कतार में शामिल हों",
    "Leave queue": "कतार छोड़ें",
    "My queues": "मेरी कतारें",
    "You're in the queue": "आप कतार में हैं",
    "You're almost up": "आपकी बारी पास है",
    "It's your turn": "आपकी बारी है",
    "Your Token": "आपका टोकन",
    "Patients ahead of you": "आपसे आगे मरीज़",
    "Now serving": "अभी चल रहा है",
    Waiting: "प्रतीक्षारत",
    Served: "पूर्ण",
    Total: "कुल",
    "Find the": "खोजें",
    "shortest wait": "सबसे कम प्रतीक्षा",
    "Join this clinic": "इस क्लीनिक में शामिल हों",
    "Currently closed": "अभी बंद है",
    "Reason for visit / symptoms (optional)": "आने का कारण / लक्षण (वैकल्पिक)",
    "Log out": "लॉग आउट",
    Closed: "बंद",
    Open: "खुला",
    "I'm a Clinic": "मैं एक क्लीनिक हूँ",
    "I'm a Patient": "मैं एक मरीज़ हूँ",
    "Clinic name": "क्लीनिक का नाम",
    "Your name": "आपका नाम",
    Email: "ईमेल",
    Password: "पासवर्ड",
    "Please wait…": "कृपया प्रतीक्षा करें…",
    "Create clinic account": "क्लीनिक खाता बनाएँ",
    "Create patient account": "मरीज़ खाता बनाएँ",
    "New here?": "नए हैं?",
    "Create an account": "खाता बनाएँ",
    "Already registered?": "पहले से पंजीकृत?",
    "Start your journey to better care. End paper token slips and shouted names — patients see exactly when they'll be called, and clinics run the day from one calm dashboard.":
      "बेहतर देखभाल की ओर अपनी यात्रा शुरू करें। कागज़ी टोकन और नाम पुकारने की झंझट खत्म करें — मरीज़ देख सकते हैं कि उन्हें कब बुलाया जाएगा, और क्लीनिक एक ही शांत डैशबोर्ड से दिन चलाते हैं।",
    "MediQueue's app": "मेडीक्यू ऐप",
    "A simple app for clinic patients": "क्लीनिक के मरीज़ों के लिए एक सरल ऐप",
    "MediQueue's system": "मेडीक्यू सिस्टम",
    "A system built to streamline the clinic": "क्लीनिक को सुव्यवस्थित करने के लिए बना सिस्टम",
    "Your wait time is displayed here, and we notify you when it's time to head to the clinic.":
      "आपका प्रतीक्षा समय यहाँ दिखता है, और क्लीनिक जाने का समय होने पर हम आपको सूचित करते हैं।",
    "A quick button for an emergency call — press it if your condition is critical.":
      "आपातकालीन कॉल के लिए एक त्वरित बटन — गंभीर स्थिति में इसे दबाएँ।",
    "The clinics view shows how crowded queues are at nearby hospitals. Choose wisely.":
      "क्लीनिक दृश्य दिखाता है कि आस-पास के अस्पतालों में कतारें कितनी भरी हैं। समझदारी से चुनें।",
    "Tap here to fill in a short health form describing your symptoms. You then get a position in the queue and can monitor your time live.":
      "अपने लक्षण बताते हुए छोटा फ़ॉर्म भरने के लिए यहाँ टैप करें। फिर आपको कतार में स्थान मिलता है और आप अपना समय लाइव देख सकते हैं।",
    "The clinic can monitor the efficiency of the queue at a glance.":
      "क्लीनिक एक नज़र में कतार की कार्यक्षमता देख सकता है।",
    "When a patient applies from the app they appear in the system. The request is reviewed and a queue number is assigned automatically based on symptoms.":
      "जब कोई मरीज़ ऐप से आवेदन करता है तो वह सिस्टम में दिखता है। अनुरोध की समीक्षा होती है और लक्षणों के आधार पर अपने आप कतार नंबर दिया जाता है।",
    "Reception can monitor and get a clear, real-time view of the whole queue.":
      "रिसेप्शन पूरी कतार का स्पष्ट, रीयल-टाइम दृश्य देख सकता है।",
    "Staff manage patients simply, because patients self-register in our own application.":
      "स्टाफ़ आसानी से मरीज़ों को संभालता है, क्योंकि मरीज़ हमारे ऐप में खुद पंजीकरण करते हैं।",
    "Saves time & money": "समय और पैसा बचाता है",
    "Cut wasted minutes per visit and save staff time on every patient by ending manual, paper-based queue management.":
      "मैनुअल, कागज़-आधारित कतार प्रबंधन समाप्त करके हर मुलाक़ात के बर्बाद मिनट घटाएँ और स्टाफ़ का समय बचाएँ।",
    "Calmer waiting rooms": "शांत प्रतीक्षा कक्ष",
    "Effortless communication between waiting patients and staff — and patients can wait wherever they're comfortable instead of crowding the room.":
      "प्रतीक्षारत मरीज़ों और स्टाफ़ के बीच आसान संवाद — और मरीज़ कमरे में भीड़ लगाने के बजाय जहाँ सुविधाजनक हो वहाँ प्रतीक्षा कर सकते हैं।",
    "Reduces wait times": "प्रतीक्षा समय घटाता है",
    "Cut wait times to under an hour with a dynamic, live-updated expected waiting time right in the app.":
      "ऐप में लाइव-अपडेट होने वाले अनुमानित समय के साथ प्रतीक्षा को एक घंटे से कम करें।",
    "Reducing workload & stress": "काम का बोझ और तनाव कम",
    "Less ineffective admin work — reduce staff workload by ~30% so they can focus on treating people.":
      "कम अप्रभावी प्रशासनिक कार्य — स्टाफ़ का बोझ ~30% घटाएँ ताकि वे इलाज पर ध्यान दे सकें।",
    "Paper tokens and shouting": "कागज़ी टोकन और शोर",
    "76% of India's 1.5 million clinics still run on paper token slips and shouted names. There's no system — just a slip of paper and a receptionist calling out the next number across a crowded room.":
      "भारत के 15 लाख क्लीनिकों में से 76% आज भी कागज़ी टोकन और नाम पुकारने पर चलते हैं। कोई सिस्टम नहीं — बस कागज़ की पर्ची और भीड़ भरे कमरे में अगला नंबर पुकारता रिसेप्शनिस्ट।",
    "Hours of waiting, zero visibility": "घंटों की प्रतीक्षा, कोई जानकारी नहीं",
    "Patients wait 2–3 hours with zero visibility into when they'll be called. Doctors have no dashboard to see who's next, and receptionists manage the entire queue from memory.":
      "मरीज़ 2–3 घंटे प्रतीक्षा करते हैं और पता नहीं चलता कि कब बुलाया जाएगा। डॉक्टरों के पास कोई डैशबोर्ड नहीं और रिसेप्शनिस्ट पूरी कतार याददाश्त से चलाते हैं।",
    "We're going to fix that": "हम इसे ठीक करेंगे",
    'MediQueue replaces the paper and the shouting with live digital tokens. Patients see exactly when they\'re next, receptionists run the day from one screen, and both stay in sync the moment "Call Next" is clicked.':
      "मेडीक्यू कागज़ और शोर को लाइव डिजिटल टोकन से बदलता है। मरीज़ देखते हैं कि उनकी बारी कब है, रिसेप्शनिस्ट एक स्क्रीन से दिन चलाते हैं, और \"Call Next\" दबाते ही दोनों तुरंत सिंक हो जाते हैं।",
    Back: "वापस",
    "Pick a clinic to get a token, or book a time for later. You can be in more than one queue at once.":
      "टोकन पाने के लिए कोई क्लीनिक चुनें, या बाद के लिए समय बुक करें। आप एक साथ कई कतारों में रह सकते हैं।",
    View: "देखें",
    "Book for later (optional)": "बाद के लिए बुक करें (वैकल्पिक)",
    "Any department": "कोई भी विभाग",
    "No clinics are open yet.": "अभी कोई क्लीनिक खुली नहीं है।",
    "Your consultation is complete": "आपका परामर्श पूरा हुआ",
    "Please proceed to the doctor": "कृपया डॉक्टर के पास जाएँ",
    "Please proceed to Room": "कृपया कमरे में जाएँ",
    "Thanks for visiting": "आने के लिए धन्यवाद",
    "Now serving token": "अभी चल रहा टोकन",
    "Live · updates automatically": "लाइव · स्वतः अपडेट",
    "Reconnecting…": "पुनः कनेक्ट हो रहा है…",
    "Est. wait · seen ~": "अनुमानित प्रतीक्षा · लगभग ~",
    Done: "पूर्ण",
    Booked: "बुक किया गया",
    Token: "टोकन",
    Clinic: "क्लीनिक",
    Dashboard: "डैशबोर्ड",
    "Add walk-in patient": "वॉक-इन मरीज़ जोड़ें",
    "Patient name": "मरीज़ का नाम",
    "General (no department)": "सामान्य (कोई विभाग नहीं)",
    "Reason / symptoms (optional)": "कारण / लक्षण (वैकल्पिक)",
    "Mark as urgent (jumps to front)": "अत्यावश्यक चिह्नित करें (सबसे आगे)",
    "Rooms / doctors": "कमरे / डॉक्टर",
    "Avg time (min)": "औसत समय (मि.)",
    "Departments (comma separated)": "विभाग (अल्पविराम से अलग)",
    "Opening hours": "खुलने का समय",
    Save: "सहेजें",
    "Patient join code": "मरीज़ जॉइन कोड",
    "Copy join link": "जॉइन लिंक कॉपी करें",
    "Link copied!": "लिंक कॉपी हुआ!",
    "Rooms · Now serving": "कमरे · अभी चल रहा",
    "Call next": "अगला बुलाएँ",
    "Call from: Any": "बुलाएँ: कोई भी",
    Skip: "छोड़ें",
    Recall: "वापस बुलाएँ",
    Call: "बुलाएँ",
    Urgent: "अत्यावश्यक",
    Admit: "प्रवेश दें",
    Free: "खाली",
    Room: "कमरा",
    Skipped: "छोड़ा गया",
    Pause: "रोकें",
    Resume: "फिर शुरू करें",
    Display: "डिस्प्ले",
    Reset: "रीसेट",
    "Upcoming appointments": "आगामी अपॉइंटमेंट",
    "No patients waiting. Add a walk-in or share the join code.":
      "कोई मरीज़ प्रतीक्षारत नहीं। वॉक-इन जोड़ें या जॉइन कोड साझा करें।",
    "Queue paused — patients can still join, calling is on hold.":
      "कतार रुकी है — मरीज़ फिर भी जुड़ सकते हैं, बुलाना रुका है।",
    "Smart Clinic Queue": "स्मार्ट क्लीनिक कतार",
    "Patients scan the QR or open the link to join instantly.":
      "मरीज़ QR स्कैन करके या लिंक खोलकर तुरंत जुड़ सकते हैं।",
    "Live clinic queues": "लाइव क्लीनिक कतारें",
    "Compare clinics in real time — no login needed. Pick the one that suits you, then sign in to grab your token.":
      "क्लीनिकों की तुलना रियल-टाइम में करें — लॉगिन की ज़रूरत नहीं। अपनी पसंद की क्लीनिक चुनें, फिर टोकन पाने के लिए साइन इन करें।",
    "Loading clinics…": "क्लीनिक लोड हो रही हैं…",
    "No clinics have registered yet.": "अभी तक कोई क्लीनिक पंजीकृत नहीं है।",
    "Shortest wait": "सबसे कम प्रतीक्षा",
    Idle: "निष्क्रिय",
    "Est. wait (min)": "अनुमानित प्रतीक्षा (मि.)",
    rooms: "कमरे",
    "Waiting Room": "प्रतीक्षा कक्ष",
    "Please watch for": "ध्यान रखें",
    "your token": "अपना टोकन",
    "Now Serving": "अभी चल रहा है",
    "Waiting to start": "शुरू होने की प्रतीक्षा",
    "Tokens in queue": "कतार में टोकन",
    "Est. wait for last token (min)": "अंतिम टोकन के लिए अनुमानित प्रतीक्षा (मि.)",
    "Up Next": "आगे",
    "The queue is empty right now.": "अभी कतार खाली है।",
    General: "सामान्य",
  },
  ta: {
    "Log in": "உள்நுழை",
    "Sign up": "பதிவு",
    "Get started": "தொடங்கு",
    "Live Queues": "நேரடி வரிசை",
    "Our Solution": "எங்கள் தீர்வு",
    "Why MediQueue?": "ஏன் மெடிக்யூ?",
    "About Us": "எங்களைப் பற்றி",
    "For Clinics": "மருத்துவமனைக்கு",
    "For Patients": "நோயாளிகளுக்கு",
    "or compare live clinic queues →": "அல்லது நேரடி வரிசைகளை ஒப்பிடு →",
    "Where Healing": "குணமாதல்",
    "Feels Like": "உணர்வது",
    "Home": "வீடு",
    Patient: "நோயாளி",
    "Join a": "சேரு",
    "clinic queue": "மருத்துவ வரிசையில்",
    "Your active queues": "உங்கள் வரிசைகள்",
    "Join now": "இப்போது சேரு",
    Book: "முன்பதிவு",
    "Join queue": "வரிசையில் சேரு",
    "Leave queue": "வரிசையை விடு",
    "My queues": "என் வரிசைகள்",
    "You're in the queue": "நீங்கள் வரிசையில்",
    "You're almost up": "உங்கள் முறை அருகில்",
    "It's your turn": "உங்கள் முறை",
    "Your Token": "உங்கள் டோக்கன்",
    "Patients ahead of you": "உங்களுக்கு முன் நோயாளிகள்",
    "Now serving": "இப்போது",
    Waiting: "காத்திருப்பு",
    Served: "முடிந்தது",
    Total: "மொத்தம்",
    "Find the": "கண்டுபிடி",
    "shortest wait": "குறைந்த காத்திருப்பு",
    "Join this clinic": "இந்த மருத்துவமனையில் சேரு",
    "Currently closed": "தற்போது மூடப்பட்டது",
    "Reason for visit / symptoms (optional)": "வருகை காரணம் / அறிகுறிகள் (விருப்பம்)",
    "Log out": "வெளியேறு",
    Closed: "மூடியது",
    Open: "திறந்தது",
    "I'm a Clinic": "நான் ஒரு மருத்துவமனை",
    "I'm a Patient": "நான் ஒரு நோயாளி",
    "Clinic name": "மருத்துவமனை பெயர்",
    "Your name": "உங்கள் பெயர்",
    Email: "மின்னஞ்சல்",
    Password: "கடவுச்சொல்",
    "Please wait…": "காத்திருக்கவும்…",
    "Create clinic account": "மருத்துவமனை கணக்கை உருவாக்கு",
    "Create patient account": "நோயாளி கணக்கை உருவாக்கு",
    "New here?": "புதியவரா?",
    "Create an account": "கணக்கை உருவாக்கு",
    "Already registered?": "ஏற்கனவே பதிவு செய்துள்ளீர்களா?",
    "Start your journey to better care. End paper token slips and shouted names — patients see exactly when they'll be called, and clinics run the day from one calm dashboard.":
      "சிறந்த சிகிச்சைக்கான பயணத்தைத் தொடங்குங்கள். காகித டோக்கன்களையும் பெயர் கூப்பிடுவதையும் முடிவுக்குக் கொண்டு வாருங்கள் — நோயாளிகள் எப்போது அழைக்கப்படுவார்கள் என்பதைப் பார்க்கலாம், மருத்துவமனைகள் ஒரே அமைதியான டாஷ்போர்டில் நாளை நடத்துகின்றன.",
    "MediQueue's app": "மெடிக்யூ செயலி",
    "A simple app for clinic patients": "மருத்துவமனை நோயாளிகளுக்கு எளிய செயலி",
    "MediQueue's system": "மெடிக்யூ அமைப்பு",
    "A system built to streamline the clinic": "மருத்துவமனையை ஒழுங்குபடுத்த உருவாக்கப்பட்ட அமைப்பு",
    "Your wait time is displayed here, and we notify you when it's time to head to the clinic.":
      "உங்கள் காத்திருப்பு நேரம் இங்கே காட்டப்படும், மருத்துவமனைக்குச் செல்ல வேண்டிய நேரத்தில் நாங்கள் அறிவிப்போம்.",
    "A quick button for an emergency call — press it if your condition is critical.":
      "அவசர அழைப்புக்கான விரைவு பொத்தான் — நிலை மோசமாக இருந்தால் அழுத்தவும்.",
    "The clinics view shows how crowded queues are at nearby hospitals. Choose wisely.":
      "அருகிலுள்ள மருத்துவமனைகளில் வரிசைகள் எவ்வளவு நெரிசலாக உள்ளன என்பதை மருத்துவமனை பார்வை காட்டுகிறது. புத்திசாலித்தனமாக தேர்ந்தெடுக்கவும்.",
    "Tap here to fill in a short health form describing your symptoms. You then get a position in the queue and can monitor your time live.":
      "உங்கள் அறிகுறிகளை விவரிக்கும் சிறிய படிவத்தை நிரப்ப இங்கே தட்டவும். பிறகு வரிசையில் இடம் கிடைக்கும், உங்கள் நேரத்தை நேரடியாகப் பார்க்கலாம்.",
    "The clinic can monitor the efficiency of the queue at a glance.":
      "மருத்துவமனை ஒரே பார்வையில் வரிசையின் செயல்திறனைக் கண்காணிக்கலாம்.",
    "When a patient applies from the app they appear in the system. The request is reviewed and a queue number is assigned automatically based on symptoms.":
      "நோயாளி செயலியில் விண்ணப்பித்தால் அமைப்பில் தோன்றுவார். கோரிக்கை பரிசீலிக்கப்பட்டு அறிகுறிகளின் அடிப்படையில் தானாக வரிசை எண் வழங்கப்படும்.",
    "Reception can monitor and get a clear, real-time view of the whole queue.":
      "வரவேற்பு முழு வரிசையின் தெளிவான, நேரடிக் காட்சியைக் காணலாம்.",
    "Staff manage patients simply, because patients self-register in our own application.":
      "நோயாளிகள் எங்கள் செயலியில் தாங்களே பதிவு செய்வதால் ஊழியர்கள் எளிதாக நிர்வகிக்கிறார்கள்.",
    "Saves time & money": "நேரமும் பணமும் சேமிக்கிறது",
    "Cut wasted minutes per visit and save staff time on every patient by ending manual, paper-based queue management.":
      "கைமுறை, காகித வரிசை மேலாண்மையை முடிப்பதன் மூலம் ஒவ்வொரு வருகையிலும் வீணான நிமிடங்களைக் குறைத்து ஊழியர் நேரத்தைச் சேமிக்கவும்.",
    "Calmer waiting rooms": "அமைதியான காத்திருப்பு அறைகள்",
    "Effortless communication between waiting patients and staff — and patients can wait wherever they're comfortable instead of crowding the room.":
      "காத்திருக்கும் நோயாளிகளுக்கும் ஊழியர்களுக்கும் இடையே எளிய தொடர்பு — நோயாளிகள் அறையில் நெரிசலாக இருப்பதற்குப் பதிலாக வசதியான இடத்தில் காத்திருக்கலாம்.",
    "Reduces wait times": "காத்திருப்பு நேரத்தைக் குறைக்கிறது",
    "Cut wait times to under an hour with a dynamic, live-updated expected waiting time right in the app.":
      "செயலியிலேயே நேரடியாகப் புதுப்பிக்கப்படும் எதிர்பார்க்கப்படும் நேரத்துடன் காத்திருப்பை ஒரு மணி நேரத்திற்கும் கீழே குறைக்கவும்.",
    "Reducing workload & stress": "வேலைப்பளு மற்றும் மன அழுத்தம் குறைப்பு",
    "Less ineffective admin work — reduce staff workload by ~30% so they can focus on treating people.":
      "குறைவான பயனற்ற நிர்வாக வேலை — ஊழியர் பளுவை ~30% குறைத்து மக்களுக்குச் சிகிச்சை அளிப்பதில் கவனம் செலுத்தலாம்.",
    "Paper tokens and shouting": "காகித டோக்கன்களும் கூப்பிடுதலும்",
    "76% of India's 1.5 million clinics still run on paper token slips and shouted names. There's no system — just a slip of paper and a receptionist calling out the next number across a crowded room.":
      "இந்தியாவின் 15 லட்சம் மருத்துவமனைகளில் 76% இன்னும் காகித டோக்கன்களிலும் பெயர் கூப்பிடுவதிலும் இயங்குகின்றன. அமைப்பே இல்லை — வெறும் காகிதச் சீட்டும், நெரிசலான அறையில் அடுத்த எண்ணைக் கூப்பிடும் வரவேற்பாளரும்தான்.",
    "Hours of waiting, zero visibility": "மணிக்கணக்கில் காத்திருப்பு, தகவலே இல்லை",
    "Patients wait 2–3 hours with zero visibility into when they'll be called. Doctors have no dashboard to see who's next, and receptionists manage the entire queue from memory.":
      "நோயாளிகள் எப்போது அழைக்கப்படுவார்கள் என்று தெரியாமல் 2–3 மணி நேரம் காத்திருக்கிறார்கள். மருத்துவர்களுக்கு டாஷ்போர்டு இல்லை, வரவேற்பாளர்கள் முழு வரிசையையும் நினைவிலிருந்தே நிர்வகிக்கிறார்கள்.",
    "We're going to fix that": "நாங்கள் இதைச் சரிசெய்யப் போகிறோம்",
    'MediQueue replaces the paper and the shouting with live digital tokens. Patients see exactly when they\'re next, receptionists run the day from one screen, and both stay in sync the moment "Call Next" is clicked.':
      "மெடிக்யூ காகிதத்தையும் கூப்பிடுதலையும் நேரடி டிஜிட்டல் டோக்கன்களால் மாற்றுகிறது. நோயாளிகள் தங்கள் முறை எப்போது என்பதைப் பார்க்கிறார்கள், வரவேற்பாளர்கள் ஒரே திரையில் நாளை நடத்துகிறார்கள், \"Call Next\" அழுத்தும் தருணத்தில் இரண்டும் ஒத்திசைகின்றன.",
    Back: "பின்",
    "Pick a clinic to get a token, or book a time for later. You can be in more than one queue at once.":
      "டோக்கன் பெற ஒரு மருத்துவமனையைத் தேர்வு செய்யுங்கள், அல்லது பிறகு ஒரு நேரத்தை முன்பதிவு செய்யுங்கள். ஒரே நேரத்தில் பல வரிசைகளில் இருக்கலாம்.",
    View: "காண்க",
    "Book for later (optional)": "பிறகு முன்பதிவு (விருப்பம்)",
    "Any department": "எந்தத் துறையும்",
    "No clinics are open yet.": "இன்னும் மருத்துவமனை எதுவும் திறக்கவில்லை.",
    "Your consultation is complete": "உங்கள் ஆலோசனை முடிந்தது",
    "Please proceed to the doctor": "மருத்துவரிடம் செல்லவும்",
    "Please proceed to Room": "அறைக்குச் செல்லவும்",
    "Thanks for visiting": "வருகைக்கு நன்றி",
    "Now serving token": "இப்போது டோக்கன்",
    "Live · updates automatically": "நேரடி · தானாக புதுப்பிப்பு",
    "Reconnecting…": "மீண்டும் இணைகிறது…",
    "Est. wait · seen ~": "மதிப்பிட்ட காத்திருப்பு · சுமார் ~",
    Done: "முடிந்தது",
    Booked: "முன்பதிவு",
    Token: "டோக்கன்",
    Clinic: "மருத்துவமனை",
    Dashboard: "டாஷ்போர்டு",
    "Add walk-in patient": "நோயாளியைச் சேர்",
    "Patient name": "நோயாளி பெயர்",
    "General (no department)": "பொது (துறை இல்லை)",
    "Reason / symptoms (optional)": "காரணம் / அறிகுறிகள் (விருப்பம்)",
    "Mark as urgent (jumps to front)": "அவசரம் எனக் குறி (முன்னால் செல்லும்)",
    "Rooms / doctors": "அறைகள் / மருத்துவர்கள்",
    "Avg time (min)": "சராசரி நேரம் (நி)",
    "Departments (comma separated)": "துறைகள் (கமாவால் பிரிக்க)",
    "Opening hours": "திறக்கும் நேரம்",
    Save: "சேமி",
    "Patient join code": "நோயாளி இணைப்புக் குறியீடு",
    "Copy join link": "இணைப்பை நகலெடு",
    "Link copied!": "இணைப்பு நகலெடுக்கப்பட்டது!",
    "Rooms · Now serving": "அறைகள் · இப்போது",
    "Call next": "அடுத்ததை அழை",
    "Call from: Any": "அழை: எதுவும்",
    Skip: "தவிர்",
    Recall: "மீண்டும் அழை",
    Call: "அழை",
    Urgent: "அவசரம்",
    Admit: "அனுமதி",
    Free: "காலி",
    Room: "அறை",
    Skipped: "தவிர்க்கப்பட்டது",
    Pause: "இடைநிறுத்து",
    Resume: "தொடர்",
    Display: "காட்சி",
    Reset: "மீட்டமை",
    "Upcoming appointments": "வரவிருக்கும் சந்திப்புகள்",
    "No patients waiting. Add a walk-in or share the join code.":
      "நோயாளிகள் காத்திருக்கவில்லை. நோயாளியைச் சேர் அல்லது இணைப்புக் குறியீட்டைப் பகிர்.",
    "Queue paused — patients can still join, calling is on hold.":
      "வரிசை இடைநிறுத்தம் — நோயாளிகள் சேரலாம், அழைப்பு நிறுத்தப்பட்டுள்ளது.",
    "Smart Clinic Queue": "ஸ்மார்ட் மருத்துவ வரிசை",
    "Patients scan the QR or open the link to join instantly.":
      "நோயாளிகள் QR ஐ ஸ்கேன் செய்தோ இணைப்பைத் திறந்தோ உடனே சேரலாம்.",
    "Live clinic queues": "நேரடி மருத்துவ வரிசைகள்",
    "Compare clinics in real time — no login needed. Pick the one that suits you, then sign in to grab your token.":
      "மருத்துவமனைகளை நேரடியாக ஒப்பிடுங்கள் — உள்நுழைவு தேவையில்லை. உங்களுக்கு ஏற்றதைத் தேர்வு செய்து, பின் டோக்கன் பெற உள்நுழையுங்கள்.",
    "Loading clinics…": "மருத்துவமனைகள் ஏற்றப்படுகின்றன…",
    "No clinics have registered yet.": "இன்னும் எந்த மருத்துவமனையும் பதிவு செய்யவில்லை.",
    "Shortest wait": "குறைந்த காத்திருப்பு",
    Idle: "செயலற்ற",
    "Est. wait (min)": "மதிப்பிட்ட காத்திருப்பு (நி)",
    rooms: "அறைகள்",
    "Waiting Room": "காத்திருப்பு அறை",
    "Please watch for": "கவனிக்கவும்",
    "your token": "உங்கள் டோக்கன்",
    "Now Serving": "இப்போது",
    "Waiting to start": "தொடங்க காத்திருக்கிறது",
    "Tokens in queue": "வரிசையில் டோக்கன்கள்",
    "Est. wait for last token (min)": "கடைசி டோக்கனுக்கு மதிப்பிட்ட காத்திருப்பு (நி)",
    "Up Next": "அடுத்து",
    "The queue is empty right now.": "இப்போது வரிசை காலியாக உள்ளது.",
    General: "பொது",
  },
};

const Ctx = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem("mq_lang") || "en"
  );
  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem("mq_lang", l);
  }, []);
  const t = useCallback(
    (s) => (lang !== "en" && DICT[lang] && DICT[lang][s]) || s,
    [lang]
  );
  return <Ctx.Provider value={{ t, lang, setLang }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx) || { t: (s) => s, lang: "en", setLang: () => {} };
}

export function LanguageSwitcher() {
  const { lang, setLang } = useT();
  return (
    <div className="lang-switch">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={lang === l.code ? "on" : ""}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

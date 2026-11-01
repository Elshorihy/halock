/**
 * HALOCK — i18n. Arabic is the default and fully RTL; English mirrors it.
 * Keep every user-visible string here so pages stay clean.
 */

export type Lang = "ar" | "en";

export interface Dict {
  dir: "rtl" | "ltr";
  app: { name: string; slogan: string };
  nav: { dashboard: string; focus: string; websites: string; tasks: string; stats: string; router: string; settings: string };
  common: {
    save: string; cancel: string; delete: string; edit: string; add: string; close: string;
    confirm: string; back: string; next: string; search: string; export: string; import: string;
    loading: string; empty: string; error: string; success: string; warning: string; info: string;
    yes: string; no: string; enabled: string; disabled: string; all: string; none: string;
    minutes: string; hours: string; today: string; week: string; total: string; optional: string;
    offline: string; localMode: string; localModeDesc: string; copy: string; copied: string;
    retry: string; notAvailable: string; unverified: string;
  },
  dashboard: {
    title: string;
    focusState: string;
    noActiveSession: string;
    noActiveDesc: string;
    startSession: string;
    resumeSession: string;
    remaining: string;
    progress: string;
    blockedCount: string;
    routerStatus: string;
    routerConnected: string;
    routerManual: string;
    routerNone: string;
    todaySummary: string;
    focusToday: string;
    sessionsDone: string;
    tasksDone: string;
    bestSession: string;
    weekFocus: string;
    quickAccess: string;
    quick: { focus: string; websites: string; tasks: string; stats: string; router: string; settings: string };
  },
  focus: {
    title: string;
    setupTitle: string;
    duration: string;
    customDuration: string;
    task: string;
    noTask: string;
    selectTask: string;
    blockedWebsites: string;
    blockingMode: string;
    blacklist: string;
    whitelist: string;
    whitelistWarningTitle: string;
    whitelistWarning: string;
    whitelistAck: string;
    modeBlacklistDesc: string;
    modeWhitelistDesc: string;
    confirmTitle: string;
    confirmDuration: string;
    confirmTask: string;
    confirmBlocked: string;
    confirmMethod: string;
    confirmRouter: string;
    blockingHonestNote: string;
    start: string;
    startAnyway: string;
    running: string;
    sessionActive: string;
    cannotPause: string;
    cannotPauseDesc: string;
    finished: string;
    finishedDesc: string;
    saveSession: string;
    saving: string;
    sessionSaved: string;
    sessionSavedDesc: string;
    backToDashboard: string;
    secondFocus: string;
    connected: string;
    interrupted: string;
    noDomains: string;
    taskOptional: string;
    recovered: string;
    recoveredDesc: string;
    duplicateAttempt: string;
  },
  websites: {
    title: string;
    desc: string;
    addWebsite: string;
    domainPlaceholder: string;
    category: string;
    categories: { social: string; video: string; gaming: string; other: string };
    count: string;
    search: string;
    exportJson: string;
    importJson: string;
    importResult: string;
    importErrors: string;
    duplicate: string;
    invalidDomain: string;
    added: string;
    updated: string;
    deleted: string;
    empty: string;
    emptyDesc: string;
    enableRule: string;
    disableRule: string;
    modeTitle: string;
    blacklistDesc: string;
    whitelistDesc: string;
    whitelistWarn: string;
    defaultsNote: string;
    deleteConfirm: string;
  },
  tasks: {
    title: string;
    addTask: string;
    editTask: string;
    taskTitle: string;
    categoryLabel: string;
    categoryPlaceholder: string;
    priority: string;
    priorities: { low: string; medium: string; high: string };
    dueDate: string;
    completed: string;
    pending: string;
    remaining: string;
    done: string;
    empty: string;
    emptyDesc: string;
    deleteConfirm: string;
    linkedSessions: string;
    markDone: string;
    markPending: string;
    overdue: string;
  },
  stats: {
    title: string;
    totalFocus: string;
    todaySessions: string;
    weekSessions: string;
    avgSession: string;
    completedTasks: string;
    bestSession: string;
    chart7: string;
    sessionsLog: string;
    filterDay: string;
    filter7: string;
    filter30: string;
    noData: string;
    noDataDesc: string;
    minutes: string;
    status: string;
    statuses: { active: string; completed: string; failed: string };
    date: string;
    duration: string;
  },
  router: {
    title: string;
    desc: string;
    integrationLayer: string;
    mode: string;
    manualMode: string;
    autoMode: string;
    autoUnsupported: string;
    autoUnsupportedDesc: string;
    proofTitle: string;
    proof: { official: string; auth: string; readable: string; writable: string; perDevice: string; restore: string };
    device: string;
    devicePlaceholder: string;
    routerUrl: string;
    routerUrlPlaceholder: string;
    saveConfig: string;
    saved: string;
    checklistTitle: string;
    checklistDesc: string;
    steps: {
      s1: string; s2: string; s3: string; s4: string; s5: string; s6: string;
      s7: string; s8: string; s9: string; s10: string;
    };
    progressSteps: string;
    statusIncomplete: string;
    statusComplete: string;
    testTitle: string;
    testDesc: string;
    testDomain: string;
    testRun: string;
    testing: string;
    testResults: { blocked: string; reachable: string; unverified: string; offline: string };
    logsTitle: string;
    logsDesc: string;
    logAction: string;
    logResult: string;
    logMessage: string;
    logDevice: string;
    logTime: string;
    noLogs: string;
    recoveryTitle: string;
    recoveryDesc: string;
    recoverySteps: string;
    securityNote: string;
    securityNoteDesc: string;
    honestNote: string;
    notConnected: string;
    manualStatus: string;
    restoreGuideTitle: string;
    restoreGuide: string;
    sessionRulesTitle: string;
    sessionRules: string;
  },
  settings: {
    title: string;
    language: string;
    theme: string;
    dark: string;
    light: string;
    sound: string;
    soundEnabled: string;
    volume: string;
    testSound: string;
    timerSettings: string;
    defaultDuration: string;
    defaultMode: string;
    confirmBeforeStart: string;
    notifications: string;
    account: string;
    accountLocal: string;
    accountLocalDesc: string;
    displayName: string;
    email: string;
    password: string;
    login: string;
    register: string;
    logout: string;
    deleteAccount: string;
    deleteAccountConfirm: string;
    deleteAccountDesc: string;
    dataExport: string;
    dataExportDesc: string;
    dataImport: string;
    dangerZone: string;
    clearLocalData: string;
    clearLocalConfirm: string;
    saved: string;
    authFailed: string;
    alreadyHave: string;
    noAccount: string;
  },
  pwa: {
    installTitle: string;
    installDesc: string;
    install: string;
    later: string;
  },
  toasts: {
    saved: string;
    deleted: string;
    error: string;
    copied: string;
    imported: string;
  },
}

const ar: Dict = {
  dir: "rtl",
  app: { name: "HALOCK", slogan: "اقفل المشتتات. افتح تركيزك." },
  nav: {
    dashboard: "الرئيسية", focus: "التركيز", websites: "المواقع", tasks: "المهام",
    stats: "الإحصائيات", router: "الراوتر", settings: "الإعدادات",
  },
  common: {
    save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل", add: "إضافة", close: "إغلاق",
    confirm: "تأكيد", back: "رجوع", next: "التالي", search: "بحث", export: "تصدير", import: "استيراد",
    loading: "جارٍ التحميل…", empty: "لا توجد بيانات", error: "خطأ", success: "تم", warning: "تنبيه",
    info: "معلومة", yes: "نعم", no: "لا", enabled: "مفعّل", disabled: "معطّل", all: "الكل", none: "لا شيء",
    minutes: "دقيقة", hours: "ساعة", today: "اليوم", week: "الأسبوع", total: "الإجمالي", optional: "اختياري",
    offline: "أنت غير متصل بالإنترنت — بعض الميزات محدودة.", localMode: "وضع محلي",
    localModeDesc: "الخادم غير متصل — بياناتك محفوظة على هذا الجهاز فقط.",
    copy: "نسخ", copied: "تم النسخ", retry: "إعادة المحاولة", notAvailable: "غير متاح",
    unverified: "تعذر التحقق",
  },
  dashboard: {
    title: "لوحة التحكم",
    focusState: "حالة التركيز",
    noActiveSession: "لا توجد جلسة نشطة",
    noActiveDesc: "ابدأ جلسة تركيز جديدة لحجب المشتتات والتركيز على عملك.",
    startSession: "بدء جلسة تركيز",
    resumeSession: "العودة إلى الجلسة",
    remaining: "الوقت المتبقي",
    progress: "التقدم",
    blockedCount: "مواقع في قائمة الحجب",
    routerStatus: "حالة الراوتر",
    routerConnected: "تكامل تلقائي",
    routerManual: "إعداد يدوي",
    routerNone: "بدون تكامل",
    todaySummary: "ملخص اليوم",
    focusToday: "وقت التركيز اليوم",
    sessionsDone: "جلسات مكتملة",
    tasksDone: "مهام مكتملة",
    bestSession: "أفضل جلسة",
    weekFocus: "وقت الأسبوع",
    quickAccess: "وصول سريع",
    quick: { focus: "جلسة التركيز", websites: "المواقع المحجوبة", tasks: "المهام", stats: "الإحصائيات", router: "إعدادات الراوتر", settings: "الإعدادات العامة" },
  },
  focus: {
    title: "جلسة التركيز",
    setupTitle: "جهّز جلستك",
    duration: "المدة",
    customDuration: "مدة مخصصة (1–180)",
    task: "المهمة",
    noTask: "بدون مهمة",
    selectTask: "اختر مهمة مرتبطة",
    blockedWebsites: "المواقع المشمولة",
    blockingMode: "نمط الحجب",
    blacklist: "قائمة الحظر",
    whitelist: "قائمة السماح",
    whitelistWarningTitle: "تحذير: وضع قائمة السماح",
    whitelistWarning: "في وضع قائمة السماح، سيُمنع كل شيء ما عدا المواقع المحددة. تأكد من إضافة كل المواقع التي تحتاجها (مثل مواقع العمل أو الدراسة) وإلا قد تفقد الوصول إليها.",
    whitelistAck: "فهمت التحذير",
    modeBlacklistDesc: "تُحجب المواقع المحددة فقط.",
    modeWhitelistDesc: "يُسمح بالمواقع المحددة فقط ويُحجب الباقي.",
    confirmTitle: "تأكيد بدء الجلسة",
    confirmDuration: "المدة",
    confirmTask: "المهمة",
    confirmBlocked: "المواقع",
    confirmMethod: "طريقة الحجب",
    confirmRouter: "حالة الراوتر",
    blockingHonestNote: "ملاحظة مهمة: موقع الويب لا يستطيع حجب المواقع من داخل المتصفح. الحجب الفعلي يتم عبر الراوتر أو أداة نظامية. لن تظهر رسالة نجاح الحجب إلا بعد التحقق الفعلي.",
    start: "بدء الجلسة",
    startAnyway: "بدء بدون حجب",
    running: "الجلسة جارية",
    sessionActive: "جلسة نشطة",
    cannotPause: "لا يمكن إيقاف الجلسة",
    cannotPauseDesc: "بعد البدء لا يمكن الإيقاف المؤقت أو الإنهاء المبكر أو تغيير المدة. تستمر الجلسة حتى يصل العداد إلى الصفر.",
    finished: "أحسنت! اكتملت الجلسة",
    finishedDesc: "لقد أكملت جلسة تركيز كاملة. تم تسجيلها.",
    saveSession: "حفظ الجلسة",
    saving: "جارٍ الحفظ…",
    sessionSaved: "تم حفظ الجلسة",
    sessionSavedDesc: "سجلنا جلستك بنجاح في الإحصائيات.",
    backToDashboard: "العودة للوحة التحكم",
    secondFocus: "ثانية",
    connected: "متصل",
    interrupted: "تم استرجاع جلسة سابقة",
    noDomains: "لا توجد مواقع محددة",
    taskOptional: "المهمة اختيارية",
    recovered: "وجدنا جلسة غير مكتملة",
    recoveredDesc: "أُغلق الموقع أثناء الجلسة أو انتهت المدة في غيابك. يمكنك حفظ الجلسة إذا اكتمل وقتها.",
    duplicateAttempt: "هذه الجلسة محفوظة بالفعل",
  },
  websites: {
    title: "المواقع المحجوبة",
    desc: "أدر قائمة المواقع التي تريد منعها (أو السماح بها) أثناء جلسات التركيز.",
    addWebsite: "إضافة موقع",
    domainPlaceholder: "example.com أو رابط كامل",
    category: "التصنيف",
    categories: { social: "تواصل اجتماعي", video: "فيديو وترفيه", gaming: "ألعاب", other: "أخرى" },
    count: "موقع",
    search: "ابحث في القائمة…",
    exportJson: "تصدير JSON",
    importJson: "استيراد JSON",
    importResult: "تم استيراد",
    importErrors: "أخطاء الاستيراد",
    duplicate: "هذا الموقع مضاف بالفعل",
    invalidDomain: "نطاق غير صالح",
    added: "تمت إضافة الموقع",
    updated: "تم التحديث",
    deleted: "تم الحذف",
    empty: "القائمة فارغة",
    emptyDesc: "أضف أول موقع لتبدأ.",
    enableRule: "تفعيل القاعدة",
    disableRule: "تعطيل القاعدة",
    modeTitle: "وضع الحجب",
    blacklistDesc: "حجب المواقع المحددة فقط (الوضع الافتراضي).",
    whitelistDesc: "السماح بالمواقع المحددة فقط وحجب كل ما عداها.",
    whitelistWarn: "تحذير: قد يمنع هذا المواقع المهمة غير المضافة.",
    defaultsNote: "تظهر مواقع افتراضية عند أول استخدام ويمكنك تعديلها أو حذفها.",
    deleteConfirm: "هل تريد حذف هذا الموقع؟",
  },
  tasks: {
    title: "المهام",
    addTask: "مهمة جديدة",
    editTask: "تعديل المهمة",
    taskTitle: "عنوان المهمة",
    categoryLabel: "المادة / التصنيف",
    categoryPlaceholder: "مثال: رياضيات",
    priority: "الأولوية",
    priorities: { low: "منخفضة", medium: "متوسطة", high: "عالية" },
    dueDate: "الموعد",
    completed: "مكتملة",
    pending: "قيد التنفيذ",
    remaining: "المتبقية",
    done: "المنجزة",
    empty: "لا توجد مهام",
    emptyDesc: "أضف مهمة لتتابع إنجازك.",
    deleteConfirm: "هل تريد حذف هذه المهمة؟",
    linkedSessions: "جلسات مرتبطة",
    markDone: "تحديد كمكتملة",
    markPending: "إرجاع للتنفيذ",
    overdue: "متأخرة",
  },
  stats: {
    title: "الإحصائيات",
    totalFocus: "إجمالي ساعات التركيز",
    todaySessions: "جلسات اليوم",
    weekSessions: "جلسات الأسبوع",
    avgSession: "متوسط مدة الجلسة",
    completedTasks: "المهام المكتملة",
    bestSession: "أفضل جلسة",
    chart7: "وقت التركيز (آخر 7 أيام)",
    sessionsLog: "سجل الجلسات",
    filterDay: "اليوم",
    filter7: "آخر 7 أيام",
    filter30: "آخر 30 يومًا",
    noData: "لا توجد بيانات بعد",
    noDataDesc: "أكمل أول جلسة تركيز لتظهر الإحصائيات.",
    minutes: "دقيقة",
    status: "الحالة",
    statuses: { active: "نشطة", completed: "مكتملة", failed: "فشلت" },
    date: "التاريخ",
    duration: "المدة",
  },
  router: {
    title: "تكامل الراوتر",
    desc: "اربط جهاز الراوتر (Huawei DN8245V) بجلسات التركيز لحجب المواقع على مستوى الشبكة.",
    integrationLayer: "طبقة التكامل",
    mode: "وضع التكامل",
    manualMode: "يدوي (موصى به)",
    autoMode: "تلقائي",
    autoUnsupported: "غير مدعوم حاليًا — يحتاج إلى تحقق من Firmware الراوتر",
    autoUnsupportedDesc: "لا يتوفر حتى الآن API موثق للتحكم في Website Filter في جهاز Huawei DN8245V. لن يدّعي HALOCK نجاح ربط لا يمكن إثباته. يمكنك التحقق من المتطلبات أدناه لتفعيل هذا الوضع مستقبلًا.",
    proofTitle: "متطلبات إثبات التفعيل",
    proof: {
      official: "وجود واجهة رسمية أو موثقة للتحكم",
      auth: "معرفة طريقة المصادقة المدعومة",
      readable: "معرفة إعدادات Website Filter التي يمكن قراءتها",
      writable: "معرفة الإعدادات التي يمكن تعديلها",
      perDevice: "إثبات إمكانية تطبيق التغييرات على جهاز محدد",
      restore: "اختبار إعادة التغييرات بعد انتهاء الجلسة",
    },
    device: "الجهاز المستهدف",
    devicePlaceholder: "اسم أو MAC للجهاز (مثال: Laptop-Student)",
    routerUrl: "رابط صفحة إعدادات الراوتر",
    routerUrlPlaceholder: "http://192.168.1.1",
    saveConfig: "حفظ الإعدادات",
    saved: "تم الحفظ",
    checklistTitle: "دليل الإعداد اليدوي",
    checklistDesc: "اتبع الخطوات التالية في صفحة إعدادات الراوتر. علّم كل خطوة عند إنجازها.",
    steps: {
      s1: "افتح صفحة إعدادات الراوتر (عادة 192.168.1.1) وسجّل الدخول بنفسك.",
      s2: "انتقل إلى Parental Control أو Website Filter.",
      s3: "اختر Apply on specified devices.",
      s4: "حدد الجهاز المطلوب من Device Table.",
      s5: "فعّل Website Filter (Enable Website Filter).",
      s6: "اختر Blacklist.",
      s7: "أضف المواقع المطلوبة إلى URL Address Table (من قائمة المواقع المحجوبة في HALOCK).",
      s8: "احفظ التغييرات.",
      s9: "جرّب فتح موقع محجوب من الجهاز المحدد للتأكد.",
      s10: "احفظ صورة أو ملاحظة للإعدادات السابقة قبل أي تغيير لاستعادتها لاحقًا.",
    },
    progressSteps: "الخطوات المكتملة",
    statusIncomplete: "الإعداد غير مكتمل",
    statusComplete: "الإعداد مكتمل يدويًا",
    testTitle: "اختبار الحجب",
    testDesc: "يحاول الاتصال بالموقع المحجوب من متصفحك. النتيجة مؤشرة فقط ولا تُعد إثباتًا قاطعًا.",
    testDomain: "النطاق للاختبار",
    testRun: "تشغيل الاختبار",
    testing: "جارٍ الاختبار…",
    testResults: {
      blocked: "يبدو أن الموقع محجوبًا (تعذر الاتصال).",
      reachable: "يبدو أن الموقع متاحًا (لم يُحجب بعد).",
      unverified: "تعذر التحقق من حالة الحجب.",
      offline: "لا يوجد اتصال بالإنترنت — لا يمكن إجراء الاختبار.",
    },
    logsTitle: "سجل عمليات الراوتر",
    logsDesc: "كل عملية حجب أو استعادة تُسجل هنا بوقتها ونتيجتها.",
    logAction: "العملية", logResult: "النتيجة", logMessage: "الرسالة", logDevice: "الجهاز", logTime: "الوقت",
    noLogs: "لا توجد عمليات مسجلة بعد.",
    recoveryTitle: "الاسترداد وإعادة الإعدادات",
    recoveryDesc: "إذا انقطع الاتصال أو فشل التكامل، استخدم هذا الدليل لإعادة الإنترنت واستعادة الإعدادات.",
    recoverySteps: "1) افتح صفحة الراوتر ← Parental Control. 2) أوقف Website Filter أو احذف قواعد HALOCK فقط. 3) اضغط Save. 4) تحقق من الاتصال بالإنترنت. 5) لا تحذف قواعد أخرى أنشأتها بنفسك.",
    securityNote: "أمان وخصوصية",
    securityNoteDesc: "لا تُرسل كلمات مرور الراوتر إلى أي خادم. HALOCK لا يخزن بيانات اعتماد الراوتر إطلاقًا. الإعداد اليدوي يتم بالكامل من جهازك.",
    honestNote: "لا يستطيع موقع ويب تغيير إعدادات الراوتر أو حجب المواقع من داخل المتصفح تلقائيًا. الوضع التلقائي غير مفعّل حتى يتوفر API موثق ومُختبر.",
    notConnected: "غير مرتبط",
    manualStatus: "الحالة",
    restoreGuideTitle: "استعادة الإعدادات السابقة",
    restoreGuide: "احتفظ دائمًا بصورة من إعدادات Parental Control قبل تعديلها. عند الرغبة في الإزالة: احذف قواعد HALOCK من URL Address Table فقط، وأعد تفعيل/تعطيل Website Filter كما كان.",
    sessionRulesTitle: "قواعد الجلسة مع الراوتر",
    sessionRules: "عند بدء الجلسة: تُجهّز قائمة المواقع ويُسجَّل الإجراء. لا يُعد أي موقع محجوبًا إلا بعد تطبيق القواعد والتحقق منها. عند الانتهاء: تُسجّل الجلسة ويُطلب استعادة الإعدادات يدويًا إن لزم.",
  },
  settings: {
    title: "الإعدادات",
    language: "اللغة",
    theme: "المظهر",
    dark: "داكن",
    light: "فاتح",
    sound: "الصوت",
    soundEnabled: "تشغيل صوت انتهاء الجلسة",
    volume: "مستوى الصوت",
    testSound: "تجربة الصوت",
    timerSettings: "إعدادات المؤقت",
    defaultDuration: "المدة الافتراضية",
    defaultMode: "نمط الحجب الافتراضي",
    confirmBeforeStart: "طلب التأكيد قبل بدء الجلسة",
    notifications: "إشعارات سطح المكتب",
    account: "الحساب",
    accountLocal: "وضع محلي بدون حساب",
    accountLocalDesc: "أنت تستخدم HALOCK بدون خادم. البيانات محفوظة في هذا المتصفح فقط. عند نشر الخادم يمكنك إنشاء حساب لمزامنة بياناتك.",
    displayName: "الاسم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    logout: "تسجيل الخروج",
    deleteAccount: "حذف الحساب والبيانات",
    deleteAccountConfirm: "تأكيد الحذف النهائي",
    deleteAccountDesc: "سيتم حذف حسابك وكل جلساتك ومهامك ومواقعك نهائيًا. لا يمكن التراجع.",
    dataExport: "تصدير البيانات",
    dataExportDesc: "تنزيل نسخة JSON من جلساتك ومهامك ومواقعك وإعداداتك.",
    dataImport: "استيراد البيانات",
    dangerZone: "منطقة الخطر",
    clearLocalData: "مسح البيانات المحلية",
    clearLocalConfirm: "سيتم مسح جميع البيانات المحلية. هل أنت متأكد؟",
    saved: "تم حفظ الإعدادات",
    authFailed: "فشل تسجيل الدخول — تحقق من البيانات",
    alreadyHave: "لديك حساب؟ سجّل الدخول",
    noAccount: "ليس لديك حساب؟ أنشئ واحدًا",
  },
  pwa: {
    installTitle: "تثبيت HALOCK",
    installDesc: "يمكنك تثبيت HALOCK كتطبيق ويب للوصول السريع.",
    install: "تثبيت",
    later: "لاحقًا",
  },
  toasts: {
    saved: "تم الحفظ", deleted: "تم الحذف", error: "حدث خطأ", copied: "تم النسخ", imported: "تم الاستيراد",
  },
};

const en: Dict = {
  dir: "ltr",
  app: { name: "HALOCK", slogan: "Lock the distractions. Open your focus." },
  nav: {
    dashboard: "Home", focus: "Focus", websites: "Websites", tasks: "Tasks",
    stats: "Stats", router: "Router", settings: "Settings",
  },
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add", close: "Close",
    confirm: "Confirm", back: "Back", next: "Next", search: "Search", export: "Export", import: "Import",
    loading: "Loading…", empty: "No data", error: "Error", success: "Done", warning: "Warning",
    info: "Info", yes: "Yes", no: "No", enabled: "Enabled", disabled: "Disabled", all: "All", none: "None",
    minutes: "min", hours: "hour", today: "Today", week: "Week", total: "Total", optional: "Optional",
    offline: "You are offline — some features are limited.", localMode: "Local mode",
    localModeDesc: "Server is unreachable — your data is stored on this device only.",
    copy: "Copy", copied: "Copied", retry: "Retry", notAvailable: "Not available",
    unverified: "Could not verify",
  },
  dashboard: {
    title: "Dashboard",
    focusState: "Focus state",
    noActiveSession: "No active session",
    noActiveDesc: "Start a new focus session to block distractions and get things done.",
    startSession: "Start focus session",
    resumeSession: "Back to session",
    remaining: "Remaining",
    progress: "Progress",
    blockedCount: "Sites in block list",
    routerStatus: "Router status",
    routerConnected: "Automatic integration",
    routerManual: "Manual setup",
    routerNone: "No integration",
    todaySummary: "Today's summary",
    focusToday: "Focus time today",
    sessionsDone: "Completed sessions",
    tasksDone: "Completed tasks",
    bestSession: "Best session",
    weekFocus: "This week",
    quickAccess: "Quick access",
    quick: { focus: "Focus session", websites: "Blocked websites", tasks: "Tasks", stats: "Statistics", router: "Router settings", settings: "General settings" },
  },
  focus: {
    title: "Focus session",
    setupTitle: "Set up your session",
    duration: "Duration",
    customDuration: "Custom (1–180)",
    task: "Task",
    noTask: "No task",
    selectTask: "Link a task",
    blockedWebsites: "Covered websites",
    blockingMode: "Blocking mode",
    blacklist: "Blacklist",
    whitelist: "Whitelist",
    whitelistWarningTitle: "Warning: Whitelist mode",
    whitelistWarning: "In whitelist mode everything except the selected sites will be blocked. Make sure to add every site you need (work, study), otherwise you may lose access to them.",
    whitelistAck: "I understand",
    modeBlacklistDesc: "Only the listed sites are blocked.",
    modeWhitelistDesc: "Only the listed sites are allowed; everything else is blocked.",
    confirmTitle: "Confirm session",
    confirmDuration: "Duration",
    confirmTask: "Task",
    confirmBlocked: "Websites",
    confirmMethod: "Blocking method",
    confirmRouter: "Router state",
    blockingHonestNote: "Important: a website cannot block sites from inside the browser. Actual blocking happens on the router or via a system-level tool. HALOCK never claims blocking succeeded without verification.",
    start: "Start session",
    startAnyway: "Start without blocking",
    running: "Session running",
    sessionActive: "Active session",
    cannotPause: "The session cannot be stopped",
    cannotPauseDesc: "After starting there is no pause, no early stop, and no duration change. The session runs until the counter reaches zero.",
    finished: "Well done! Session complete",
    finishedDesc: "You completed a full focus session. It has been recorded.",
    saveSession: "Save session",
    saving: "Saving…",
    sessionSaved: "Session saved",
    sessionSavedDesc: "Your session was recorded in your statistics.",
    backToDashboard: "Back to dashboard",
    secondFocus: "s",
    connected: "Connected",
    interrupted: "A previous session was recovered",
    noDomains: "No sites selected",
    taskOptional: "Task is optional",
    recovered: "We found an unfinished session",
    recoveredDesc: "The site was closed during the session, or time ran out while you were away. You can save the session once its time has elapsed.",
    duplicateAttempt: "This session is already saved",
  },
  websites: {
    title: "Blocked websites",
    desc: "Manage the sites to block (or allow) during focus sessions.",
    addWebsite: "Add website",
    domainPlaceholder: "example.com or a full URL",
    category: "Category",
    categories: { social: "Social", video: "Video & fun", gaming: "Gaming", other: "Other" },
    count: "sites",
    search: "Search the list…",
    exportJson: "Export JSON",
    importJson: "Import JSON",
    importResult: "Imported",
    importErrors: "Import errors",
    duplicate: "This site is already added",
    invalidDomain: "Invalid domain",
    added: "Website added",
    updated: "Updated",
    deleted: "Deleted",
    empty: "The list is empty",
    emptyDesc: "Add your first website to get started.",
    enableRule: "Enable rule",
    disableRule: "Disable rule",
    modeTitle: "Blocking mode",
    blacklistDesc: "Block only the listed sites (default).",
    whitelistDesc: "Allow only the listed sites and block everything else.",
    whitelistWarn: "Warning: this may block important sites that are not listed.",
    defaultsNote: "Starter sites appear on first use and can be edited or deleted.",
    deleteConfirm: "Delete this website?",
  },
  tasks: {
    title: "Tasks",
    addTask: "New task",
    editTask: "Edit task",
    taskTitle: "Task title",
    categoryLabel: "Subject / category",
    categoryPlaceholder: "e.g. Mathematics",
    priority: "Priority",
    priorities: { low: "Low", medium: "Medium", high: "High" },
    dueDate: "Due date",
    completed: "Completed",
    pending: "In progress",
    remaining: "Remaining",
    done: "Done",
    empty: "No tasks yet",
    emptyDesc: "Add a task to track your progress.",
    deleteConfirm: "Delete this task?",
    linkedSessions: "Linked sessions",
    markDone: "Mark completed",
    markPending: "Mark pending",
    overdue: "Overdue",
  },
  stats: {
    title: "Statistics",
    totalFocus: "Total focus time",
    todaySessions: "Sessions today",
    weekSessions: "Sessions this week",
    avgSession: "Average session",
    completedTasks: "Completed tasks",
    bestSession: "Best session",
    chart7: "Focus time (last 7 days)",
    sessionsLog: "Session log",
    filterDay: "Today",
    filter7: "Last 7 days",
    filter30: "Last 30 days",
    noData: "No data yet",
    noDataDesc: "Complete your first focus session to see statistics.",
    minutes: "min",
    status: "Status",
    statuses: { active: "Active", completed: "Completed", failed: "Failed" },
    date: "Date",
    duration: "Duration",
  },
  router: {
    title: "Router integration",
    desc: "Connect your router (Huawei DN8245V) to focus sessions to block sites at the network level.",
    integrationLayer: "Integration layer",
    mode: "Integration mode",
    manualMode: "Manual (recommended)",
    autoMode: "Automatic",
    autoUnsupported: "Currently unsupported — requires router firmware verification",
    autoUnsupportedDesc: "No documented API exists yet for controlling the Website Filter on the Huawei DN8245V. HALOCK will never claim a link works without proof. Check the requirements below to enable this mode in the future.",
    proofTitle: "Proof requirements before enabling",
    proof: {
      official: "An official or documented control interface exists",
      auth: "A supported authentication method is known",
      readable: "Website Filter settings that can be read are known",
      writable: "Settings that can be modified are known",
      perDevice: "Changes can be applied to a specific device (proven)",
      restore: "Restoring changes after a session is tested",
    },
    device: "Target device",
    devicePlaceholder: "Device name or MAC (e.g. Laptop-Student)",
    routerUrl: "Router admin page URL",
    routerUrlPlaceholder: "http://192.168.1.1",
    saveConfig: "Save configuration",
    saved: "Saved",
    checklistTitle: "Manual setup guide",
    checklistDesc: "Follow these steps on the router admin page. Check each step when done.",
    steps: {
      s1: "Open the router settings page (usually 192.168.1.1) and log in yourself.",
      s2: "Go to Parental Control or Website Filter.",
      s3: "Choose Apply on specified devices.",
      s4: "Select the target device from the Device Table.",
      s5: "Enable Website Filter.",
      s6: "Choose Blacklist.",
      s7: "Add the required sites to the URL Address Table (from your HALOCK block list).",
      s8: "Save the changes.",
      s9: "Try opening a blocked site from the target device to verify.",
      s10: "Keep a screenshot or note of your previous settings before any change.",
    },
    progressSteps: "Steps completed",
    statusIncomplete: "Setup incomplete",
    statusComplete: "Setup completed manually",
    testTitle: "Blocking test",
    testDesc: "Attempts to reach the blocked site from your browser. The result is an indicator only, not absolute proof.",
    testDomain: "Domain to test",
    testRun: "Run test",
    testing: "Testing…",
    testResults: {
      blocked: "The site appears to be blocked (connection failed).",
      reachable: "The site appears reachable (not blocked yet).",
      unverified: "Could not verify the blocking state.",
      offline: "No internet connection — the test cannot run.",
    },
    logsTitle: "Router operation log",
    logsDesc: "Every apply/restore operation is logged with time and result.",
    logAction: "Action", logResult: "Result", logMessage: "Message", logDevice: "Device", logTime: "Time",
    noLogs: "No operations logged yet.",
    recoveryTitle: "Recovery & restoring settings",
    recoveryDesc: "If the connection drops or the integration fails, use this guide to restore internet access and settings.",
    recoverySteps: "1) Open the router page → Parental Control. 2) Turn off Website Filter or delete only HALOCK rules. 3) Press Save. 4) Verify internet access. 5) Do not delete rules you created yourself.",
    securityNote: "Security & privacy",
    securityNoteDesc: "Router passwords are never sent to any server. HALOCK never stores router credentials. Manual setup happens entirely on your device.",
    honestNote: "A website cannot change router settings or block sites from inside the browser automatically. Automatic mode stays disabled until a documented, tested API exists.",
    notConnected: "Not linked",
    manualStatus: "Status",
    restoreGuideTitle: "Restoring previous settings",
    restoreGuide: "Always keep a screenshot of Parental Control settings before editing. To remove: delete only HALOCK rules from the URL Address Table and restore Website Filter to its previous state.",
    sessionRulesTitle: "Session rules with the router",
    sessionRules: "On session start: the site list is prepared and the action is logged. No site is considered blocked until rules are applied and verified. On session end: the session is recorded and restoring settings is a manual step if needed.",
  },
  settings: {
    title: "Settings",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    sound: "Sound",
    soundEnabled: "Play sound when a session ends",
    volume: "Volume",
    testSound: "Test sound",
    timerSettings: "Timer settings",
    defaultDuration: "Default duration",
    defaultMode: "Default blocking mode",
    confirmBeforeStart: "Ask for confirmation before starting",
    notifications: "Desktop notifications",
    account: "Account",
    accountLocal: "Local mode (no account)",
    accountLocalDesc: "You are using HALOCK without a server. Data is stored in this browser only. Once the server is deployed you can create an account to sync your data.",
    displayName: "Name",
    email: "Email",
    password: "Password",
    login: "Log in",
    register: "Create account",
    logout: "Log out",
    deleteAccount: "Delete account & data",
    deleteAccountConfirm: "Confirm permanent deletion",
    deleteAccountDesc: "Your account and all sessions, tasks and sites will be permanently deleted. This cannot be undone.",
    dataExport: "Export data",
    dataExportDesc: "Download a JSON copy of your sessions, tasks, sites and settings.",
    dataImport: "Import data",
    dangerZone: "Danger zone",
    clearLocalData: "Clear local data",
    clearLocalConfirm: "All local data will be erased. Are you sure?",
    saved: "Settings saved",
    authFailed: "Login failed — check your credentials",
    alreadyHave: "Already have an account? Log in",
    noAccount: "No account? Create one",
  },
  pwa: {
    installTitle: "Install HALOCK",
    installDesc: "Install HALOCK as a web app for quick access.",
    install: "Install",
    later: "Later",
  },
  toasts: {
    saved: "Saved", deleted: "Deleted", error: "Something went wrong", copied: "Copied", imported: "Imported",
  },
};

export const DICTS: Record<Lang, Dict> = { ar, en };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? ar;
}

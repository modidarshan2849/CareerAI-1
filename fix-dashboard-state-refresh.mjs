import fs from "fs";

const PAGE_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(PAGE_PATH)) {
  let code = fs.readFileSync(PAGE_PATH, "utf8");

  // Ensure state initializers safely load from localStorage without flickering or resetting
  const oldStateInit = `  const [activeTab, setActiveTab] = useState<"dashboard" | "preferences" | "resume">("dashboard");
  const [modeFilter, setModeFilter] = useState<WorkModeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [prefs, setPrefs] = useState<MasterPreferences>(DEFAULT_MASTER_PREFS);
  const [newTitle, setNewTitle] = useState("");
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem("careerai_master_prefs");
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setPrefs({
          ...DEFAULT_MASTER_PREFS,
          ...parsed,
          candidateExperienceYears: 12
        });
      }
      const savedTracked = localStorage.getItem("careerai_tracked_ids");
      if (savedTracked) {
        setTrackedIds(JSON.parse(savedTracked));
      }
    } catch {
      // fallback
    }
  }, []);`;

  const robustStateInit = `  const [activeTab, setActiveTab] = useState<"dashboard" | "preferences" | "resume">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("careerai_active_tab") as any) || "dashboard";
    }
    return "dashboard";
  });

  const [modeFilter, setModeFilter] = useState<WorkModeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");

  const [prefs, setPrefs] = useState<MasterPreferences>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("careerai_master_prefs");
        if (saved) return { ...DEFAULT_MASTER_PREFS, ...JSON.parse(saved), candidateExperienceYears: 12 };
      } catch {}
    }
    return DEFAULT_MASTER_PREFS;
  });

  const [newTitle, setNewTitle] = useState("");

  const [trackedIds, setTrackedIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("careerai_tracked_ids");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist active tab changes
  useEffect(() => {
    try {
      localStorage.setItem("careerai_active_tab", activeTab);
    } catch {}
  }, [activeTab]);`;

  if (code.includes('const [activeTab, setActiveTab]')) {
    code = code.replace(oldStateInit, robustStateInit);
    fs.writeFileSync(PAGE_PATH, code, "utf8");
    console.log("✅ Fixed React state refreshing with lazy localStorage initializers.");
  } else {
    console.log("⚠️ State pattern mismatch, check manual integration.");
  }
}

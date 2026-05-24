import { useState, useEffect } from "react";

const URL = "https://tkpwseiasagnzerodiwl.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcHdzZWlhc2Fnbnplcm9kaXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzM4OTIsImV4cCI6MjA5NTE0OTg5Mn0.wWN7IXRcEmGiIisR0k9Gc4TkQT6CuLCNF7Qk8_Gl9qQ";
const CORRECT_PIN = "0412";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Other"];

function getMonday(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy.toISOString().split("T")[0];
}

const headers = {
  "Content-Type": "application/json",
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Prefer": "return=representation",
};

async function sbGet(table, query = "") {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers });
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(`${URL}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  return res.json();
}

async function sbDelete(table, query) {
  await fetch(`${URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers });
}

export default function App() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [view, setView] = useState("library");
  const [recipes, setRecipes] = useState([]);
  const [weekPlan, setWeekPlan] = useState({});
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [cookStep, setCookStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shoppingChecked, setShoppingChecked] = useState({});
  const [weekStart] = useState(getMonday());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({ title: "", category: "Dinner", source_url: "", ingredients: "", steps: "", photo_url: "" });
  const [formError, setFormError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (authed) { fetchRecipes(); fetchWeekPlan(); }
  }, [authed]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function fetchRecipes() {
    const data = await sbGet("recipes", "order=created_at.desc");
    setRecipes(Array.isArray(data) ? data : []);
  }

  async function fetchWeekPlan() {
    const data = await sbGet("week_plan", `week_start=eq.${weekStart}&select=*,recipes(*)`);
    const plan = {};
    (Array.isArray(data) ? data : []).forEach(row => { plan[row.day] = row; });
    setWeekPlan(plan);
  }

  async function saveRecipe(recipe) {
    setLoading(true);
    await sbPost("recipes", recipe);
    setLoading(false);
    showToast("Recipe saved!");
    fetchRecipes();
    setView("library");
  }

  async function deleteRecipe(id) {
    await sbDelete("week_plan", `recipe_id=eq.${id}`);
    await sbDelete("recipes", `id=eq.${id}`);
    showToast("Recipe deleted");
    fetchRecipes();
    fetchWeekPlan();
    setSelectedRecipe(null);
    setView("library");
  }

  async function assignDay(day, recipeId) {
    const existing = weekPlan[day];
    if (existing) {
      await sbPatch("week_plan", `id=eq.${existing.id}`, { recipe_id: recipeId });
    } else {
      await sbPost("week_plan", { day, recipe_id: recipeId, week_start: weekStart });
    }
    fetchWeekPlan();
    showToast(`Assigned to ${day}!`);
  }

  async function unassignDay(day) {
    const existing = weekPlan[day];
    if (existing) {
      await sbDelete("week_plan", `id=eq.${existing.id}`);
      fetchWeekPlan();
    }
  }

  function handlePinSubmit() {
    if (pin === CORRECT_PIN) {
      setAuthed(true);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 800);
    }
  }

  function handleFormSubmit() {
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    const recipe = {
      title: form.title.trim(),
      category: form.category,
      source_url: form.source_url.trim() || null,
      photo_url: form.photo_url.trim() || null,
      ingredients: form.ingredients.split("\n").filter(l => l.trim()),
      steps: form.steps.split("\n").filter(l => l.trim()),
    };
    saveRecipe(recipe);
    setForm({ title: "", category: "Dinner", source_url: "", ingredients: "", steps: "", photo_url: "" });
    setFormError("");
  }

  function handleJsonUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.title) { setUploadError("Invalid recipe file — missing title."); return; }
        saveRecipe({
          title: data.title,
          category: data.category || "Dinner",
          source_url: data.source_url || null,
          photo_url: data.photo_url || null,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          steps: Array.isArray(data.steps) ? data.steps : [],
        });
        setUploadError("");
      } catch {
        setUploadError("Could not parse file. Make sure it's a valid recipe JSON.");
      }
    };
    reader.readAsText(file);
  }

  const filteredRecipes = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || r.category === filterCat;
    return matchSearch && matchCat;
  });

  // ─── PIN SCREEN ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={styles.pinScreen}>
        <div style={styles.pinCard}>
          <div style={styles.pinLogo}>🍽️</div>
          <h1 style={styles.pinTitle}>Our Recipes</h1>
          <p style={styles.pinSub}>Enter PIN to continue</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ ...styles.pinDot, background: pin.length > i ? "#e07b4a" : "#3a3a3a" }} />
            ))}
          </div>
          <div style={styles.pinGrid}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
              <button key={i}
                style={{ ...styles.pinBtn, ...(k === "" ? { opacity: 0, pointerEvents: "none" } : {}), ...(pinError ? { background: "#5a1a1a" } : {}) }}
                onClick={() => {
                  if (k === "⌫") setPin(p => p.slice(0, -1));
                  else if (k !== "" && pin.length < 4) setPin(p => p + k);
                }}>{k}</button>
            ))}
          </div>
          <button style={styles.pinEnter} onClick={handlePinSubmit}>Enter</button>
          {pinError && <p style={{ color: "#e07b4a", textAlign: "center", marginTop: 8 }}>Wrong PIN</p>}
        </div>
      </div>
    );
  }

  // ─── COOK MODE ────────────────────────────────────────────────────────────
  if (view === "cook" && selectedRecipe) {
    const steps = selectedRecipe.steps || [];
    return (
      <div style={styles.cookScreen}>
        <div style={styles.cookHeader}>
          <button style={styles.backBtn} onClick={() => { setView("library"); setCookStep(0); }}>← Back</button>
          <span style={styles.cookTitle}>{selectedRecipe.title}</span>
        </div>
        <div style={styles.cookBody}>
          <div style={styles.cookStepNum}>Step {cookStep + 1} of {steps.length}</div>
          <div style={styles.cookStepText}>{steps[cookStep]}</div>
          <div style={styles.cookNav}>
            <button style={{ ...styles.cookNavBtn, opacity: cookStep === 0 ? 0.3 : 1 }} disabled={cookStep === 0} onClick={() => setCookStep(s => s - 1)}>← Prev</button>
            {cookStep < steps.length - 1
              ? <button style={styles.cookNavBtn} onClick={() => setCookStep(s => s + 1)}>Next →</button>
              : <button style={{ ...styles.cookNavBtn, background: "#4caf50" }} onClick={() => { setView("library"); setCookStep(0); }}>Done ✓</button>}
          </div>
          <div style={styles.cookIngBox}>
            <div style={styles.cookIngTitle}>Ingredients</div>
            {(selectedRecipe.ingredients || []).map((ing, i) => <div key={i} style={styles.cookIng}>• {ing}</div>)}
          </div>
        </div>
      </div>
    );
  }

  // ─── RECIPE DETAIL ────────────────────────────────────────────────────────
  if (view === "detail" && selectedRecipe) {
    return (
      <div style={styles.screen}>
        <div style={styles.detailHeader}>
          <button style={styles.backBtn} onClick={() => setView("library")}>← Back</button>
          <button style={{ ...styles.backBtn, color: "#e07b4a" }} onClick={() => deleteRecipe(selectedRecipe.id)}>Delete</button>
        </div>
        {selectedRecipe.photo_url && <img src={selectedRecipe.photo_url} alt="" style={styles.detailPhoto} />}
        <div style={styles.detailBody}>
          <div style={styles.detailCat}>{selectedRecipe.category}</div>
          <h2 style={styles.detailTitle}>{selectedRecipe.title}</h2>
          {selectedRecipe.source_url && <a href={selectedRecipe.source_url} target="_blank" style={styles.detailLink}>View original source ↗</a>}
          <div style={styles.sectionLabel}>Ingredients</div>
          {(selectedRecipe.ingredients || []).map((ing, i) => <div key={i} style={styles.listItem}>• {ing}</div>)}
          <div style={styles.sectionLabel}>Steps</div>
          {(selectedRecipe.steps || []).map((step, i) => (
            <div key={i} style={styles.listItem}>
              <span style={styles.stepNum}>{i+1}</span> {step}
            </div>
          ))}
          <div style={styles.sectionLabel}>Add to week plan</div>
          <div style={styles.dayGrid}>
            {DAYS.map(day => (
              <button key={day}
                style={{ ...styles.dayBtn, ...(weekPlan[day]?.recipe_id === selectedRecipe.id ? styles.dayBtnActive : {}) }}
                onClick={() => assignDay(day, selectedRecipe.id)}>
                {day.slice(0,3)}
              </button>
            ))}
          </div>
          <button style={styles.cookBtn} onClick={() => { setCookStep(0); setView("cook"); }}>🍳 Start Cooking</button>
        </div>
      </div>
    );
  }

  // ─── MAIN VIEWS ───────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.header}>
        <span style={styles.headerTitle}>🍽️ Our Recipes</span>
      </div>

      <div style={styles.content}>

        {/* LIBRARY */}
        {view === "library" && (
          <div>
            <div style={styles.searchRow}>
              <input style={styles.searchInput} placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={styles.catRow}>
              {["All", ...CATEGORIES].map(c => (
                <button key={c} style={{ ...styles.catBtn, ...(filterCat === c ? styles.catBtnActive : {}) }} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
            {filteredRecipes.length === 0 && <div style={styles.empty}>No recipes yet. Add one!</div>}
            <div style={styles.recipeGrid}>
              {filteredRecipes.map(r => (
                <div key={r.id} style={styles.recipeCard} onClick={() => { setSelectedRecipe(r); setView("detail"); }}>
                  {r.photo_url
                    ? <img src={r.photo_url} alt="" style={styles.recipeThumb} />
                    : <div style={styles.recipePlaceholder}>🍴</div>}
                  <div style={styles.recipeCardBody}>
                    <div style={styles.recipeCardCat}>{r.category}</div>
                    <div style={styles.recipeCardTitle}>{r.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADD RECIPE */}
        {view === "add" && (
          <div style={styles.formWrap}>
            <h2 style={styles.formHeading}>Add Recipe</h2>
            <div style={styles.uploadBox}>
              <div style={styles.uploadLabel}>📎 Upload from Claude JSON</div>
              <label style={styles.uploadBtn}>
                Choose file
                <input type="file" accept=".json" style={{ display: "none" }} onChange={handleJsonUpload} />
              </label>
              {uploadError && <div style={{ color: "#e07b4a", fontSize: 13, marginTop: 6 }}>{uploadError}</div>}
            </div>
            <div style={styles.divider}>— or fill in manually —</div>
            <label style={styles.label}>Title *</label>
            <input style={styles.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Pasta Carbonara" />
            <label style={styles.label}>Category</label>
            <select style={styles.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label style={styles.label}>Source URL (optional)</label>
            <input style={styles.input} value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://..." />
            <label style={styles.label}>Photo URL (optional)</label>
            <input style={styles.input} value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="https://..." />
            <label style={styles.label}>Ingredients (one per line)</label>
            <textarea style={styles.textarea} value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} placeholder={"200g pasta\n2 eggs\n100g pancetta"} rows={5} />
            <label style={styles.label}>Steps (one per line)</label>
            <textarea style={styles.textarea} value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} placeholder={"Boil pasta\nFry pancetta\nMix eggs and cheese"} rows={5} />
            {formError && <div style={{ color: "#e07b4a", marginBottom: 8 }}>{formError}</div>}
            <button style={styles.submitBtn} onClick={handleFormSubmit} disabled={loading}>{loading ? "Saving..." : "Save Recipe"}</button>
          </div>
        )}

        {/* WEEK PLANNER */}
        {view === "planner" && (
          <div>
            <h2 style={styles.formHeading}>This Week's Dinners</h2>
            {DAYS.map(day => {
              const row = weekPlan[day];
              const recipe = row?.recipes;
              return (
                <div key={day} style={styles.plannerRow}>
                  <div style={styles.plannerDay}>{day}</div>
                  {recipe
                    ? <div style={styles.plannerRecipe}>
                        <span style={styles.plannerRecipeName} onClick={() => { setSelectedRecipe(recipe); setView("detail"); }}>{recipe.title}</span>
                        <button style={styles.plannerRemove} onClick={() => unassignDay(day)}>✕</button>
                      </div>
                    : <div style={styles.plannerEmpty}>
                        <select style={styles.plannerSelect} defaultValue="" onChange={e => { if (e.target.value) assignDay(day, e.target.value); }}>
                          <option value="" disabled>Pick a recipe...</option>
                          {recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                        </select>
                      </div>}
                </div>
              );
            })}
          </div>
        )}

        {/* SHOPPING LIST */}
        {view === "shopping" && (
          <div>
            <h2 style={styles.formHeading}>Shopping List</h2>
            {Object.keys(weekPlan).length === 0
              ? <div style={styles.empty}>Plan your week first to generate a shopping list.</div>
              : <>
                  <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>Tick what you already have</div>
                  {DAYS.map(day => {
                    const row = weekPlan[day];
                    if (!row?.recipes) return null;
                    const ings = row.recipes.ingredients || [];
                    if (ings.length === 0) return null;
                    return (
                      <div key={day} style={{ marginBottom: 18 }}>
                        <div style={styles.shopDayLabel}>{day} — {row.recipes.title}</div>
                        {ings.map((ing, i) => {
                          const key = `${day}-${i}`;
                          return (
                            <div key={key} style={styles.shopItem} onClick={() => setShoppingChecked(c => ({ ...c, [key]: !c[key] }))}>
                              <div style={{ ...styles.shopCheck, ...(shoppingChecked[key] ? styles.shopCheckDone : {}) }}>
                                {shoppingChecked[key] ? "✓" : ""}
                              </div>
                              <span style={{ textDecoration: shoppingChecked[key] ? "line-through" : "none", color: shoppingChecked[key] ? "#555" : "#eee" }}>{ing}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={styles.nav}>
        {[
          { id: "library", icon: "📚", label: "Recipes" },
          { id: "add", icon: "➕", label: "Add" },
          { id: "planner", icon: "📅", label: "Planner" },
          { id: "shopping", icon: "🛒", label: "Shopping" },
        ].map(tab => (
          <button key={tab.id} style={{ ...styles.navBtn, ...(view === tab.id ? styles.navBtnActive : {}) }} onClick={() => setView(tab.id)}>
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  pinScreen: { minHeight: "100vh", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  pinCard: { background: "#1a1a1a", borderRadius: 24, padding: "40px 32px", maxWidth: 320, width: "100%", textAlign: "center" },
  pinLogo: { fontSize: 48, marginBottom: 8 },
  pinTitle: { color: "#fff", fontFamily: "'Georgia', serif", fontSize: 28, margin: "0 0 4px" },
  pinSub: { color: "#888", fontSize: 14, marginBottom: 8 },
  pinDot: { width: 14, height: 14, borderRadius: "50%", transition: "background 0.2s" },
  pinGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "0 auto 16px", maxWidth: 220 },
  pinBtn: { background: "#2a2a2a", border: "none", borderRadius: 12, color: "#fff", fontSize: 20, padding: "14px 0", cursor: "pointer", transition: "background 0.15s" },
  pinEnter: { background: "#e07b4a", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, padding: "12px 40px", cursor: "pointer", width: "100%" },
  app: { minHeight: "100vh", background: "#111", color: "#eee", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative", fontFamily: "'Georgia', serif" },
  header: { background: "#1a1a1a", padding: "16px 20px", borderBottom: "1px solid #2a2a2a", position: "sticky", top: 0, zIndex: 10 },
  headerTitle: { fontSize: 20, fontWeight: 700, color: "#fff" },
  content: { flex: 1, padding: "16px 16px 90px", overflowY: "auto" },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#e07b4a", color: "#fff", padding: "10px 24px", borderRadius: 20, fontSize: 14, zIndex: 100, fontFamily: "sans-serif" },
  searchRow: { marginBottom: 10 },
  searchInput: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, color: "#eee", padding: "10px 14px", fontSize: 15, boxSizing: "border-box" },
  catRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 },
  catBtn: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 20, color: "#aaa", padding: "6px 14px", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" },
  catBtnActive: { background: "#e07b4a", border: "1px solid #e07b4a", color: "#fff" },
  empty: { color: "#666", textAlign: "center", marginTop: 60, fontSize: 15 },
  recipeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  recipeCard: { background: "#1a1a1a", borderRadius: 14, overflow: "hidden", cursor: "pointer", border: "1px solid #2a2a2a" },
  recipeThumb: { width: "100%", height: 110, objectFit: "cover" },
  recipePlaceholder: { width: "100%", height: 110, background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 },
  recipeCardBody: { padding: "10px 12px 12px" },
  recipeCardCat: { fontSize: 11, color: "#e07b4a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  recipeCardTitle: { fontSize: 14, color: "#fff", fontWeight: 600, lineHeight: 1.3 },
  screen: { minHeight: "100vh", background: "#111", color: "#eee", maxWidth: 480, margin: "0 auto", fontFamily: "'Georgia', serif", paddingBottom: 40 },
  detailHeader: { display: "flex", justifyContent: "space-between", padding: "14px 16px" },
  backBtn: { background: "none", border: "none", color: "#aaa", fontSize: 15, cursor: "pointer", padding: 0 },
  detailPhoto: { width: "100%", height: 220, objectFit: "cover" },
  detailBody: { padding: "16px 16px 40px" },
  detailCat: { fontSize: 11, color: "#e07b4a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  detailTitle: { fontSize: 26, color: "#fff", margin: "0 0 8px", fontFamily: "'Georgia', serif" },
  detailLink: { color: "#e07b4a", fontSize: 13, display: "block", marginBottom: 16 },
  sectionLabel: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 20, marginBottom: 10, borderBottom: "1px solid #2a2a2a", paddingBottom: 6 },
  listItem: { color: "#ddd", fontSize: 15, marginBottom: 6, lineHeight: 1.5, display: "flex", gap: 8 },
  stepNum: { background: "#e07b4a", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 1 },
  dayGrid: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 },
  dayBtn: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, color: "#aaa", padding: "8px 12px", fontSize: 13, cursor: "pointer" },
  dayBtnActive: { background: "#e07b4a", border: "1px solid #e07b4a", color: "#fff" },
  cookBtn: { background: "#e07b4a", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, padding: "14px 0", width: "100%", cursor: "pointer", marginTop: 8 },
  cookScreen: { minHeight: "100vh", background: "#0d0d0d", color: "#eee", maxWidth: 480, margin: "0 auto", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" },
  cookHeader: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#1a1a1a" },
  cookTitle: { fontSize: 16, fontWeight: 600, color: "#fff" },
  cookBody: { flex: 1, padding: "32px 20px 20px", display: "flex", flexDirection: "column" },
  cookStepNum: { fontSize: 13, color: "#e07b4a", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 },
  cookStepText: { fontSize: 22, color: "#fff", lineHeight: 1.6, flex: 1, fontFamily: "'Georgia', serif" },
  cookNav: { display: "flex", gap: 12, marginTop: 32, marginBottom: 24 },
  cookNavBtn: { flex: 1, background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, color: "#fff", fontSize: 16, padding: "14px 0", cursor: "pointer" },
  cookIngBox: { background: "#1a1a1a", borderRadius: 14, padding: "14px 16px" },
  cookIngTitle: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },
  cookIng: { color: "#ccc", fontSize: 14, marginBottom: 4 },
  formWrap: { paddingBottom: 40 },
  formHeading: { color: "#fff", fontFamily: "'Georgia', serif", fontSize: 22, marginBottom: 16 },
  uploadBox: { background: "#1a1a1a", border: "1px dashed #444", borderRadius: 12, padding: "16px", marginBottom: 16, textAlign: "center" },
  uploadLabel: { color: "#aaa", fontSize: 14, marginBottom: 10 },
  uploadBtn: { background: "#e07b4a", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, padding: "8px 20px", cursor: "pointer", display: "inline-block" },
  divider: { color: "#555", textAlign: "center", fontSize: 13, margin: "16px 0" },
  label: { display: "block", color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, color: "#eee", padding: "10px 14px", fontSize: 15, boxSizing: "border-box" },
  textarea: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, color: "#eee", padding: "10px 14px", fontSize: 15, boxSizing: "border-box", resize: "vertical" },
  submitBtn: { background: "#e07b4a", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, padding: "14px 0", width: "100%", cursor: "pointer", marginTop: 20 },
  plannerRow: { background: "#1a1a1a", borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 },
  plannerDay: { color: "#e07b4a", fontSize: 13, fontWeight: 700, width: 80, flexShrink: 0 },
  plannerRecipe: { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" },
  plannerRecipeName: { color: "#fff", fontSize: 14, cursor: "pointer", textDecoration: "underline" },
  plannerRemove: { background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer" },
  plannerEmpty: { flex: 1 },
  plannerSelect: { background: "#2a2a2a", border: "1px solid #444", borderRadius: 8, color: "#aaa", padding: "6px 10px", fontSize: 13, width: "100%" },
  shopDayLabel: { fontSize: 13, color: "#e07b4a", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  shopItem: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #1e1e1e", cursor: "pointer" },
  shopCheck: { width: 22, height: 22, borderRadius: 6, border: "2px solid #444", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" },
  shopCheckDone: { background: "#4caf50", border: "2px solid #4caf50" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#1a1a1a", borderTop: "1px solid #2a2a2a", display: "flex", zIndex: 20 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#666", padding: "10px 0 14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  navBtnActive: { color: "#e07b4a" },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
};

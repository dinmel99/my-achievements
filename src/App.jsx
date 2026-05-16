import { useState, useEffect } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "finance",  label: "Финансы",     icon: "💰", color: "#c8a96e" },
  { id: "career",   label: "Карьера",     icon: "🚀", color: "#7ecfc0" },
  { id: "health",   label: "Здоровье",    icon: "⚡", color: "#e07c6a" },
  { id: "travel",   label: "Путешествия", icon: "✈️", color: "#9b8fe8" },
  { id: "growth",   label: "Развитие",    icon: "📚", color: "#72c47e" },
  { id: "media",    label: "Медийность",  icon: "🎙️", color: "#e8a472" },
  { id: "family",   label: "Семья",       icon: "❤️", color: "#e87296" },
  { id: "other",    label: "Другое",      icon: "⭐", color: "#b0b0b0" },
];

const RARITY = [
  { id: "common",    label: "Обычная",     xp: 50,   color: "#9ca3af", glow: "rgba(156,163,175,0.3)" },
  { id: "rare",      label: "Редкая",      xp: 150,  color: "#60a5fa", glow: "rgba(96,165,250,0.3)" },
  { id: "epic",      label: "Эпическая",   xp: 400,  color: "#a78bfa", glow: "rgba(167,139,250,0.4)" },
  { id: "legendary", label: "Легендарная", xp: 1000, color: "#f59e0b", glow: "rgba(245,158,11,0.5)" },
];

const SEED_ACHIEVEMENTS = [
  { id: "ach1", title: "Ипотека закрыта", desc: "650 000 ₽ — и эта глава закрыта навсегда", category: "finance", rarity: "epic", reward: "Ужин в хорошем ресторане", xp: 400, unlocked: false, date: null },
  { id: "ach2", title: "Первый выход в Простор", desc: "Новая роль, новая система, новый уровень", category: "career", rarity: "rare", reward: "Новые кроссовки", xp: 150, unlocked: false, date: null },
  { id: "ach3", title: "Китай покорён", desc: "500 000 ₽ накоплено и поездка состоялась", category: "travel", rarity: "epic", reward: "Впечатления на всю жизнь", xp: 400, unlocked: false, date: null },
  { id: "ach4", title: "Первый агентский партнёр", desc: "Подписан первый партнёрский договор в Просторе", category: "career", rarity: "rare", reward: "Хороший виски", xp: 150, unlocked: false, date: null },
  { id: "ach5", title: "Медийная личность", desc: "1000 подписчиков в Telegram канале", category: "media", rarity: "epic", reward: "Профессиональная фотосессия", xp: 400, unlocked: false, date: null },
  { id: "ach6", title: "Папа", desc: "Самое важное достижение в жизни", category: "family", rarity: "legendary", reward: "Навсегда в сердце", xp: 1000, unlocked: false, date: null },
  { id: "ach7", title: "Ремонт сделан", desc: "Квартира преображена — 3 млн потрачены с умом", category: "finance", rarity: "epic", reward: "Вечеринка на новоселье", xp: 400, unlocked: false, date: null },
  { id: "ach8", title: "Первое выступление на форуме", desc: "Сцена, микрофон, аудитория — и ты в своей стихии", category: "media", rarity: "rare", reward: "Новый костюм", xp: 150, unlocked: false, date: null },
];

function getLevelInfo(xp) {
  const levels = [
    { level: 1, title: "Новичок",       min: 0 },
    { level: 2, title: "Искатель",      min: 200 },
    { level: 3, title: "Путник",        min: 500 },
    { level: 4, title: "Исследователь", min: 1000 },
    { level: 5, title: "Мастер",        min: 2000 },
    { level: 6, title: "Эксперт",       min: 3500 },
    { level: 7, title: "Легенда",       min: 6000 },
    { level: 8, title: "Гений",         min: 10000 },
  ];
  let current = levels[0], next = levels[1];
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].min) { current = levels[i]; next = levels[i + 1] || null; }
  }
  const progress = next ? Math.round(((xp - current.min) / (next.min - current.min)) * 100) : 100;
  return { ...current, next, progress, nextMin: next?.min || current.min };
}

// Extract Google Sheet ID from URL
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Fetch & parse Google Sheet (must be public "anyone with link can view")
async function fetchSheetData(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // Strip JSONP wrapper: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const jsonStr = text.replace(/^[^{]*/, "").replace(/\);?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const rows = data.table?.rows || [];
  const achievements = [];
  rows.forEach((row, i) => {
    if (i === 0) return; // skip header row if present
    const cells = row.c || [];
    const get = (idx) => cells[idx]?.v?.toString().trim() || "";
    const title = get(0);
    if (!title) return;
    const rawCategory = get(2).toLowerCase();
    const rawRarity = get(3).toLowerCase();
    const validCategory = CATEGORIES.find(c => c.id === rawCategory) ? rawCategory : "other";
    const validRarity = RARITY.find(r => r.id === rawRarity) ? rawRarity : "common";
    const rar = RARITY.find(r => r.id === validRarity);
    achievements.push({
      id: `sheet_${i}_${Date.now()}`,
      title,
      desc: get(1),
      category: validCategory,
      rarity: validRarity,
      reward: get(4),
      xp: rar.xp,
      unlocked: false,
      date: null,
    });
  });
  return achievements;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0a0f0d",
    color: "#e8e4da",
    fontFamily: "'Jost', sans-serif",
    maxWidth: 480,
    width: "100%",
    margin: "0 auto",
    position: "relative",
    paddingBottom: 80,
    overflowX: "hidden",
  },  
  header: {
    padding: "28px 20px 20px",
    borderBottom: "1px solid rgba(200,169,110,0.12)",
    background: "linear-gradient(180deg, rgba(44,74,62,0.2) 0%, transparent 100%)",
    boxSizing: "border-box",
  },  
  heroName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 28, fontWeight: 600, color: "#f0ebe0", marginBottom: 2,
  },
  heroTitle: {
    fontSize: 12, fontWeight: 400, color: "#c8a96e",
    letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16,
  },
  xpBar: { height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  xpFill: (pct) => ({
    height: "100%", width: `${pct}%`,
    background: "linear-gradient(90deg, #c8a96e, #e8c98e)",
    borderRadius: 3, transition: "width 0.8s ease",
  }),
  xpText: { fontSize: 11, color: "rgba(200,169,110,0.6)", display: "flex", justifyContent: "space-between" },
  statsRow: { display: "flex", gap: 10, marginTop: 16 },
  statCard: {
    flex: 1, background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", textAlign: "center",
  },
  statNum: { fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: "#c8a96e" },
  statLabel: { fontSize: 10, color: "rgba(232,228,218,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" },
  nav: {
    display: "flex",
    background: "rgba(10,15,13,0.95)",
    borderTop: "1px solid rgba(200,169,110,0.1)",
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480, zIndex: 100,
  },
  navBtn: (active) => ({
    flex: 1, padding: "12px 0 10px", background: "none", border: "none", cursor: "pointer",
    color: active ? "#c8a96e" : "rgba(232,228,218,0.3)",
    fontSize: 10, fontFamily: "'Jost', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase",
    transition: "color 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  }),
  section: { padding: "20px 16px" },
  sectionTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "#f0ebe0", marginBottom: 4 },
  sectionSub: { fontSize: 12, color: "rgba(232,228,218,0.4)", marginBottom: 16 },
  achCard: (rarity, unlocked) => ({
    background: unlocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
    border: `1px solid ${unlocked ? rarity.color + "44" : "rgba(255,255,255,0.06)"}`,
    borderRadius: 14, padding: "16px", marginBottom: 10, position: "relative", overflow: "hidden",
    transition: "all 0.3s ease", opacity: unlocked ? 1 : 0.6,
    boxShadow: unlocked ? `0 0 20px ${rarity.glow}` : "none",
  }),
  achGlow: (rarity) => ({
    position: "absolute", top: 0, right: 0, width: 80, height: 80,
    background: `radial-gradient(circle, ${rarity.glow} 0%, transparent 70%)`, pointerEvents: "none",
  }),
  achHeader: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  achIcon: (cat) => ({
    width: 40, height: 40, background: `${cat.color}22`, border: `1px solid ${cat.color}44`,
    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
  }),
  achTitle: { fontSize: 15, fontWeight: 600, color: "#f0ebe0", marginBottom: 2 },
  achDesc: { fontSize: 12, color: "rgba(232,228,218,0.5)", lineHeight: 1.4 },
  achMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  rarityBadge: (rarity) => ({
    fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
    color: rarity.color, background: `${rarity.color}18`, padding: "3px 8px", borderRadius: 20,
  }),
  xpBadge: { fontSize: 11, color: "rgba(200,169,110,0.7)", fontWeight: 500 },
  unlockBtn: (rarity) => ({
    background: `linear-gradient(135deg, ${rarity.color}22, ${rarity.color}44)`,
    border: `1px solid ${rarity.color}66`, borderRadius: 8, color: rarity.color,
    fontSize: 12, fontWeight: 600, padding: "8px 16px", cursor: "pointer",
    width: "100%", marginTop: 10, fontFamily: "'Jost', sans-serif", letterSpacing: "0.05em", transition: "all 0.2s",
  }),
  reward: { fontSize: 11, color: "rgba(232,228,218,0.4)", marginTop: 8, display: "flex", gap: 6, alignItems: "center" },
  modal: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
  },
  modalBox: {
    background: "#0f1a15", border: "1px solid rgba(200,169,110,0.3)",
    borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto",
  },
  input: {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#e8e4da", fontSize: 14,
    fontFamily: "'Jost', sans-serif", marginBottom: 10, outline: "none", boxSizing: "border-box",
  },
  select: {
    width: "100%", background: "#0f1a15", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#e8e4da", fontSize: 14,
    fontFamily: "'Jost', sans-serif", marginBottom: 10, outline: "none", boxSizing: "border-box",
  },
  label: { fontSize: 11, color: "rgba(200,169,110,0.7)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, display: "block" },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "linear-gradient(135deg, #c8a96e, #e8c98e)" : "rgba(255,255,255,0.05)",
    border: variant === "primary" ? "none" : "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, color: variant === "primary" ? "#0a0f0d" : "#e8e4da",
    fontSize: 13, fontWeight: 600, padding: "12px 20px", cursor: "pointer",
    fontFamily: "'Jost', sans-serif", letterSpacing: "0.05em",
  }),
  filterRow: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none" },
  filterBtn: (active, color) => ({
    flexShrink: 0,
    background: active ? "rgba(200,169,110,0.2)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "rgba(200,169,110,0.5)" : "rgba(255,255,255,0.07)"}`,
    borderRadius: 20, color: active ? (color || "#c8a96e") : "rgba(232,228,218,0.5)",
    fontSize: 11, padding: "6px 14px", cursor: "pointer",
    fontFamily: "'Jost', sans-serif", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
  }),
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(232,228,218,0.3)", fontSize: 13 },
  celebOverlay: {
    position: "fixed", inset: 0, zIndex: 300,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)",
  },
  celebBox: {
    textAlign: "center",
    animation: "popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
    padding: 32,
  },
  // Settings-specific
  settingsCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: 20, marginBottom: 16,
  },
  settingsCardTitle: { fontSize: 14, fontWeight: 600, color: "#f0ebe0", marginBottom: 4 },
  settingsCardSub: { fontSize: 12, color: "rgba(232,228,218,0.4)", marginBottom: 16, lineHeight: 1.5 },
  syncStatus: (type) => ({
    fontSize: 12, padding: "10px 14px", borderRadius: 10, marginTop: 10,
    background: type === "success" ? "rgba(114,196,126,0.12)" : type === "error" ? "rgba(224,124,106,0.12)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${type === "success" ? "rgba(114,196,126,0.3)" : type === "error" ? "rgba(224,124,106,0.3)" : "rgba(255,255,255,0.08)"}`,
    color: type === "success" ? "#72c47e" : type === "error" ? "#e07c6a" : "rgba(232,228,218,0.5)",
    lineHeight: 1.5,
  }),
  sheetSchemaRow: {
    display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4,
  },
  schemaCell: (color) => ({
    flexShrink: 0, background: `${color}18`, border: `1px solid ${color}33`,
    borderRadius: 8, padding: "6px 12px", fontSize: 11, color: color,
  }),
  dangerBtn: {
    background: "rgba(224,124,106,0.1)", border: "1px solid rgba(224,124,106,0.25)",
    borderRadius: 10, color: "#e07c6a", fontSize: 12, fontWeight: 600,
    padding: "10px 16px", cursor: "pointer", fontFamily: "'Jost', sans-serif",
    letterSpacing: "0.05em", width: "100%",
  },
};

// ── Celebration overlay ────────────────────────────────────────────────────────
function CelebOverlay({ ach, onClose }) {
  const cat = CATEGORIES.find(c => c.id === ach.category);
  const rar = RARITY.find(r => r.id === ach.rarity);
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={S.celebOverlay} onClick={onClose}>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}`}</style>
      <div style={S.celebBox}>
        <div style={{ fontSize: 72, marginBottom: 16, filter: `drop-shadow(0 0 30px ${rar.glow})` }}>{cat.icon}</div>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: rar.color, marginBottom: 8 }}>Ачивка разблокирована!</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#f0ebe0", marginBottom: 8 }}>{ach.title}</div>
        <div style={{ fontSize: 14, color: "rgba(232,228,218,0.6)", marginBottom: 20 }}>{ach.desc}</div>
        <div style={{ background: `${rar.color}22`, border: `1px solid ${rar.color}44`, borderRadius: 12, padding: "12px 20px", display: "inline-block" }}>
          <div style={{ fontSize: 11, color: "rgba(232,228,218,0.5)", marginBottom: 4 }}>Награда</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: rar.color }}>{ach.reward}</div>
        </div>
        <div style={{ marginTop: 16, fontSize: 20, fontFamily: "'Cormorant Garamond', serif", color: "#c8a96e" }}>+{rar.xp} XP</div>
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab({ achievements, setAchievements, sheetUrl, setSheetUrl }) {
  const [urlInput, setUrlInput] = useState(sheetUrl || "");
  const [syncStatus, setSyncStatus] = useState(null); // null | {type, msg}
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    const sheetId = extractSheetId(urlInput.trim());
    if (!sheetId) {
      setSyncStatus({ type: "error", msg: "Не удалось извлечь ID таблицы. Убедись, что ссылка правильная." });
      return;
    }
    setSyncing(true);
    setSyncStatus({ type: "loading", msg: "Загружаю данные из Google Sheets..." });
    try {
      const sheetAchs = await fetchSheetData(sheetId);
      if (sheetAchs.length === 0) {
        setSyncStatus({ type: "error", msg: "Таблица пустая или данные не распознаны. Проверь формат колонок." });
        setSyncing(false);
        return;
      }
      // Merge: keep unlocked status for matching titles, add new ones
      const merged = (() => {
  const unlockedMap = {};
  achievements.forEach(a => { if (a.unlocked) unlockedMap[a.title.toLowerCase()] = a; });
  return sheetAchs.map(a => {
    const existing = unlockedMap[a.title.toLowerCase()];
    return existing ? { ...a, id: existing.id, unlocked: existing.unlocked, date: existing.date } : a;
  });
})();
setAchievements(merged);
try { localStorage.setItem("din_achievements", JSON.stringify(merged)); } catch {}
      setSheetUrl(urlInput.trim());
      setSyncStatus({ type: "success", msg: `Загружено ${sheetAchs.length} достижений из таблицы. Уже разблокированные сохранены.` });
    } catch (e) {
      setSyncStatus({ type: "error", msg: `Ошибка: ${e.message}. Проверь, что таблица открыта «для всех по ссылке».` });
    }
    setSyncing(false);
  };

  const handleReset = () => {
    if (!window.confirm("Сбросить все достижения к стандартным? Прогресс будет потерян.")) return;
    setAchievements(SEED_ACHIEVEMENTS);
    setSyncStatus({ type: "success", msg: "Достижения сброшены к стандартным." });
  };

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Настройки</div>
      <div style={S.sectionSub}>Синхронизация и управление данными</div>

      {/* Google Sheets sync */}
      <div style={S.settingsCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div style={S.settingsCardTitle}>Google Sheets</div>
        </div>
        <div style={S.settingsCardSub}>
          Создай таблицу с 5 колонками и открой доступ «Все, у кого есть ссылка — могут просматривать». Первая строка — заголовки, данные начинаются со второй.
        </div>

        {/* Schema preview */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(232,228,218,0.35)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Структура таблицы</div>
          <div style={S.sheetSchemaRow}>
            {[
              { col: "A · title", color: "#c8a96e" },
              { col: "B · desc", color: "#7ecfc0" },
              { col: "C · category", color: "#9b8fe8" },
              { col: "D · rarity", color: "#60a5fa" },
              { col: "E · reward", color: "#72c47e" },
            ].map(({ col, color }) => (
              <div key={col} style={S.schemaCell(color)}>{col}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(232,228,218,0.3)", lineHeight: 1.6 }}>
            <b style={{ color: "rgba(200,169,110,0.6)" }}>category:</b> finance · career · health · travel · growth · media · family · other<br />
            <b style={{ color: "rgba(200,169,110,0.6)" }}>rarity:</b> common · rare · epic · legendary
          </div>
        </div>

        <label style={S.label}>Ссылка на таблицу</label>
        <input
          style={{ ...S.input, marginBottom: 8 }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
        />

        <button
          style={{ ...S.btn("primary"), width: "100%", opacity: syncing ? 0.6 : 1 }}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Загружаю..." : "🔄 Синхронизировать"}
        </button>

        {syncStatus && (
          <div style={S.syncStatus(syncStatus.type)}>{syncStatus.msg}</div>
        )}

        {sheetUrl && !syncStatus && (
          <div style={{ ...S.syncStatus(""), marginTop: 10 }}>
            Последняя синхронизация: {sheetUrl.slice(0, 50)}...
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div style={{ ...S.settingsCard, borderColor: "rgba(224,124,106,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ ...S.settingsCardTitle, color: "#e07c6a" }}>Сброс данных</div>
        </div>
        <div style={S.settingsCardSub}>Вернуть стандартный набор достижений. Весь прогресс будет удалён.</div>
        <button style={S.dangerBtn} onClick={handleReset}>Сбросить к начальным данным</button>
      </div>

      {/* Stats summary */}
      <div style={S.settingsCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <div style={S.settingsCardTitle}>Текущий набор</div>
        </div>
        {RARITY.map(r => {
          const count = achievements.filter(a => a.rarity === r.id).length;
          const unlocked = achievements.filter(a => a.rarity === r.id && a.unlocked).length;
          if (count === 0) return null;
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: r.color }}>{r.label}</span>
              <span style={{ color: "rgba(232,228,218,0.5)" }}>{unlocked}/{count} · {count * r.xp} XP max</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("achievements");
  const [achievements, setAchievements] = useState([]);
  const [filter, setFilter] = useState("all");
  const [rarFilter, setRarFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [celebrating, setCelebrating] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  const [form, setForm] = useState({ title: "", desc: "", category: "career", rarity: "common", reward: "" });

  // Load from storage
  useEffect(() => {
  try {
    const saved = localStorage.getItem("din_achievements");
    const savedUrl = localStorage.getItem("din_sheet_url");
    if (saved) setAchievements(JSON.parse(saved));
    else setAchievements(SEED_ACHIEVEMENTS);
    if (savedUrl) setSheetUrl(savedUrl);
  } catch {
    setAchievements(SEED_ACHIEVEMENTS);
  }
  setLoaded(true);
}, []);

  // Save achievements to storage
  useEffect(() => {
  if (!loaded) return;
  try { localStorage.setItem("din_achievements", JSON.stringify(achievements)); } catch {}
}, [achievements, loaded]);

  // Save sheet URL to storage
  useEffect(() => {
  if (!loaded || !sheetUrl) return;
  try { localStorage.setItem("din_sheet_url", sheetUrl); } catch {}
}, [sheetUrl, loaded]);

  const totalXP = achievements.filter(a => a.unlocked).reduce((sum, a) => {
    const rar = RARITY.find(r => r.id === a.rarity);
    return sum + (rar?.xp || 0);
  }, 0);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const levelInfo = getLevelInfo(totalXP);

  const unlock = (id) => {
    const ach = achievements.find(a => a.id === id);
    if (!ach || ach.unlocked) return;
    setAchievements(prev => prev.map(a =>
      a.id === id ? { ...a, unlocked: true, date: new Date().toLocaleDateString("ru-RU") } : a
    ));
    setCelebrating(ach);
  };

  const addAchievement = () => {
    if (!form.title.trim()) return;
    const rar = RARITY.find(r => r.id === form.rarity);
    const newAch = {
      id: "ach_" + Date.now(), title: form.title, desc: form.desc,
      category: form.category, rarity: form.rarity, reward: form.reward,
      xp: rar.xp, unlocked: false, date: null,
    };
    setAchievements(prev => [...prev, newAch]);
    setForm({ title: "", desc: "", category: "career", rarity: "common", reward: "" });
    setShowAdd(false);
  };

  const filtered = achievements.filter(a => {
    const catOk = filter === "all" || a.category === filter;
    const rarOk = rarFilter === "all" || a.rarity === rarFilter;
    return catOk && rarOk;
  });

  if (!loaded) return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ color: "#c8a96e", fontSize: 14 }}>Загрузка...</div>
    </div>
  );

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0f0d; }
        ::-webkit-scrollbar { width: 0; }
        input::placeholder, textarea::placeholder { color: rgba(232,228,218,0.25); }
        button:active { opacity: 0.8; transform: scale(0.98); }
        select option { background: #0f1a15; }
      `}</style>

      {celebrating && <CelebOverlay ach={celebrating} onClose={() => setCelebrating(null)} />}

      {/* Header */}
      <div style={S.header}>
        <div style={S.heroName}>Дин Мелдебеков</div>
        <div style={S.heroTitle}>{levelInfo.title} · Уровень {levelInfo.level}</div>
        <div style={S.xpBar}><div style={S.xpFill(levelInfo.progress)} /></div>
        <div style={S.xpText}>
          <span>{totalXP} XP</span>
          <span>{levelInfo.next ? `до ${levelInfo.next.title}: ${levelInfo.nextMin - totalXP} XP` : "Максимальный уровень"}</span>
        </div>
        <div style={S.statsRow}>
          {[
            { num: unlockedCount, label: "Ачивок" },
            { num: totalXP,       label: "Опыт" },
            { num: achievements.length, label: "Всего" },
            { num: levelInfo.level, label: "Уровень" },
          ].map(({ num, label }) => (
            <div key={label} style={S.statCard}>
              <div style={S.statNum}>{num}</div>
              <div style={S.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements tab */}
      {tab === "achievements" && (
        <div style={S.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={S.sectionTitle}>Достижения</div>
              <div style={S.sectionSub}>{unlockedCount} из {achievements.length} разблокировано</div>
            </div>
            <button onClick={() => setShowAdd(true)} style={{ ...S.btn("primary"), padding: "10px 16px", fontSize: 12 }}>+ Добавить</button>
          </div>

          <div style={S.filterRow}>
            <button style={S.filterBtn(filter === "all")} onClick={() => setFilter("all")}>Все</button>
            {CATEGORIES.map(c => (
              <button key={c.id} style={S.filterBtn(filter === c.id)} onClick={() => setFilter(c.id)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div style={S.filterRow}>
            <button style={S.filterBtn(rarFilter === "all")} onClick={() => setRarFilter("all")}>Все редкости</button>
            {RARITY.map(r => (
              <button key={r.id} style={S.filterBtn(rarFilter === r.id, r.color)} onClick={() => setRarFilter(r.id)}>
                {r.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 && <div style={S.empty}>Нет достижений в этой категории</div>}

          {filtered.map(ach => {
            const cat = CATEGORIES.find(c => c.id === ach.category);
            const rar = RARITY.find(r => r.id === ach.rarity);
            return (
              <div key={ach.id} style={S.achCard(rar, ach.unlocked)}>
                <div style={S.achGlow(rar)} />
                <div style={S.achHeader}>
                  <div style={S.achIcon(cat)}>{ach.unlocked ? cat.icon : "🔒"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.achTitle}>{ach.title}</div>
                    <div style={S.achDesc}>{ach.desc}</div>
                  </div>
                </div>
                <div style={S.achMeta}>
                  <span style={S.rarityBadge(rar)}>{rar.label}</span>
                  <span style={S.xpBadge}>+{rar.xp} XP</span>
                </div>
                {ach.reward && <div style={S.reward}><span>🎁</span><span>{ach.reward}</span></div>}
                {ach.unlocked
                  ? <div style={{ fontSize: 11, color: "rgba(200,169,110,0.5)", marginTop: 8, textAlign: "right" }}>✓ Получено {ach.date}</div>
                  : <button style={S.unlockBtn(rar)} onClick={() => unlock(ach.id)}>🏆 Разблокировать</button>
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Profile tab */}
      {tab === "profile" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Профиль героя</div>
          <div style={S.sectionSub}>Твой путь в цифрах</div>
          {CATEGORIES.map(cat => {
            const catAchs = achievements.filter(a => a.category === cat.id);
            const catUnlocked = catAchs.filter(a => a.unlocked).length;
            if (catAchs.length === 0) return null;
            const pct = Math.round((catUnlocked / catAchs.length) * 100);
            return (
              <div key={cat.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span>{cat.icon} {cat.label}</span>
                  <span style={{ color: cat.color, fontWeight: 600 }}>{catUnlocked}/{catAchs.length}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: cat.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ebe0", marginBottom: 12 }}>Полученные ачивки</div>
            {achievements.filter(a => a.unlocked).length === 0 && (
              <div style={S.empty}>Пока нет разблокированных достижений.<br />Начни своё приключение!</div>
            )}
            {achievements.filter(a => a.unlocked).map(ach => {
              const cat = CATEGORIES.find(c => c.id === ach.category);
              const rar = RARITY.find(r => r.id === ach.rarity);
              return (
                <div key={ach.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ ...S.achIcon(cat), width: 36, height: 36, fontSize: 16, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ebe0" }}>{ach.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(232,228,218,0.4)" }}>{ach.date}</div>
                  </div>
                  <div style={{ ...S.rarityBadge(rar), flexShrink: 0 }}>+{rar.xp}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <SettingsTab
          achievements={achievements}
          setAchievements={setAchievements}
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
        />
      )}

      {/* Bottom nav */}
      <div style={S.nav}>
        {[
          { id: "achievements", icon: "🏆", label: "Ачивки" },
          { id: "profile",      icon: "👤", label: "Профиль" },
          { id: "settings",     icon: "⚙️", label: "Настройки" },
        ].map(t => (
          <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Add achievement modal */}
      {showAdd && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={S.modalBox}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: "#f0ebe0", marginBottom: 20 }}>Новое достижение</div>
            <label style={S.label}>Название</label>
            <input style={S.input} placeholder="Например: Первая сделка в Просторе" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <label style={S.label}>Описание</label>
            <input style={S.input} placeholder="Что это значит для тебя?" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
            <label style={S.label}>Категория</label>
            <select style={S.select} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <label style={S.label}>Редкость</label>
            <select style={S.select} value={form.rarity} onChange={e => setForm(p => ({ ...p, rarity: e.target.value }))}>
              {RARITY.map(r => <option key={r.id} value={r.id}>{r.label} (+{r.xp} XP)</option>)}
            </select>
            <label style={S.label}>Материальная награда</label>
            <input style={S.input} placeholder="Что подаришь себе за это?" value={form.reward} onChange={e => setForm(p => ({ ...p, reward: e.target.value }))} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={() => setShowAdd(false)}>Отмена</button>
              <button style={{ ...S.btn("primary"), flex: 2 }} onClick={addAchievement}>Создать ачивку</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

const SHEET_ID = "15HCv3ia-Xd4ztHvnapwjBevgWzmm7aVXHF-aDwj2cNg";
const TOTAL_ASSIGNMENT_PROGRESS = 187198;
const PROGRESS_ADJUSTMENT = 0;

const TABS = [
  { id: "petugas", label: "Pendataan by Petugas" },
  { id: "sls", label: "Pendataan by SLS" },
  { id: "kecamatan", label: "Progres Kecamatan" },
];

const SOURCES = {
  petugas: {
    gid: "1335155335",
    columns: ["A", "B", "C", "E", "G", "F", "H", "I", "R", "T"],
  },
  sls: {
    gid: "253272285",
    columns: ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "V"],
  },
  kecamatan: {
    gid: "8973368",
    columns: ["W", "X", "Y", "Z", "AA", "AB", "AI", "AJ"],
    limit: 13,
  },
};

const TABLE_COLUMNS = {
  petugas: [
    ["nama", "Nama Petugas"], ["jabatan", "Jabatan"], ["kecamatan", "Kecamatan"],
    ["open", "Open", "number"], ["submitted", "Submitted by Pencacah", "number"],
    ["approved", "Approved by Pengawas", "number"], ["draft", "Draft", "number"],
    ["rejected", "Rejected by Pengawas", "number"], ["assignment", "Total Assignment", "number"],
    ["persentase", "Persentase", "percent"],
  ],
  sls: [
    ["regionCode", "Kode SLS"], ["totalRegion", "Target", "number"], ["open", "Open", "number"],
    ["submitted", "Submitted", "number"], ["approved", "Approved", "number"], ["draft", "Draft", "number"],
    ["rejected", "Rejected", "number"], ["editedAdmin", "Edited Admin", "number"],
    ["completedAdmin", "Completed Admin", "number"], ["revokedPengawas", "Revoked Pengawas", "number"],
    ["submittedRespondent", "Submitted Responden", "number"], ["editedPengawas", "Edited Pengawas", "number"],
    ["rejectedAdmin", "Rejected Admin", "number"], ["revokedAdmin", "Revoked Admin", "number"],
    ["ppl", "PPL"], ["pml", "PML"], ["totalSubmit", "Total Submit", "number"],
    ["progres", "Progres SLS", "percent"], ["selesai", "SLS Selesai", "number"],
  ],
  kecamatan: [
    ["kecamatan", "Kecamatan"], ["open", "Open", "number"],
    ["approve", "Approved by Pengawas", "number"], ["submit", "Submitted by Pencacah", "number"],
    ["draft", "Draft", "number"], ["reject", "Rejected by Pengawas", "number"],
    ["totalSubmit", "Total Submit", "number"],
    ["persentaseSubmit", "Persentase Submit Terhadap Total Assignment", "percent"],
  ],
};

function buildCsvUrl(source) {
  const limit = source.limit ? ` limit ${source.limit}` : "";
  const query = encodeURIComponent(`select ${source.columns.join(",")}${limit}`);
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${source.gid}&headers=1&tq=${query}&_=${Date.now()}`;
}

function toNumber(value) {
  const number = parseFloat(String(value ?? "").replace(/%|,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

function toPercentage(value) {
  const text = String(value ?? "").trim();
  let number = toNumber(text);
  if (!text.includes("%") && number > 0 && number <= 1) number *= 100;
  return number;
}

function currentDateWita() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar",
  }).format(new Date());
}

function splitHeaderLabel(label) {
  const words = label.split(" ");
  if (words.length < 3 || label.length <= 16) return [label];

  let splitAt = 1;
  let smallestDifference = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const firstLength = words.slice(0, i).join(" ").length;
    const secondLength = words.slice(i).join(" ").length;
    const difference = Math.abs(firstLength - secondLength);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitAt = i;
    }
  }
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")];
}

function mapRows(type, rows) {
  return rows.slice(1).map((r) => {
    if (type === "petugas") return {
      nama: String(r[0] ?? "").trim(), jabatan: String(r[1] ?? "").trim() || "-",
      kecamatan: String(r[2] ?? "").trim() || "-", open: toNumber(r[3]), submitted: toNumber(r[4]),
      approved: toNumber(r[5]), draft: toNumber(r[6]), rejected: toNumber(r[7]),
      assignment: toNumber(r[8]), persentase: toPercentage(r[9]),
    };
    if (type === "sls") return {
      regionCode: String(r[0] ?? "").trim(), totalRegion: toNumber(r[1]), open: toNumber(r[2]),
      submitted: toNumber(r[3]), approved: toNumber(r[4]), draft: toNumber(r[5]), rejected: toNumber(r[6]),
      editedAdmin: toNumber(r[7]), completedAdmin: toNumber(r[8]), revokedPengawas: toNumber(r[9]),
      submittedRespondent: toNumber(r[10]), editedPengawas: toNumber(r[11]), rejectedAdmin: toNumber(r[12]),
      revokedAdmin: toNumber(r[13]), ppl: String(r[14] ?? "").trim() || "-", pml: String(r[15] ?? "").trim() || "-",
      totalSubmit: toNumber(r[16]), progres: toPercentage(r[17]), selesai: toNumber(r[18]),
    };
    return {
      kecamatan: String(r[0] ?? "").trim() || "TOTAL", open: toNumber(r[1]), approve: toNumber(r[2]),
      submit: toNumber(r[3]), draft: toNumber(r[4]), reject: toNumber(r[5]),
      totalSubmit: toNumber(r[6]), persentaseSubmit: toPercentage(r[7]),
    };
  }).filter((r) => {
    if (type === "sls") return r.regionCode;
    if (type === "petugas") return r.nama;
    return r.kecamatan !== "TOTAL" || r.open || r.submit || r.approve || r.draft || r.reject || r.totalSubmit || r.persentaseSubmit;
  });
}

function progressClass(value) {
  if (value >= 100) return "bg-emerald-100 text-emerald-700";
  if (value >= 40) return "bg-blue-100 text-blue-700";
  if (value > 0) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default function App() {
  const [activeTab, setActiveTab] = useState("petugas");
  const [datasets, setDatasets] = useState({ petugas: [], sls: [], kecamatan: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [jabatanFilter, setJabatanFilter] = useState("all");
  const [kecamatanFilter, setKecamatanFilter] = useState("all");
  const [showTopPpl, setShowTopPpl] = useState(false);
  const [sort, setSort] = useState({ key: null, desc: true });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, source]) => {
          const response = await fetch(buildCsvUrl(source), { cache: "no-store" });
          if (!response.ok) throw new Error(`Gagal mengambil data ${key}`);
          const csv = await response.text();
          const parsed = Papa.parse(csv, { header: false, skipEmptyLines: true });
          return [key, mapRows(key, parsed.data || [])];
        }));
        if (active) {
          setDatasets(Object.fromEntries(entries));
        }
      } catch (e) { if (active) setError(e.message || "Terjadi kesalahan saat memuat data"); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [reloadToken]);

  useEffect(() => {
    setSearch("");
    setJabatanFilter("all");
    setKecamatanFilter("all");
    setSort({ key: null, desc: true });
  }, [activeTab]);

  const filterOptions = useMemo(() => {
    const rows = datasets[activeTab] || [];
    const unique = (key) => [...new Set(rows.map((row) => row[key]).filter((value) => value && value !== "-"))]
      .sort((a, b) => String(a).localeCompare(String(b), "id"));
    return { jabatan: unique("jabatan"), kecamatan: unique("kecamatan") };
  }, [activeTab, datasets]);

  const visibleRows = useMemo(() => {
    let rows = datasets[activeTab] || [];
    if (activeTab === "petugas" && jabatanFilter !== "all") {
      rows = rows.filter((row) => row.jabatan === jabatanFilter);
    }
    if (activeTab === "petugas" && kecamatanFilter !== "all") {
      rows = rows.filter((row) => row.kecamatan === kecamatanFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) rows = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)));
    if (sort.key) rows = [...rows].sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "id");
      return sort.desc ? -result : result;
    });
    return rows;
  }, [activeTab, datasets, search, jabatanFilter, kecamatanFilter, sort]);

  const summary = useMemo(() => {
    const pmlRows = datasets.petugas.filter((row) => row.jabatan.toUpperCase() === "PML");
    const totals = pmlRows.reduce((result, row) => ({
      open: result.open + row.open,
      approved: result.approved + row.approved,
      draft: result.draft + row.draft,
      rejected: result.rejected + row.rejected,
    }), {
      open: 0, approved: 0, draft: 0, rejected: 0,
    });

    const submittedAssignment = TOTAL_ASSIGNMENT_PROGRESS - totals.open - totals.draft;
    return {
      averageProgress: (submittedAssignment / TOTAL_ASSIGNMENT_PROGRESS) * 100 + PROGRESS_ADJUSTMENT,
      totalDraft: totals.draft,
      totalApproved: totals.approved,
      totalRejected: totals.rejected,
    };
  }, [datasets.petugas]);

  const topPplRows = useMemo(() => datasets.petugas
    .filter((row) => row.jabatan.toUpperCase() === "PPL")
    .sort((a, b) => b.persentase - a.persentase)
    .slice(0, 5), [datasets.petugas]);

  const topKecamatanRanks = useMemo(() => new Map(datasets.kecamatan
    .filter((row) => row.kecamatan !== "TOTAL")
    .sort((a, b) => b.persentaseSubmit - a.persentaseSubmit)
    .slice(0, 5)
    .map((row, index) => [row.kecamatan, index + 1])), [datasets.kecamatan]);

  function handleSort(key) {
    setSort((current) => current.key === key ? { key, desc: !current.desc } : { key, desc: true });
  }

  const columns = TABLE_COLUMNS[activeTab];
  const title = TABS.find((tab) => tab.id === activeTab)?.label;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-orange-600 to-orange-400 text-white px-6 py-5 shadow">
        <div className="max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-widest opacity-90">Badan Pusat Statistik</p>
            <h1 className="text-2xl font-bold mt-1">Monitoring Petugas Pencacahan</h1><p className="text-sm opacity-90">BPS Kabupaten Pinrang</p></div>
          <div className="text-right text-sm"><p className="opacity-80">Data diperbarui pada hari</p>
            <p className="font-semibold">{currentDateWita()}</p>
            <p className="font-semibold">Pukul 08.00 WITA</p>
            <button onClick={() => setReloadToken((n) => n + 1)} disabled={loading}
              className="mt-2 text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium transition">
              {loading ? "Memuat..." : "↻ Refresh Data"}</button></div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-[1500px] mx-auto">
        {!loading && !error && <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5" aria-label="Ringkasan pendataan PML">
          <div className="bg-blue-500 text-white rounded-xl p-4 shadow-md">
            <p className="text-xs font-medium opacity-90">Progress Pendataan</p>
            <p className="text-2xl font-bold mt-1">{summary.averageProgress.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
            <p className="text-xs mt-2 opacity-80">seluruh assignment PML</p>
          </div>
          <div className="bg-amber-500 text-white rounded-xl p-4 shadow-md">
            <p className="text-xs font-medium opacity-90">Total Draft</p>
            <p className="text-2xl font-bold mt-1">{summary.totalDraft.toLocaleString("id-ID")}</p>
            <p className="text-xs mt-2 opacity-80">seluruh PML</p>
          </div>
          <div className="bg-emerald-500 text-white rounded-xl p-4 shadow-md">
            <p className="text-xs font-medium opacity-90">Total Approved Pengawas</p>
            <p className="text-2xl font-bold mt-1">{summary.totalApproved.toLocaleString("id-ID")}</p>
            <p className="text-xs mt-2 opacity-80">seluruh PML</p>
          </div>
          <div className="bg-rose-500 text-white rounded-xl p-4 shadow-md">
            <p className="text-xs font-medium opacity-90">Total Rejected Pengawas</p>
            <p className="text-2xl font-bold mt-1">{summary.totalRejected.toLocaleString("id-ID")}</p>
            <p className="text-xs mt-2 opacity-80">seluruh PML</p>
          </div>
        </section>}

        <nav className="bg-white rounded-xl shadow-sm p-1.5 mb-5 flex gap-1 overflow-x-auto" aria-label="Pilihan tabel">
          {TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === tab.id ? "bg-orange-500 text-white shadow" : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"}`}>
            {tab.label}</button>)}
        </nav>

        {loading && <div className="bg-white rounded-xl shadow p-10 text-center text-slate-500">Memuat tiga tabel dari spreadsheet...</div>}
        {error && !loading && <div className="bg-white rounded-xl shadow p-10 text-center text-red-600">Gagal memuat data: {error}</div>}

        {!loading && !error && <>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div><h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <p className="text-sm text-slate-500">{datasets[activeTab].length.toLocaleString("id-ID")} baris data</p></div>
            <div className="w-full lg:w-auto flex flex-wrap items-center justify-end gap-2">
              <div className="w-full sm:w-80 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-slate-400">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={activeTab === "sls" ? "Cari kode SLS, PPL, atau PML..." : activeTab === "kecamatan" ? "Cari kecamatan..." : "Cari petugas atau kecamatan..."}
                  className="bg-transparent outline-none text-sm w-full" />
              </div>
              {activeTab === "petugas" && <>
                <select value={jabatanFilter} onChange={(e) => setJabatanFilter(e.target.value)}
                  className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-orange-400">
                  <option value="all">Semua Jabatan</option>
                  {filterOptions.jabatan.map((jabatan) => <option key={jabatan} value={jabatan}>{jabatan}</option>)}
                </select>
                <select value={kecamatanFilter} onChange={(e) => setKecamatanFilter(e.target.value)}
                  className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-orange-400">
                  <option value="all">Semua Kecamatan</option>
                  {filterOptions.kecamatan.map((kecamatan) => <option key={kecamatan} value={kecamatan}>{kecamatan}</option>)}
                </select>
              </>}
            </div>
          </div>

          {activeTab === "petugas" && <section className="mb-4 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm" aria-labelledby="top-ppl-title">
            <button type="button" onClick={() => setShowTopPpl((visible) => !visible)} aria-expanded={showTopPpl} aria-controls="top-ppl-table"
              className="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-left text-white transition hover:from-orange-600 hover:to-amber-500">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-base">★</span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-orange-100">Pencapaian Terbaik</span>
                  <span id="top-ppl-title" className="block truncate text-sm font-bold">Top 5 PPL dengan Persentase Tertinggi</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                {showTopPpl ? "Tutup" : "Lihat peringkat"}
                <span className={`text-base transition-transform ${showTopPpl ? "rotate-180" : ""}`}>⌄</span>
              </span>
            </button>
            {showTopPpl && <div id="top-ppl-table" className="overflow-x-auto bg-gradient-to-br from-orange-50 via-white to-amber-50">
              <table className="min-w-full text-sm">
                <thead className="border-b border-orange-200 bg-orange-100/70">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-orange-800">Peringkat</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-orange-800">Nama Petugas</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-orange-800">Kecamatan</th>
                  </tr>
                </thead>
                <tbody>
                  {topPplRows.map((row, index) => <tr key={`top-${row.nama}-${index}`} className="border-b border-orange-100 last:border-0 hover:bg-orange-100/60">
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-white shadow-sm ${index === 0 ? "bg-amber-500 ring-4 ring-amber-200" : index === 1 ? "bg-slate-500" : index === 2 ? "bg-orange-700" : "bg-orange-400"}`}>{index + 1}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{row.kecamatan}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
          </section>}

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-orange-600 bg-gradient-to-r from-orange-600 to-amber-500"><tr>
                  {columns.map(([key, label, type]) => <th key={key} onClick={() => handleSort(key)}
                    className={`min-w-[90px] max-w-[155px] px-3 py-3 text-xs font-bold uppercase leading-tight tracking-wide cursor-pointer select-none whitespace-normal transition-colors hover:bg-white/15 ${type ? "text-right" : "text-left"} ${sort.key === key ? "bg-amber-200 text-orange-900" : "text-white"}`}>
                    <span className={`flex items-center gap-1.5 ${type ? "justify-end" : "justify-start"}`}>
                      <span>{splitHeaderLabel(label).map((line, index) => <span key={`${key}-${index}`} className="block whitespace-nowrap">{line}</span>)}</span>
                      {sort.key === key && <span className="shrink-0">{sort.desc ? "▼" : "▲"}</span>}
                    </span>
                  </th>)}
                </tr></thead>
                <tbody>
                  {visibleRows.length === 0 && <tr><td colSpan={columns.length} className="text-center text-slate-400 py-10">Data tidak ditemukan.</td></tr>}
                  {visibleRows.map((row, index) => <tr key={`${row.nama || row.regionCode || row.kecamatan}-${index}`}
                    className={`border-b last:border-b-0 border-slate-100 transition ${row.jabatan?.toUpperCase() === "PML" ? "bg-blue-50 font-semibold text-blue-950 shadow-[inset_4px_0_0_#3b82f6] hover:bg-blue-100" : row.kecamatan === "TOTAL" ? "bg-slate-50 font-semibold hover:bg-slate-100" : "hover:bg-orange-50"}`}>
                    {columns.map(([key, , type]) => <td key={key} className={`px-3 py-2.5 whitespace-nowrap ${type ? "text-right" : "text-left"}`}>
                      {activeTab === "kecamatan" && key === "kecamatan" && topKecamatanRanks.has(row.kecamatan) ? <span className="flex items-center gap-2"><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-white shadow-sm ${topKecamatanRanks.get(row.kecamatan) === 1 ? "bg-amber-500 ring-4 ring-amber-200" : topKecamatanRanks.get(row.kecamatan) === 2 ? "bg-slate-500" : topKecamatanRanks.get(row.kecamatan) === 3 ? "bg-orange-700" : "bg-orange-400"}`}>{topKecamatanRanks.get(row.kecamatan)}</span><span>{row[key]}</span></span>
                        : activeTab === "petugas" && key === "jabatan" && row.jabatan.toUpperCase() === "PML" ? <span className="font-bold text-blue-700">PML</span>
                        : type === "percent" ? <span className={`text-xs font-bold px-2 py-1 rounded-lg ${progressClass(row[key])}`}>{row[key].toFixed(2)}%</span>
                        : type === "number" ? row[key].toLocaleString("id-ID") : row[key]}
                    </td>)}
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-right">Menampilkan {visibleRows.length.toLocaleString("id-ID")} dari {datasets[activeTab].length.toLocaleString("id-ID")} baris</p>
        </>}
      </main>
    </div>
  );
}

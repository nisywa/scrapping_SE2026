import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

const SHEET_ID = "1i6UaJXO1t90CXE6tLObwXzEAOv3jinJU5Pt2dP-BD4M";
const SHEET_NAME = "data_sls";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const KECAMATAN_MAP = {
  "010": "Suppa",
  "020": "Mattiro Sompe",
  "021": "Lanrisang",
  "030": "Mattiro Bulu",
  "040": "Watang Sawitto",
  "041": "Paleteang",
  "042": "Tiroang",
  "050": "Patampanua",
  "060": "Cempa",
  "070": "Duampanua",
  "071": "Batulappa",
  "080": "Lembang",
};

function normalizeKey(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
  }

  const keys = Object.keys(row);

  for (const c of candidates) {
    const target = c.replace(/[\s_]/g, "").toLowerCase();
    const found = keys.find(
      (k) => k.replace(/[\s_]/g, "").toLowerCase() === target
    );
    if (found) return row[found];
  }

  return undefined;
}

function toNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  const n = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())} ${date.toLocaleString("id-ID", {
    month: "long",
  })} ${date.getFullYear()} Pukul ${pad(date.getHours())}.${pad(
    date.getMinutes()
  )} WIB`;
}

export default function App() {
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedKec, setSelectedKec] = useState(null);
  const [petugasFilter, setPetugasFilter] = useState("all");
  const [petugasSearch, setPetugasSearch] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error("Gagal mengambil data spreadsheet");

        const text = await res.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });

        if (!active) return;

        setRawRows(parsed.data || []);
        setUpdatedAt(new Date());
      } catch (e) {
        if (active) setError(e.message || "Terjadi kesalahan");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const { kecamatanList, summary } = useMemo(() => {
    if (!rawRows.length) return { kecamatanList: [], summary: null };

    const kecMap = new Map();

    for (const row of rawRows) {
      const nama = normalizeKey(row, "usename", "username", "Nama")?.trim();
      if (!nama) continue;

      const kodeKecRaw = normalizeKey(row, "Kode_Kecamatan", "kode_kecamatan");
      const kodeKec = String(kodeKecRaw ?? "").trim().padStart(3, "0");

      const progress = toNumber(normalizeKey(row, "Progress"));
      const totalRegion = toNumber(normalizeKey(row, "totalRegion"));
      const open = toNumber(normalizeKey(row, "OPEN"));

      const submittedDraft = toNumber(
        normalizeKey(row, "SUBMITTED BY Pencacah", "SUBMITTED_BY_Pencacah")
      );

      const draft = toNumber(normalizeKey(row, "DRAFT"));

      const approvedPengawas = toNumber(
        normalizeKey(row, "APPROVED BY Pengawas", "APPROVED_BY_Pengawas")
      );

      const rejectedPengawas = toNumber(
        normalizeKey(row, "REJECTED BY Pengawas", "REJECTED_BY_Pengawas")
      );

      const revoked = toNumber(
        normalizeKey(row, "REVOKED BY", "REVOKED_BY")
      );

      const submittedResponden = toNumber(
        normalizeKey(row, "SUBMITTED RESPONDENT", "SUBMITTED_RESPONDENT")
      );

      if (!kecMap.has(kodeKec)) {
        kecMap.set(kodeKec, {
          kode: kodeKec,
          nama: KECAMATAN_MAP[kodeKec] || `Kecamatan ${kodeKec}`,
          petugasMap: new Map(),
        });
      }

      const kec = kecMap.get(kodeKec);

      if (!kec.petugasMap.has(nama)) {
        kec.petugasMap.set(nama, {
          nama,
          totalRegion: 0,
          weightedSum: 0,
          open: 0,
          submittedDraft: 0,
          draft: 0,
          approvedPengawas: 0,
          rejectedPengawas: 0,
          revoked: 0,
          submittedResponden: 0,
        });
      }

      const p = kec.petugasMap.get(nama);

      p.totalRegion += totalRegion;
      p.weightedSum += progress * totalRegion;
      p.open += open;
      p.submittedDraft += submittedDraft;
      p.draft += draft;
      p.approvedPengawas += approvedPengawas;
      p.rejectedPengawas += rejectedPengawas;
      p.revoked += revoked;
      p.submittedResponden += submittedResponden;
    }

    const kecArr = Array.from(kecMap.values()).map((kec) => {
      const petugasArr = Array.from(kec.petugasMap.values()).map((p) => ({
        ...p,
        progress: p.totalRegion > 0 ? p.weightedSum / p.totalRegion : 0,
      }));

      petugasArr.sort((a, b) => b.progress - a.progress);

      const totalRegionKec = petugasArr.reduce((s, p) => s + p.totalRegion, 0);
      const weightedSumKec = petugasArr.reduce((s, p) => s + p.weightedSum, 0);

      const avgProgress =
        totalRegionKec > 0 ? weightedSumKec / totalRegionKec : 0;

      return {
        kode: kec.kode,
        nama: kec.nama,
        avgProgress,
        jumlahPetugas: petugasArr.length,
        petugasArr,
      };
    });

    kecArr.sort((a, b) => a.nama.localeCompare(b.nama));

    const allPetugasMap = new Map();

    for (const kec of kecArr) {
      for (const p of kec.petugasArr) {
        if (!allPetugasMap.has(p.nama)) {
          allPetugasMap.set(p.nama, {
            totalRegion: 0,
            weightedSum: 0,
          });
        }

        const acc = allPetugasMap.get(p.nama);
        acc.totalRegion += p.totalRegion;
        acc.weightedSum += p.weightedSum;
      }
    }

    const allPetugas = Array.from(allPetugasMap.entries()).map(
      ([nama, acc]) => ({
        nama,
        progress: acc.totalRegion > 0 ? acc.weightedSum / acc.totalRegion : 0,
      })
    );

    const totalPetugas = allPetugas.length;

    const rataRataProgress =
      totalPetugas > 0
        ? allPetugas.reduce((s, p) => s + p.progress, 0) / totalPetugas
        : 0;

    const progressKurang10 = allPetugas.filter((p) => p.progress < 10).length;
    const belumMulai = allPetugas.filter((p) => p.progress === 0).length;
    const progress100 = allPetugas.filter((p) => p.progress >= 100).length;

    const totalDraft = rawRows.reduce(
      (s, row) => s + toNumber(normalizeKey(row, "DRAFT")),
      0
    );

    const totalApprovedPengawas = rawRows.reduce(
      (s, row) =>
        s + toNumber(normalizeKey(row, "APPROVED BY Pengawas")),
      0
    );

    const totalRejectedPengawas = rawRows.reduce(
      (s, row) =>
        s + toNumber(normalizeKey(row, "REJECTED BY Pengawas")),
      0
    );

    return {
      kecamatanList: kecArr,
      summary: {
        totalPetugas,
        rataRataProgress,
        progressKurang10,
        belumMulai,
        progress100,
        totalDraft,
        totalApprovedPengawas,
        totalRejectedPengawas,
      },
    };
  }, [rawRows]);

  const filteredKecamatan = useMemo(() => {
    let arr = kecamatanList;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((k) => k.nama.toLowerCase().includes(q));
    }

    arr = [...arr].sort((a, b) =>
      sortDesc ? b.avgProgress - a.avgProgress : a.avgProgress - b.avgProgress
    );

    return arr;
  }, [kecamatanList, search, sortDesc]);

  const activeKec =
    kecamatanList.find((k) => k.kode === selectedKec) || filteredKecamatan[0];

  const petugasNames = useMemo(() => {
    if (!activeKec) return [];
    return activeKec.petugasArr.map((p) => p.nama);
  }, [activeKec]);

  const detailPetugas = useMemo(() => {
    if (!activeKec) return [];

    let arr = activeKec.petugasArr;

    if (petugasFilter !== "all") {
      arr = arr.filter((p) => p.nama === petugasFilter);
    }

    if (petugasSearch.trim()) {
      const q = petugasSearch.trim().toLowerCase();
      arr = arr.filter((p) => p.nama.toLowerCase().includes(q));
    }

    return arr;
  }, [activeKec, petugasFilter, petugasSearch]);

  function progressBadgeColor(progress) {
    if (progress >= 100) return "bg-emerald-100 text-emerald-700";
    if (progress >= 50) return "bg-amber-100 text-amber-700";
    return "bg-pink-100 text-pink-600";
  }

  function progressLabel(progress) {
    if (progress >= 100) return "Selesai";
    if (progress > 0) return "Perlu Perhatian";
    return "Belum Mulai";
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-orange-500 to-orange-400 text-white px-6 py-5 shadow flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-90">
            Badan Pusat Statistik
          </div>
          <h1 className="text-2xl font-bold mt-1">
            Monitoring Petugas Pencacahan
          </h1>
          <p className="text-sm opacity-90">BPS Kabupaten Pinrang</p>
        </div>

        <div className="text-right text-sm opacity-90">
          <p>Data diperbarui pada</p>
          <p className="font-semibold">
            {updatedAt ? formatDateTime(updatedAt) : "-"}
          </p>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {loading && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
            Memuat data dari spreadsheet...
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-red-600">
            Gagal memuat data: {error}
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              <div className="bg-slate-700 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Total Petugas</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.totalPetugas}
                </p>
                <p className="text-xs opacity-70 mt-1">pencacah lapangan</p>
              </div>

              <div className="bg-orange-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Total Kecamatan</p>
                <p className="text-2xl font-bold mt-1">
                  {kecamatanList.length}
                </p>
                <p className="text-xs opacity-70 mt-1">wilayah kerja</p>
              </div>

              <div className="bg-blue-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Rata-rata Progress</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.rataRataProgress.toFixed(1)}%
                </p>
                <p className="text-xs opacity-70 mt-1">seluruh petugas</p>
              </div>

              <div className="bg-rose-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Progress &lt; 10%</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.progressKurang10}
                </p>
                <p className="text-xs opacity-70 mt-1">perlu dikejar</p>
              </div>

              <div className="bg-emerald-50 text-emerald-600 rounded-xl p-4 shadow border border-emerald-100">
                <p className="text-xs opacity-80">Progress ≥ 100%</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.progress100}
                </p>
                <p className="text-xs opacity-70 mt-1">sudah selesai</p>
              </div>

              <div className="bg-yellow-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Total Draft</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.totalDraft}
                </p>
                <p className="text-xs opacity-70 mt-1">seluruh SLS</p>
              </div>

              <div className="bg-green-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Approved Pengawas</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.totalApprovedPengawas}
                </p>
                <p className="text-xs opacity-70 mt-1">disetujui</p>
              </div>

              <div className="bg-red-500 text-white rounded-xl p-4 shadow">
                <p className="text-xs opacity-80">Rejected Pengawas</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.totalRejectedPengawas}
                </p>
                <p className="text-xs opacity-70 mt-1">ditolak</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-3 mb-6">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-400">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama kecamatan..."
                  className="bg-transparent outline-none text-sm w-full"
                />
              </div>

              <button
                onClick={() => setSortDesc((s) => !s)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Urutkan {sortDesc ? "▼" : "▲"}
              </button>

              <span className="text-xs text-slate-500 px-2">
                Progress{" "}
                {sortDesc ? "tertinggi → terendah" : "terendah → tertinggi"}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                {filteredKecamatan.length === 0 && (
                  <div className="col-span-2 bg-white rounded-xl shadow p-6 text-center text-slate-400">
                    Kecamatan tidak ditemukan.
                  </div>
                )}

                {filteredKecamatan.map((kec) => {
                  const isActive = activeKec && activeKec.kode === kec.kode;

                  return (
                    <button
                      key={kec.kode}
                      onClick={() => {
                        setSelectedKec(kec.kode);
                        setPetugasFilter("all");
                        setPetugasSearch("");
                      }}
                      className={`text-left bg-white rounded-xl shadow p-4 border-2 transition hover:shadow-md ${
                        isActive
                          ? "border-orange-400 bg-orange-50"
                          : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          Kecamatan
                        </p>

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${progressBadgeColor(
                            kec.avgProgress
                          )}`}
                        >
                          {kec.avgProgress.toFixed(1)}%
                        </span>
                      </div>

                      <p className="font-bold text-slate-800 mt-1">
                        {kec.nama}
                      </p>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                        <div
                          className="h-full bg-pink-500 rounded-full"
                          style={{
                            width: `${Math.min(kec.avgProgress, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-slate-500">
                          {kec.jumlahPetugas} petugas
                        </p>

                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${progressBadgeColor(
                            kec.avgProgress
                          )}`}
                        >
                          {progressLabel(kec.avgProgress)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-orange-500 text-white rounded-xl shadow p-4 h-fit lg:sticky lg:top-4">
                {activeKec ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide opacity-80">
                          Kecamatan
                        </p>
                        <h3 className="text-xl font-bold">{activeKec.nama}</h3>
                      </div>

                      <button
                        onClick={() => setSelectedKec(null)}
                        className="text-white/80 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-xs mt-4 opacity-90">
                      Rata-rata progress petugas
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full"
                          style={{
                            width: `${Math.min(activeKec.avgProgress, 100)}%`,
                          }}
                        />
                      </div>

                      <span className="text-sm font-bold">
                        {activeKec.avgProgress.toFixed(2)}%
                      </span>
                    </div>

                    <p className="text-xs mt-5 opacity-90 font-semibold uppercase tracking-wide">
                      Petugas Pencacah
                    </p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => setPetugasFilter("all")}
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          petugasFilter === "all"
                            ? "bg-white text-orange-600"
                            : "bg-white/20 text-white"
                        }`}
                      >
                        Semua ({petugasNames.length})
                      </button>

                      {petugasNames.slice(0, 6).map((nama) => (
                        <button
                          key={nama}
                          onClick={() => setPetugasFilter(nama)}
                          className={`text-xs px-3 py-1 rounded-full font-medium truncate max-w-[120px] ${
                            petugasFilter === nama
                              ? "bg-white text-orange-600"
                              : "bg-white/20 text-white"
                          }`}
                          title={nama}
                        >
                          {nama}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 bg-white rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="text-slate-400 text-sm">🔍</span>
                      <input
                        value={petugasSearch}
                        onChange={(e) => setPetugasSearch(e.target.value)}
                        placeholder="Cari nama petugas..."
                        className="outline-none text-sm text-slate-700 w-full"
                      />
                    </div>

                    <div className="mt-3 bg-white rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                      {detailPetugas.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-6">
                          Petugas tidak ditemukan.
                        </p>
                      )}

                      {detailPetugas.map((p, idx) => (
                        <div
                          key={p.nama}
                          className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0 border-slate-100"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400">{idx + 1}</p>

                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {p.nama}
                            </p>

                            <p className="text-[11px] text-slate-400">
                              {p.totalRegion} SLS &bull; disetujui{" "}
                              {p.approvedPengawas}
                            </p>

                            <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full"
                                style={{
                                  width: `${Math.min(p.progress, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${progressBadgeColor(
                              p.progress
                            )}`}
                          >
                            {p.progress.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm opacity-80">
                    Pilih kecamatan untuk melihat detail petugas.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
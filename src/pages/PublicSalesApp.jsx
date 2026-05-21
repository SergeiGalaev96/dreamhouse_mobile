import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Grid3X3,
  Home,
  Mail,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getPublicSalesToken,
  publicSalesFileUrl,
  publicSalesGet,
  publicSalesGetText,
  publicSalesPost,
  setPublicSalesToken
} from "../api/publicSalesApi";

const statusClasses = {
  free: "border-emerald-400 bg-white text-slate-950",
  reserved: "border-yellow-400 bg-yellow-300 text-slate-950",
  sold: "border-slate-400 bg-slate-400 text-white",
  offmarket: "border-slate-600 bg-slate-700 text-slate-200"
};

const statusSvgMeta = {
  free: { fill: "rgba(255,255,255,0.96)", stroke: "#2563eb" },
  reserved: { fill: "rgba(250,204,21,0.76)", stroke: "#ca8a04" },
  sold: { fill: "rgba(148,163,184,0.82)", stroke: "#475569" },
  offmarket: { fill: "rgba(51,65,85,0.74)", stroke: "#334155" }
};

const formatNumber = (value, digits = 0) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("ru-RU", { maximumFractionDigits: digits });
};

const formatMoney = (value, currencyInfo) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "Цена по запросу";
  return `${formatNumber(number)} ${currencyInfo?.code || "KGS"}`;
};

const formatArea = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "-";
  return `${formatNumber(number, 1)} м²`;
};

const getCreatedTime = (item) => {
  const time = new Date(item?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getStatus = (unit, statuses) =>
  unit?.status || statuses.find((item) => Number(item.id) === Number(unit?.status_id)) || null;

const getUnitTitle = (unit) => {
  const type = {
    apartment: "Квартира",
    commercial: "Помещение",
    parking: "Паркинг",
    storage: "Кладовая"
  }[unit?.lot_type] || "Лот";

  return `${type} №${unit?.unit_number || unit?.id}`;
};

function TokenGate({ tokenInput, setTokenInput, onSave }) {
  return (
    <div className="min-h-screen bg-[#f5f1e8] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-2xl font-bold">Sales Board DreamHouse</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Публичная шахматка для просмотра лотов и отправки заявки.
          Для доступа нужна специальная ссылка или токен.
        </p>
        <input
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500"
          placeholder="Введите публичный токен"
        />
        <button
          onClick={onSave}
          className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Открыть Sales Board
        </button>
      </div>
    </div>
  );
}

function RenderShowcase({ files, projectName, blockName }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = useMemo(
    () => (files || []).map((file) => ({ ...file, src: publicSalesFileUrl(file.url) })).filter((file) => file.src),
    [files]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [images.length]);

  if (!images.length) return null;

  const active = images[activeIndex] || images[0];
  const goTo = (direction) => {
    setActiveIndex((prev) => (prev + direction + images.length) % images.length);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
      <div className="relative min-h-[260px] sm:min-h-[360px] lg:min-h-[430px]">
        {images.map((image, index) => (
          <img
            key={image.id}
            src={image.src}
            alt={image.name || `${projectName} ${blockName}`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles size={14} />
            Витрина объекта
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">{projectName || "Объект"}</h2>
          <div className="mt-1 text-sm text-white/75">{blockName || "Блок"} · {active.name}</div>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(-1)}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg hover:bg-white sm:flex"
              aria-label="Предыдущий рендер"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg hover:bg-white sm:flex"
              aria-label="Следующий рендер"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-4 right-4 flex gap-1.5 rounded-full bg-black/35 p-2 backdrop-blur">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/45"}`}
                  aria-label={`Открыть рендер ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function LeadModal({ unit, sourceId, onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "+996 ",
    email: "",
    comment: ""
  });
  const [saving, setSaving] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim() && !form.phone.trim() && !form.email.trim()) {
      toast.error("Укажите имя, телефон или email");
      return;
    }

    try {
      setSaving(true);
      const res = await publicSalesPost("/public-sales/leads/create", {
        project_id: unit.project_id,
        block_id: unit.block_id,
        unit_id: unit.id,
        unit_number: unit.unit_number,
        source_id: sourceId || null,
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        comment: form.comment.trim() || null,
        interest_lot_type: unit.lot_type,
        interest_rooms: unit.rooms,
        interest_budget_from: unit.price_total,
        interest_budget_to: unit.price_total,
        interest_area_from: unit.area_total,
        interest_area_to: unit.area_total
      });

      if (!res?.success) {
        throw new Error(res?.message || "Не удалось отправить заявку");
      }

      toast.success("Заявка отправлена");
      onCreated?.();
    } catch (error) {
      console.error("Public lead create error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка отправки заявки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-lg rounded-[1.75rem] bg-white p-5 text-slate-950 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold">Оставить заявку</div>
            <div className="mt-1 text-sm text-slate-500">{getUnitTitle(unit)}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">
            Закрыть
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Имя</span>
            <input value={form.full_name} onChange={(e) => update({ full_name: e.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Телефон</span>
            <input value={form.phone} onChange={(e) => update({ phone: e.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input value={form.email} onChange={(e) => update({ email: e.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комментарий</span>
            <textarea value={form.comment} onChange={(e) => update({ comment: e.target.value })} rows={3} className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500" />
          </label>
        </div>

        <button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
          <Send size={18} />
          {saving ? "Отправляем..." : "Отправить заявку"}
        </button>
      </form>
    </div>
  );
}

function ContactModal({ project, blockId, sourceId, onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "+996 "
  });
  const [saving, setSaving] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    const fullName = form.full_name.trim();
    const phone = form.phone.trim();

    if (!fullName) {
      toast.error("Укажите имя");
      return;
    }

    if (!phone || phone === "+996") {
      toast.error("Укажите телефон");
      return;
    }

    try {
      setSaving(true);
      const res = await publicSalesPost("/public-sales/leads/create", {
        project_id: project?.id ? Number(project.id) : null,
        block_id: blockId ? Number(blockId) : null,
        source_id: sourceId || null,
        full_name: fullName,
        phone
      });

      if (!res?.success) {
        throw new Error(res?.message || "Не удалось отправить заявку");
      }

      toast.success("Заявка отправлена");
      onCreated?.();
    } catch (error) {
      console.error("Public contact lead create error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка отправки заявки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-md rounded-[1.75rem] bg-white p-5 text-slate-950 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold">Связаться</div>
            <div className="mt-1 text-sm text-slate-500">{project?.name || "DreamHouse"}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">
            Закрыть
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Имя</span>
            <input
              value={form.full_name}
              onChange={(e) => update({ full_name: e.target.value })}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Как к вам обращаться"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Телефон</span>
            <input
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="+996..."
            />
          </label>
        </div>

        <button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
          <Send size={18} />
          {saving ? "Отправляем..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}

export default function PublicSalesApp() {
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(Boolean(getPublicSalesToken()));
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [planSvgRaw, setPlanSvgRaw] = useState("");
  const [search, setSearch] = useState("");
  const [leadUnit, setLeadUnit] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  const selectedProject = projects.find((item) => Number(item.id) === Number(selectedProjectId)) || null;
  const projectBlocks = blocks
    .filter((item) => Number(item.project_id) === Number(selectedProjectId))
    .sort((a, b) => getCreatedTime(a) - getCreatedTime(b) || Number(a.id || 0) - Number(b.id || 0));
  const floors = overview?.floors || [];
  const selectedFloor = floors.find((item) => Number(item.id) === Number(selectedFloorId)) || floors[0] || null;
  const units = (selectedFloor?.units || []).filter((unit) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [unit.unit_number, unit.plan_code, unit.external_code].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const selectedUnit = units.find((item) => Number(item.id) === Number(selectedUnitId)) || units[0] || null;
  const sourceId = sources[0]?.id || null;
  const showcaseFiles = overview?.assets?.facadeRenders || [];

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => getCreatedTime(b) - getCreatedTime(a) || Number(b.id || 0) - Number(a.id || 0));
  }, [projects]);

  const renderedSvg = useMemo(() => {
    if (!planSvgRaw || typeof DOMParser === "undefined") return "";

    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(planSvgRaw, "image/svg+xml");
      const svg = xml.querySelector("svg");
      if (!svg) return "";

      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", svg.getAttribute("preserveAspectRatio") || "xMidYMid meet");

      const style = xml.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `
        [data-public-sales-unit="true"] { cursor: pointer; transition: opacity .15s ease; }
        [data-public-sales-unit="true"]:hover { opacity: .88; }
      `;
      svg.insertBefore(style, svg.firstChild);

      (selectedFloor?.units || []).forEach((unit) => {
        const keys = [unit.plan_code, unit.external_code, unit.unit_number]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        let node = null;
        for (const key of keys) {
          node = xml.getElementById(key);
          if (node) break;
        }
        if (!node) return;

        const status = getStatus(unit, statuses);
        const meta = statusSvgMeta[status?.code] || statusSvgMeta.free;
        const active = Number(unit.id) === Number(selectedUnit?.id);

        node.setAttribute("data-public-sales-unit", "true");
        node.setAttribute("data-unit-id", String(unit.id));

        const shapeSelector = "path, polygon, rect, polyline, ellipse, circle";
        const shapes = node.matches?.(shapeSelector) ? [node] : Array.from(node.querySelectorAll(shapeSelector));
        const targets = shapes.length ? shapes : [node];
        targets.forEach((shape) => {
          shape.setAttribute("fill", meta.fill);
          shape.setAttribute("stroke", active ? "#2563eb" : meta.stroke);
          shape.setAttribute("stroke-width", active ? "4" : (shape.getAttribute("stroke-width") || "2"));
          shape.setAttribute("vector-effect", "non-scaling-stroke");
        });
      });

      return new XMLSerializer().serializeToString(svg);
    } catch (error) {
      console.error("Public SVG render error", error);
      return "";
    }
  }, [planSvgRaw, selectedFloor, selectedUnit, statuses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setPublicSalesToken(token);
      setHasToken(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (hasToken) loadInitial();
  }, [hasToken]);

  useEffect(() => {
    if (!selectedBlockId) return;
    loadBlock(selectedBlockId);
  }, [selectedBlockId]);

  useEffect(() => {
    if (!selectedFloor?.id) {
      setPlanSvgRaw("");
      return;
    }
    loadFloorPlan(selectedFloor.id);
  }, [selectedFloor?.id]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [overviewRes, statusesRes, sourcesRes] = await Promise.all([
        publicSalesGet("/public-sales/objects/overview"),
        publicSalesGet("/public-sales/unit-statuses"),
        publicSalesGet("/public-sales/lead-sources")
      ]);

      if (!overviewRes?.success) {
        throw new Error(overviewRes?.message || "Не удалось загрузить объекты");
      }

      const nextProjects = overviewRes.data?.projects || [];
      const nextBlocks = overviewRes.data?.blocks || [];
      setProjects(nextProjects);
      setBlocks(nextBlocks);
      setStatuses(statusesRes?.success ? statusesRes.data || [] : []);
      setSources(sourcesRes?.success ? sourcesRes.data || [] : []);

      const firstProject = [...nextProjects].sort((a, b) => getCreatedTime(b) - getCreatedTime(a) || Number(b.id || 0) - Number(a.id || 0))[0];
      const firstBlock = firstProject
        ? nextBlocks
          .filter((block) => Number(block.project_id) === Number(firstProject.id))
          .sort((a, b) => getCreatedTime(a) - getCreatedTime(b) || Number(a.id || 0) - Number(b.id || 0))[0]
        : null;

      setSelectedProjectId((prev) => prev || firstProject?.id || null);
      setSelectedBlockId((prev) => prev || firstBlock?.id || null);
    } catch (error) {
      console.error("Public sales init error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки Sales Board");
      if (error?.response?.status === 403) {
        setHasToken(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBlock = async (blockId) => {
    try {
      setLoading(true);
      const res = await publicSalesGet(`/public-sales/blocks/${blockId}/overview`);
      if (!res?.success) throw new Error(res?.message || "Не удалось загрузить блок");
      setOverview(res.data || null);
      const firstFloor = res.data?.floors?.[0] || null;
      setSelectedFloorId(firstFloor?.id || null);
      setSelectedUnitId(firstFloor?.units?.[0]?.id || null);
    } catch (error) {
      console.error("Public block load error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки блока");
    } finally {
      setLoading(false);
    }
  };

  const loadFloorPlan = async (floorId) => {
    try {
      const svg = await publicSalesGetText(`/public-sales/floors/${floorId}/plan-svg`);
      setPlanSvgRaw(typeof svg === "string" && svg.includes("<svg") ? svg : "");
    } catch {
      setPlanSvgRaw("");
    }
  };

  const saveToken = () => {
    if (!tokenInput.trim()) {
      toast.error("Введите токен");
      return;
    }
    setPublicSalesToken(tokenInput);
    setHasToken(true);
  };

  const selectProject = (projectId) => {
    const nextBlock = blocks
      .filter((block) => Number(block.project_id) === Number(projectId))
      .sort((a, b) => getCreatedTime(a) - getCreatedTime(b) || Number(a.id || 0) - Number(b.id || 0))[0];
    setSelectedProjectId(projectId);
    setSelectedBlockId(nextBlock?.id || null);
  };

  const handleSvgClick = (event) => {
    const node = event.target?.closest?.("[data-unit-id]");
    if (!node) return;
    setSelectedUnitId(Number(node.getAttribute("data-unit-id")));
  };

  if (!hasToken) {
    return <TokenGate tokenInput={tokenInput} setTokenInput={setTokenInput} onSave={saveToken} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f5f1e8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
              <Building2 size={17} />
              DreamHouse
            </div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">Sales Board</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="space-y-4 lg:order-2">
          <section className="rounded-[1.75rem] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-bold">
              <Home size={18} />
              Объекты
            </div>
            <div className="space-y-2">
              {sortedProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    Number(project.id) === Number(selectedProjectId)
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-slate-50 hover:border-blue-300"
                  }`}
                >
                  <div className="font-bold">{project.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{project.free_units || 0} свободно из {project.total_units || 0}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-4 shadow-sm">
            <div className="mb-3 font-bold">Блок</div>
            <select
              value={selectedBlockId || ""}
              onChange={(event) => setSelectedBlockId(event.target.value ? Number(event.target.value) : null)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              {projectBlocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
            </select>
          </section>

          {selectedUnit && (
            <section className="rounded-[1.75rem] bg-slate-950 p-4 text-white shadow-xl">
              <div className="text-sm text-slate-400">Выбранный лот</div>
              <div className="mt-1 text-xl font-black">{getUnitTitle(selectedUnit)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-slate-400">Площадь</div>
                  <div className="font-bold">{formatArea(selectedUnit.area_total)}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-slate-400">Комнат</div>
                  <div className="font-bold">{selectedUnit.rooms ?? "-"}</div>
                </div>
                <div className="col-span-2 rounded-2xl bg-white/10 p-3">
                  <div className="text-slate-400">Стоимость</div>
                  <div className="font-bold">{formatMoney(selectedUnit.price_total, selectedUnit.currency_info)}</div>
                </div>
              </div>
              <button onClick={() => setLeadUnit(selectedUnit)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500">
                <Phone size={18} />
                Оставить заявку
              </button>
            </section>
          )}
        </aside>

        <section className="space-y-4 lg:order-1">
          <div className="rounded-[2rem] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm text-slate-500">{selectedProject?.address || "Адрес уточняется"}</div>
                <h2 className="text-2xl font-black">{selectedProject?.name || "Объект"}</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-blue-500 lg:w-72"
                    placeholder="Поиск квартиры..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  <Phone size={18} />
                  Связаться
                </button>
              </div>
            </div>
          </div>

          <RenderShowcase files={showcaseFiles} projectName={selectedProject?.name} blockName={overview?.block?.name} />

          <div className="rounded-[2rem] bg-slate-950 p-4 text-white shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-blue-300">
                  <Grid3X3 size={16} />
                  Выберите этаж
                </div>
                <div className="mt-1 text-xl font-black">{overview?.block?.name || "Блок"}</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => {
                      setSelectedFloorId(floor.id);
                      setSelectedUnitId(floor.units?.[0]?.id || null);
                    }}
                    className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${
                      Number(floor.id) === Number(selectedFloorId)
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-slate-200"
                    }`}
                  >
                    {floor.floor_number} этаж
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-[#f8f5ee] p-3 text-slate-950">
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {statuses.map((status) => (
                  <span key={status.id} className={`rounded-full border px-3 py-1 font-semibold ${statusClasses[status.code] || "border-slate-300 bg-white"}`}>
                    {status.name}
                  </span>
                ))}
              </div>

              {renderedSvg ? (
                <div className="h-[62vh] min-h-[460px] overflow-auto rounded-2xl border border-slate-200 bg-white p-2" onClick={handleSvgClick}>
                  <div className="min-h-full min-w-[900px]" dangerouslySetInnerHTML={{ __html: renderedSvg }} />
                </div>
              ) : (
                <div className="grid min-h-[420px] gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {units.map((unit) => {
                    const status = getStatus(unit, statuses);
                    return (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedUnitId(unit.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          Number(unit.id) === Number(selectedUnitId)
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 bg-slate-50 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{getUnitTitle(unit)}</div>
                            <div className="mt-1 text-sm text-slate-500">{formatArea(unit.area_total)} · {unit.rooms ?? "-"} ком</div>
                          </div>
                          <DoorOpen size={18} className="text-blue-600" />
                        </div>
                        <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[status?.code] || "border-slate-300 bg-white"}`}>
                          {status?.name || "Без статуса"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedUnit && (
            <div className="rounded-[2rem] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <button onClick={() => setSelectedUnitId(null)} className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-500">
                    <ArrowLeft size={16} />
                    Снять выбор
                  </button>
                  <h3 className="text-2xl font-black">{getUnitTitle(selectedUnit)}</h3>
                  <div className="mt-1 text-sm text-slate-500">{selectedFloor?.floor_number} этаж · {overview?.block?.name}</div>
                </div>
                <button onClick={() => setLeadUnit(selectedUnit)} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500">
                  <Mail size={18} />
                  Оставить заявку
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Площадь</div>
                  <div className="mt-1 font-black">{formatArea(selectedUnit.area_total)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Комнат</div>
                  <div className="mt-1 font-black">{selectedUnit.rooms ?? "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Статус</div>
                  <div className="mt-1 font-black">{getStatus(selectedUnit, statuses)?.name || "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Цена</div>
                  <div className="mt-1 font-black">{formatMoney(selectedUnit.price_total, selectedUnit.currency_info)}</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {loading && (
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={16} />
          Загружаем...
        </div>
      )}

      {leadUnit && <LeadModal unit={leadUnit} sourceId={sourceId} onClose={() => setLeadUnit(null)} onCreated={() => setLeadUnit(null)} />}
      {contactOpen && (
        <ContactModal
          project={selectedProject}
          blockId={selectedBlockId}
          sourceId={sourceId}
          onClose={() => setContactOpen(false)}
          onCreated={() => setContactOpen(false)}
        />
      )}
    </div>
  );
}

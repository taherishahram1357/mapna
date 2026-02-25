const testProjects = [
  "جاسک", "اندیمشک", "بهشهر", "پردیس", "پروژه ری", "پروژه سناباد", "خاتون آباد", "راشد تربت حیدریه",
  "رودشور", "زنجان 2", "سبزوار", "سمنان بخار", "سونگون", "عسلویه (سیکل ترکیبی)", "علی آباد",
  "غرب کارون", "فردوسی (سیکل ترکیبی)", "نکا (طرح توسعه)"
];

const materials = ["سیمان", "میلگرد", "آجر", "ساندویچ پنل", "کابل فشار قوی"];
const equipments = ["توربین", "تابلو برق", "ژنراتور", "پمپ", "کندانسور", "تجهیزات روغن"];
const clientsPool = ["توانیر", "مپنا", "پتروپارس", "نفت و گاز پارس", "برق منطقه‌ای"];
const vendorsPool = ["پارس تجهیز", "دنا کالا", "توان تابلو", "آذر ماشین", "پایا صنعت", "نیک‌توربین"];

const state = {
  selectedProject: "ALL",
  scenario: {
    wageFactor: 1,
    goodsFactor: 1,
    materialFactor: 1,
    profitThreshold: 8
  },
  projects: []
};

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function toMoney(num) { return new Intl.NumberFormat("fa-IR").format(Math.round(num)) + " میلیارد ریال"; }

function seedData() {
  state.projects = testProjects.map((name, idx) => {
    const contract = rand(6000, 42000);
    const received = Math.round(contract * (rand(30, 85) / 100));
    const baseHuman = Math.round(contract * (rand(8, 18) / 100));
    const baseGoods = Math.round(contract * (rand(15, 30) / 100));
    const baseMaterial = Math.round(contract * (rand(12, 26) / 100));
    const otherCost = Math.round(contract * (rand(10, 20) / 100));
    const contractors = Array.from({ length: 3 }, (_, i) => ({
      name: `پیمانکار ${i + 1} ${name}`,
      contract: Math.round(contract * (rand(8, 18) / 100)),
      progress: rand(10, 98),
      paid: Math.round(contract * (rand(3, 12) / 100)),
      financial: rand(50, 95),
      technical: rand(45, 96)
    }));
    const suppliers = Array.from({ length: 3 }, (_, i) => ({
      name: vendorsPool[(idx + i) % vendorsPool.length],
      contract: Math.round(contract * (rand(7, 15) / 100)),
      progress: rand(12, 96),
      paid: Math.round(contract * (rand(2, 9) / 100)),
      financial: rand(40, 90),
      technical: rand(48, 97)
    }));
    return {
      id: idx + 1,
      name,
      client: clientsPool[idx % clientsPool.length],
      location: ["هرمزگان", "خوزستان", "مازندران", "خراسان", "تهران"][idx % 5],
      mw: rand(180, 650),
      contract,
      received,
      baseHuman,
      baseGoods,
      baseMaterial,
      otherCost,
      contractors,
      suppliers,
      materials: materials.map((m) => ({
        name: m,
        needed: rand(100, 700),
        bought: rand(40, 480),
        price: rand(2, 30)
      })),
      equipments: equipments.map((e) => ({
        name: e,
        maker: ["مپنا", "زیمنس", "آنسالدو", "GE"][rand(0, 3)],
        progress: rand(5, 92),
        value: rand(120, 2600),
        delivery: `140${rand(4, 6)}/${rand(1, 12).toString().padStart(2, "0")}`
      }))
    };
  });
}

function projectCost(p) {
  return p.baseHuman * state.scenario.wageFactor
    + p.baseGoods * state.scenario.goodsFactor
    + p.baseMaterial * state.scenario.materialFactor
    + p.otherCost;
}

function selectedProjects() {
  return state.selectedProject === "ALL"
    ? state.projects
    : state.projects.filter((p) => p.id === state.selectedProject);
}

function aggregate() {
  const s = selectedProjects();
  const totals = s.reduce((acc, p) => {
    const c = projectCost(p);
    acc.contract += p.contract;
    acc.received += p.received;
    acc.cost += c;
    acc.profit += p.received - c;
    return acc;
  }, { contract: 0, received: 0, cost: 0, profit: 0 });

  document.getElementById("sumContract").textContent = toMoney(totals.contract);
  document.getElementById("sumReceived").textContent = toMoney(totals.received);
  document.getElementById("sumCost").textContent = toMoney(totals.cost);
  document.getElementById("sumProfit").textContent = toMoney(totals.profit);
}

function renderProjects() {
  const host = document.getElementById("projectsList");
  host.innerHTML = "";
  const allItem = buildRow("همه پروژه‌ها", "نمایش تجمیعی", 100, 0);
  allItem.onclick = () => { state.selectedProject = "ALL"; renderAll(); };
  if (state.selectedProject === "ALL") allItem.classList.add("selected");
  host.appendChild(allItem);

  state.projects.forEach((p) => {
    const percent = Math.min(100, Math.round((p.received / p.contract) * 100));
    const row = buildRow(p.name, `قرارداد: ${toMoney(p.contract)} | دریافتی: ${toMoney(p.received)} | هزینه: ${toMoney(projectCost(p))}`, percent, p.received - projectCost(p));
    row.onclick = () => { state.selectedProject = p.id; renderAll(); };
    if (state.selectedProject === p.id) row.classList.add("selected");
    host.appendChild(row);
  });
}

function buildRow(title, meta, progress, profit) {
  const tpl = document.getElementById("rowTemplate").content.firstElementChild.cloneNode(true);
  tpl.querySelector(".row-title").textContent = title;
  tpl.querySelector(".meta").textContent = `${meta} | سود: ${toMoney(profit)}`;
  tpl.querySelector(".progress span").style.width = `${progress}%`;
  return tpl;
}

function renderSideLists() {
  const prjs = selectedProjects();
  const contractorHost = document.getElementById("contractorsList");
  const supplierHost = document.getElementById("suppliersList");
  contractorHost.innerHTML = "";
  supplierHost.innerHTML = "";

  const contractors = prjs.flatMap((p) => p.contractors.map((c) => ({ ...c, project: p.name })))
    .sort((a, b) => b.contract - a.contract);
  const suppliers = prjs.flatMap((p) => p.suppliers.map((s) => ({ ...s, project: p.name })))
    .sort((a, b) => b.contract - a.contract);

  contractors.slice(0, 12).forEach((c) => {
    contractorHost.appendChild(buildRow(c.name, `${c.project} | قرارداد: ${toMoney(c.contract)} | دریافتی: ${toMoney(c.paid)}`, c.progress, c.paid - c.contract));
  });
  suppliers.slice(0, 12).forEach((s) => {
    supplierHost.appendChild(buildRow(s.name, `${s.project} | قرارداد: ${toMoney(s.contract)} | دریافتی: ${toMoney(s.paid)}`, s.progress, s.paid - s.contract));
  });
}

function renderClients() {
  const host = document.getElementById("clientsList");
  host.innerHTML = "";
  const grouped = {};
  state.projects.forEach((p) => {
    grouped[p.client] ??= { contract: 0, paid: 0 };
    grouped[p.client].contract += p.contract;
    grouped[p.client].paid += p.received;
  });
  Object.entries(grouped)
    .sort((a, b) => b[1].contract - a[1].contract)
    .forEach(([name, g]) => host.appendChild(buildRow(name, `قرارداد: ${toMoney(g.contract)} | پرداختی: ${toMoney(g.paid)}`, Math.round((g.paid / g.contract) * 100), g.paid - g.contract)));
}

function renderAlerts() {
  const host = document.getElementById("alerts");
  host.innerHTML = "<h2>هشدارها و پیشنهاد اقدام</h2>";
  const threshold = state.scenario.profitThreshold / 100;
  const targetProjects = selectedProjects();
  let warned = 0;

  targetProjects.forEach((p) => {
    const cost = projectCost(p);
    const margin = (p.received - cost) / p.contract;
    if (margin < threshold) {
      warned += 1;
      const div = document.createElement("div");
      div.className = "alert warn";
      div.textContent = `هشدار: پروژه ${p.name} حاشیه سود ${Math.round(margin * 100)}٪ دارد (کمتر از آستانه ${state.scenario.profitThreshold}٪). پیشنهاد: بازنگری قراردادهای تأمین، فازبندی خرید متریال، یا مذاکره برای تعدیل.`;
      host.appendChild(div);
    }
  });

  if (!warned) {
    const ok = document.createElement("div");
    ok.className = "alert ok";
    ok.textContent = "وضعیت پایدار است. هیچ پروژه‌ای از آستانه هشدار عبور نکرده است.";
    host.appendChild(ok);
  }
}

function renderDetails() {
  const host = document.getElementById("projectDetails");
  const selected = selectedProjects();
  const rows = selected.slice(0, 8).map((p) => {
    const cost = projectCost(p);
    const remainMat = p.materials.reduce((a, m) => a + Math.max(0, m.needed - m.bought), 0);
    return `<tr>
      <td>${p.name}</td>
      <td>${p.client}</td>
      <td>${toMoney(p.contract)}</td>
      <td>${toMoney(cost)}</td>
      <td>${toMoney(p.received)}</td>
      <td>${toMoney(p.received - cost)}</td>
      <td>${p.location}</td>
      <td>${p.mw}</td>
      <td>${remainMat}</td>
    </tr>`;
  }).join("");

  host.innerHTML = `<table>
    <thead>
      <tr>
        <th>نام پروژه</th>
        <th>کارفرما</th>
        <th>مبلغ قرارداد</th>
        <th>هزینه پس از سناریو</th>
        <th>مبلغ دریافتی</th>
        <th>سود/زیان</th>
        <th>محل</th>
        <th>مگاوات</th>
        <th>متریال باقیمانده</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function bindScenarioForm() {
  ["wageFactor", "goodsFactor", "materialFactor", "profitThreshold"].forEach((k) => {
    document.getElementById(k).value = state.scenario[k];
  });

  document.getElementById("applyScenario").onclick = () => {
    state.scenario.wageFactor = parseFloat(document.getElementById("wageFactor").value || "1");
    state.scenario.goodsFactor = parseFloat(document.getElementById("goodsFactor").value || "1");
    state.scenario.materialFactor = parseFloat(document.getElementById("materialFactor").value || "1");
    state.scenario.profitThreshold = parseFloat(document.getElementById("profitThreshold").value || "8");
    renderAll();
  };
}

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      if (tab === "materials") {
        const p = selectedProjects()[0] || state.projects[0];
        alert(`تجهیزات ${p.name}: ${p.equipments.map((e) => e.name).join("، ")}\nمتریال: ${p.materials.map((m) => `${m.name}(${m.bought}/${m.needed})`).join("، ")}`);
      }
    };
  });
}

function renderAll() {
  renderProjects();
  renderSideLists();
  aggregate();
  renderAlerts();
  renderDetails();
  renderClients();
}

seedData();
bindScenarioForm();
bindTabs();
renderAll();

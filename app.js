const state = {
  meta: null,
  latest: null,
  categories: null,
  currentPayload: null,
  currentPath: null,
  currentItems: [],
};

const elements = {
  viewSelect: document.getElementById("view-select"),
  targetSelect: document.getElementById("target-select"),
  searchInput: document.getElementById("search-input"),
  reloadButton: document.getElementById("reload-button"),
  postList: document.getElementById("post-list"),
  jsonViewer: document.getElementById("json-viewer"),
  rawLink: document.getElementById("raw-link"),
  listTitle: document.getElementById("list-title"),
  listCount: document.getElementById("list-count"),
  heroPostCount: document.getElementById("hero-post-count"),
  heroUpdatedAt: document.getElementById("hero-updated-at"),
  heroNotice: document.getElementById("hero-notice"),
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

function renderJson(payload, path) {
  state.currentPayload = payload;
  state.currentPath = path;
  elements.jsonViewer.textContent = JSON.stringify(payload, null, 2);
  elements.rawLink.href = path;
}

function renderPosts(items) {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const filtered = items.filter((item) =>
    !keyword || (item.title || "").toLowerCase().includes(keyword)
  );

  elements.listCount.textContent = String(filtered.length);
  elements.postList.replaceChildren();

  for (const item of filtered) {
    const li = document.createElement("li");
    li.className = "post-item";
    li.innerHTML = `
      <div class="post-item-top">
        <span class="post-tag">${item.category || "미분류"}</span>
        <span class="post-date">${formatDateTime(item.published_at || item.window_end || item.last_changed_at)}</span>
      </div>
      <p class="post-title">${item.title || item.label || "제목 없음"}</p>
      <div class="post-meta">
        ${item.log_no ? `<span>logNo ${item.log_no}</span>` : ""}
        ${item.image_count !== undefined ? `<span>이미지 ${item.image_count}</span>` : ""}
        ${item.link_count !== undefined ? `<span>링크 ${item.link_count}</span>` : ""}
        ${item.new_count !== undefined ? `<span>신규 ${item.new_count}</span>` : ""}
        ${item.updated_count !== undefined ? `<span>수정 ${item.updated_count}</span>` : ""}
      </div>
      <div class="post-links">
        ${item.post_url ? `<a href="${item.post_url}" target="_blank" rel="noreferrer">원문</a>` : ""}
      </div>
    `;
    elements.postList.append(li);
  }
}

function populateTargets() {
  const view = elements.viewSelect.value;
  const select = elements.targetSelect;
  select.replaceChildren();

  const options = [];
  if (view === "latest") {
    options.push({ label: "latest", value: state.meta.latest_path });
  } else if (view === "date") {
    for (const entry of state.meta.dates) {
      options.push({ label: `${entry.date} (${entry.post_count})`, value: entry.path });
    }
  } else if (view === "category") {
    options.push({ label: "전체 카테고리", value: "__all_categories__" });
    for (const category of state.meta.categories) {
      options.push({ label: category, value: `category:${category}` });
    }
  } else if (view === "report") {
    for (const entry of state.meta.reports) {
      options.push({
        label: `${entry.label} (신규 ${entry.new_count} / 수정 ${entry.updated_count})`,
        value: entry.path,
      });
    }
  }

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
}

function extractItems(view, payload) {
  if (view === "latest") {
    return payload.posts || [];
  }
  if (view === "date") {
    return payload.posts || [];
  }
  if (view === "category") {
    return Object.entries(payload.categories || {}).flatMap(([category, posts]) =>
      posts.map((post) => ({ ...post, category }))
    );
  }
  if (view === "report") {
    return [
      ...(payload.new_posts || []).map((item) => ({ ...item, label: item.title })),
      ...(payload.updated_posts || []).map((item) => ({ ...item, label: item.title })),
    ];
  }
  return [];
}

async function loadCurrentPayload() {
  const view = elements.viewSelect.value;
  const path = elements.targetSelect.value;
  let payload;

  if (view === "category") {
    const allCategories = state.categories;
    if (path === "__all_categories__") {
      payload = allCategories;
      elements.listTitle.textContent = "카테고리 인덱스";
      renderJson(payload, `./${state.meta.category_index_path}`);
    } else {
      const category = path.replace(/^category:/, "");
      payload = {
        key: category,
        post_count: (allCategories.categories?.[category] || []).length,
        posts: allCategories.categories?.[category] || [],
      };
      elements.listTitle.textContent = `카테고리: ${category}`;
      renderJson(payload, `./${state.meta.category_index_path}`);
    }
  } else {
    payload = await fetchJson(path);

    if (view === "latest") {
      elements.listTitle.textContent = "최신 글";
    } else if (view === "date") {
      elements.listTitle.textContent = `날짜별: ${payload.key}`;
    } else {
      elements.listTitle.textContent = `리포트: ${path.split("/").pop().replace(".json", "")}`;
    }
    renderJson(payload, path);
  }

  state.currentItems = extractItems(view, payload);
  renderPosts(state.currentItems);
}

async function initialize() {
  state.meta = await fetchJson("./data/meta.json");
  state.latest = await fetchJson(`./${state.meta.latest_path}`);
  state.categories = await fetchJson(`./${state.meta.category_index_path}`);

  elements.heroPostCount.textContent = String(state.meta.latest_post_count);
  elements.heroUpdatedAt.textContent = formatDateTime(state.meta.latest_updated_at);
  elements.heroNotice.textContent = state.meta.notice;

  populateTargets();
  await loadCurrentPayload();
}

elements.viewSelect.addEventListener("change", async () => {
  populateTargets();
  await loadCurrentPayload();
});

elements.targetSelect.addEventListener("change", async () => {
  await loadCurrentPayload();
});

elements.searchInput.addEventListener("input", () => {
  renderPosts(state.currentItems);
});

elements.reloadButton.addEventListener("click", async () => {
  await initialize();
});

initialize().catch((error) => {
  elements.jsonViewer.textContent = String(error);
});

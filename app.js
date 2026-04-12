const state = {
  meta: null,
  categories: null,
  currentPayload: null,
  currentPath: null,
  currentItems: [],
  currentListTitle: "목록",
  selectedCategory: "__all__",
};

const elements = {
  viewSelect: document.getElementById("view-select"),
  searchInput: document.getElementById("search-input"),
  reloadButton: document.getElementById("reload-button"),
  postList: document.getElementById("post-list"),
  jsonViewer: document.getElementById("json-viewer"),
  rawLink: document.getElementById("raw-link"),
  listTitle: document.getElementById("list-title"),
  listCount: document.getElementById("list-count"),
  heroPostCount: document.getElementById("hero-post-count"),
  heroUpdatedAt: document.getElementById("hero-updated-at"),
  categoryFilter: document.getElementById("category-filter"),
};

const ALL_CATEGORY = "__all__";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getItemCategory(item) {
  return item.category || "미분류";
}

function renderJson(payload, path) {
  state.currentPayload = payload;
  state.currentPath = path;
  elements.jsonViewer.textContent = JSON.stringify(payload, null, 2);
  elements.rawLink.href = path;
}

function buildCategoryOrder(counts) {
  const preferred = (state.meta?.categories || []).filter((category) => counts.has(category));
  const extras = [...counts.keys()]
    .filter((category) => !preferred.includes(category))
    .sort((left, right) => left.localeCompare(right, "ko-KR"));

  return [...preferred, ...extras];
}

function renderCategoryFilter(items) {
  const counts = new Map();

  for (const item of items) {
    const category = getItemCategory(item);
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  if (state.selectedCategory !== ALL_CATEGORY && !counts.has(state.selectedCategory)) {
    state.selectedCategory = ALL_CATEGORY;
  }

  const buttons = [
    { label: "전체", value: ALL_CATEGORY, count: items.length },
    ...buildCategoryOrder(counts).map((category) => ({
      label: category,
      value: category,
      count: counts.get(category) || 0,
    })),
  ];

  elements.categoryFilter.replaceChildren();

  for (const button of buttons) {
    const element = document.createElement("button");
    element.type = "button";
    element.className =
      button.value === state.selectedCategory ? "category-chip is-active" : "category-chip";
    element.innerHTML = `${escapeHtml(button.label)} <span>${button.count}</span>`;
    element.addEventListener("click", () => {
      if (state.selectedCategory === button.value) return;
      state.selectedCategory = button.value;
      renderCategoryFilter(state.currentItems);
      renderPosts(state.currentItems);
    });
    elements.categoryFilter.append(element);
  }
}

function getFilteredItems(items) {
  const keyword = elements.searchInput.value.trim().toLowerCase();

  return items.filter((item) => {
    const categoryMatched =
      state.selectedCategory === ALL_CATEGORY || getItemCategory(item) === state.selectedCategory;
    const titleMatched = !keyword || (item.title || "").toLowerCase().includes(keyword);
    return categoryMatched && titleMatched;
  });
}

function renderPosts(items) {
  const filtered = getFilteredItems(items);

  elements.listCount.textContent = String(filtered.length);
  elements.listTitle.textContent =
    state.selectedCategory === ALL_CATEGORY
      ? state.currentListTitle
      : `${state.currentListTitle} · ${state.selectedCategory}`;
  elements.postList.replaceChildren();

  if (!filtered.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "post-list-empty";
    emptyItem.textContent = "조건에 맞는 글이 없습니다.";
    elements.postList.append(emptyItem);
    return;
  }

  for (const item of filtered) {
    const metaParts = [
      item.log_no ? `logNo ${item.log_no}` : "",
      item.image_count !== undefined ? `이미지 ${item.image_count}` : "",
      item.link_count !== undefined ? `링크 ${item.link_count}` : "",
      item.new_count !== undefined ? `신규 ${item.new_count}` : "",
      item.updated_count !== undefined ? `수정 ${item.updated_count}` : "",
    ].filter(Boolean);

    const title = item.title || item.label || "제목 없음";
    const content = `
      <div class="post-main">
        <div class="post-item-top">
          <span class="post-tag">${escapeHtml(getItemCategory(item))}</span>
        </div>
        <p class="post-title">${escapeHtml(title)}</p>
        <div class="post-meta">
          ${metaParts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}
        </div>
      </div>
      <div class="post-side">
        <span class="post-date">${escapeHtml(
          formatDateTime(item.published_at || item.window_end || item.last_changed_at)
        )}</span>
        ${item.post_url ? '<span class="post-open">원문 보기</span>' : ""}
      </div>
    `;

    const li = document.createElement("li");
    li.className = "post-item";
    li.innerHTML = item.post_url
      ? `<a class="post-item-content post-item-link" href="${escapeHtml(
          item.post_url
        )}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(
          `원문 보기: ${title}`
        )}">${content}</a>`
      : `<div class="post-item-content">${content}</div>`;
    elements.postList.append(li);
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
    if (payload.posts) {
      return (payload.posts || []).map((post) => ({
        ...post,
        category: payload.key || post.category,
      }));
    }
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
  let payload;

  if (view === "category") {
    payload = state.categories;
    state.currentListTitle = "카테고리 인덱스";
    renderJson(payload, `./${state.meta.category_index_path}`);
  } else {
    let path = `./${state.meta.latest_path}`;
    if (view === "date") {
      const latestDate = state.meta.dates?.[0];
      if (!latestDate) {
        payload = { key: "date", post_count: 0, updated_at: null, posts: [] };
        state.currentListTitle = "날짜별";
        renderJson(payload, "#");
      } else {
        path = `./${latestDate.path}`;
        payload = await fetchJson(path);
        state.currentListTitle = `날짜별: ${payload.key}`;
        renderJson(payload, path);
      }
    } else if (view === "report") {
      const latestReport = state.meta.reports?.[0];
      if (!latestReport) {
        payload = {
          window_start: null,
          window_end: null,
          new_count: 0,
          updated_count: 0,
          new_posts: [],
          updated_posts: [],
        };
        state.currentListTitle = "리포트";
        renderJson(payload, "#");
      } else {
        path = `./${latestReport.path}`;
        payload = await fetchJson(path);
        state.currentListTitle = `리포트: ${latestReport.label}`;
        renderJson(payload, path);
      }
    } else {
      payload = await fetchJson(path);
      state.currentListTitle = "최신 글";
      renderJson(payload, path);
    }
  }

  state.currentItems = extractItems(view, payload);
  renderCategoryFilter(state.currentItems);
  renderPosts(state.currentItems);
}

async function initialize() {
  state.meta = await fetchJson("./data/meta.json");
  state.categories = await fetchJson(`./${state.meta.category_index_path}`);

  elements.heroPostCount.textContent = String(state.meta.latest_post_count);
  elements.heroUpdatedAt.textContent = formatDateTime(state.meta.latest_updated_at);

  await loadCurrentPayload();
}

elements.viewSelect.addEventListener("change", async () => {
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

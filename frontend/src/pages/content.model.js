import { proxy_image_url } from "@/image-proxy.model.js";
import { task_status } from "./content_detail.model.js";

function number_or_default(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function first_non_empty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function normalize_filter_account(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const platform_id = first_non_empty(
    source.platform_id,
    source.platformId,
    source.PlatformID,
  );
  return {
    id: first_non_empty(source.id, source.ID),
    platform_id,
    external_id: first_non_empty(
      source.external_id,
      source.externalId,
      source.ExternalID,
    ),
    nickname: first_non_empty(
      source.nickname,
      source.Nickname,
      source.alias,
      source.Alias,
      source.external_id,
      source.ExternalID,
      source.id,
      source.ID,
      "未命名账号",
    ),
    avatar_url: proxy_image_url(
      platform_id,
      first_non_empty(source.avatar_url, source.avatarUrl, source.AvatarURL),
    ),
  };
}

function select_item(label, value, data = {}) {
  const item = new Timeless.vm.SelectItemCore({ label, value });
  Object.assign(item, data);
  return item;
}

function select_search(placeholder) {
  return new Timeless.vm.InputCore({
    defaultValue: "",
    placeholder,
    allowClear: true,
    autocomplete: false,
  });
}

function content_detail_href(content) {
  const id = String(first_non_empty(content && content.id, content && content.ID)).trim();
  return id ? `/content/detail?id=${encodeURIComponent(id)}` : "";
}

function normalize_content_list_response(data, fallbackPage, fallbackSize) {
  const source = data && typeof data === "object" ? data : {};
  const list = Array.isArray(source.list)
    ? source.list
    : Array.isArray(source.List)
      ? source.List
      : [];
  return {
    list,
    total: Math.max(
      0,
      number_or_default(
        typeof source.total !== "undefined" ? source.total : source.Total,
        list.length,
      ),
    ),
    page: Math.max(
      1,
      number_or_default(source.page || source.Page, fallbackPage),
    ),
    page_size: Math.max(
      1,
      number_or_default(
        source.page_size || source.pageSize || source.PageSize,
        fallbackSize,
      ),
    ),
  };
}

function normalize_content_account(raw, fallback_platform_id) {
  const source = raw && typeof raw === "object" ? raw : {};
  const platform_id = first_non_empty(
    source.platform_id,
    source.PlatformID,
    fallback_platform_id,
  );
  return {
    id: first_non_empty(source.id, source.ID),
    external_id: first_non_empty(source.external_id, source.ExternalID),
    alias: first_non_empty(source.alias, source.Alias),
    nickname: first_non_empty(
      source.nickname,
      source.Nickname,
      source.name,
      source.Name,
    ),
    avatar_url: proxy_image_url(
      platform_id,
      first_non_empty(source.avatar_url, source.AvatarURL),
    ),
    profile_url: first_non_empty(source.profile_url, source.ProfileURL),
  };
}

function normalize_content_item(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const platform_id = first_non_empty(source.platform_id, source.PlatformID);
  const accounts_source = Array.isArray(source.accounts)
    ? source.accounts
    : Array.isArray(source.Accounts)
      ? source.Accounts
      : [];
  const tasks = Array.isArray(source.download_tasks)
    ? source.download_tasks
    : Array.isArray(source.DownloadTasks)
      ? source.DownloadTasks
      : [];
  const file_count = Math.max(
    0,
    number_or_default(
      first_non_empty(source.file_count, source.fileCount, source.FileCount),
      0,
    ),
  );

  return {
    ...source,
    id: first_non_empty(source.id, source.ID),
    platform_id,
    platform_name: first_non_empty(source.platform_name, source.PlatformName),
    content_type: first_non_empty(
      source.content_type,
      source.ContentType,
      source.type,
      source.Type,
    ),
    content_subtype: first_non_empty(
      source.content_subtype,
      source.ContentSubtype,
      source.subtype,
      source.Subtype,
    ),
    title: first_non_empty(
      source.title,
      source.Title,
      source.description,
      source.Description,
    ),
    description: first_non_empty(source.description, source.Description),
    url: first_non_empty(
      source.source_url,
      source.SourceURL,
      source.url,
      source.URL,
      source.content_url,
      source.ContentURL,
    ),
    cover_url: proxy_image_url(
      platform_id,
      first_non_empty(source.cover_url, source.CoverURL, source.coverUrl),
    ),
    publish_time: number_or_default(
      first_non_empty(source.publish_time, source.PublishTime),
      0,
    ),
    accounts: accounts_source.map((account) =>
      normalize_content_account(account, platform_id),
    ),
    download_tasks: tasks,
    file_count,
  };
}

function content_platform_name(content) {
  if (content.platform_name) {
    return content.platform_name;
  }
  return (
    window.PLATFORM_NAMES[content.platform_id] ||
    content.platform_id ||
    "未知平台"
  );
}

function content_type_label(value, subtypeValue) {
  const type = String(value || "")
    .trim()
    .toLowerCase();
  const subtype = String(subtypeValue || "")
    .trim()
    .toLowerCase();
  return (
    window.CONTENT_TYPE_NAMES[subtype] ||
    window.CONTENT_TYPE_NAMES[type] ||
    subtype ||
    type ||
    "内容"
  );
}

function content_statistics(content) {
  const source = content && typeof content === "object" ? content : {};
  const tasks = Array.isArray(source.download_tasks)
    ? source.download_tasks
    : [];
  const task_statuses = new Map();
  tasks.forEach((task) => {
    const status = task_status(task.status);
    const statistic = task_statuses.get(status.tone);
    if (statistic) {
      statistic.value += 1;
    } else {
      task_statuses.set(status.tone, {
        key: status.tone,
        label: `${status.label}任务`,
        value: 1,
      });
    }
  });
  return {
    task_statuses: Array.from(task_statuses.values()),
    files: Math.max(0, number_or_default(source.file_count, 0)),
  };
}

function task_console_origin() {
  const location = window.location || {};
  const origin = location.origin || "http://127.0.0.1:2022";
  return `${origin}/console`;
}

function media_rank(file_type) {
  if (file_type === "video") return 0;
  if (file_type === "audio") return 1;
  return 9;
}

function is_http_url(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function readable_transcript(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("{")) {
    try {
      const payload = JSON.parse(text);
      if (
        payload &&
        typeof payload === "object" &&
        "code" in payload &&
        Number(payload.code) !== 0
      ) {
        return "";
      }
    } catch (_error) {
      return text;
    }
  }
  return text;
}

function transcript_sidecar_path(media_path) {
  const path = String(media_path || "").trim();
  if (!path) return "";
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  if (!stem) return "";
  return `${dir}${stem}.transcript.txt`;
}

function file_href(path, download) {
  const params = new URLSearchParams();
  params.set("path", path);
  if (download) params.set("download", "1");
  return `/api/file?${params.toString()}`;
}

function toast(message) {
  if (window.DLUtils && typeof DLUtils.toast === "function") {
    DLUtils.toast(message);
  }
}

function download_href(path) {
  const link = document.createElement("a");
  link.href = file_href(path, true);
  link.download = "";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function pick_media_resource(detail) {
  const resources = Array.isArray(detail && detail.resources)
    ? detail.resources
    : [];
  const candidates = resources.filter((resource) => {
    const file_type = String(
      first_non_empty(resource.file_type, resource.FileType),
    ).toLowerCase();
    const path = String(
      first_non_empty(resource.local_path, resource.LocalPath),
    ).trim();
    const exists = resource.exists === true || resource.Exists === true;
    return (
      exists && path && (file_type === "video" || file_type === "audio")
    );
  });
  candidates.sort(
    (left, right) =>
      media_rank(String(left.file_type || left.FileType || "").toLowerCase()) -
      media_rank(String(right.file_type || right.FileType || "").toLowerCase()),
  );
  return candidates[0] || null;
}

function source_media_url(detail, content) {
  const resources = Array.isArray(detail && detail.resources)
    ? detail.resources
    : [];
  const ranked = resources
    .map((resource) => ({
      url: String(
        first_non_empty(resource.url, resource.URL, resource.stream_url),
      ).trim(),
      type: String(
        first_non_empty(
          resource.file_type,
          resource.FileType,
          resource.type,
          resource.Type,
        ),
      ).toLowerCase(),
    }))
    .filter((item) => is_http_url(item.url));
  ranked.sort((left, right) => media_rank(left.type) - media_rank(right.type));
  const chosen = ranked.find((item) => media_rank(item.type) < 9) || ranked[0];
  if (chosen) return chosen.url;
  return String(
    first_non_empty(
      content && content.url,
      detail && detail.source_url,
      detail && detail.url,
    ),
  ).trim();
}

function content_task_ids(content) {
  const tasks = Array.isArray(content && content.download_tasks)
    ? content.download_tasks
    : [];
  return tasks
    .map((task) => first_non_empty(task && task.id, task && task.ID))
    .filter((id) => id !== undefined && id !== null && String(id) !== "");
}

function ContentViewModel(props) {
  const PAGE_SIZE_DEFAULT = 50;
  const contents_ = refarr([]);
  const total_ = ref(0);
  const page_ = ref(1);
  const page_size_ = ref(PAGE_SIZE_DEFAULT);
  const keyword_ = ref("");
  const content_type_ = ref("");
  const platform_id_ = ref("");
  const account_id_ = ref("");
  const scope_ = ref("task");
  const initial_ = ref(true);
  const loading_ = ref(false);
  const error_ = ref("");
  const detail_id_ = ref("");
  const copied_content_id_ = ref("");
  const transcript_jobs_ = refobj({});
  const transcript_title_ = ref("文案提取");
  const transcript_action_label_ = ref("开始提取");
  const transcript_text_ = ref("");
  const transcript_message_ = ref("");
  const transcript_path_ = ref("");
  const transcript_busy_ = ref(false);
  const transcript_content_id_ = ref("");
  const reverse_jobs_ = refobj({});
  const reverse_title_ = ref("视频反推");
  const reverse_action_label_ = ref("开始反推");
  const reverse_text_ = ref("");
  const reverse_message_ = ref("");
  const reverse_path_ = ref("");
  const reverse_vlm_ = ref(false);
  const reverse_vlm_frames_ = ref("3");
  const reverse_content_id_ = ref("");
  let reverse_sequence = 0;
  let reverse_timer = null;
  const file_url_ = ref("");
  const file_url_title_ = ref("源站下载地址");
  const white_model_jobs_ = refobj({});
  const white_model_title_ = ref("转白模");
  const white_model_message_ = ref("");
  const white_model_error_ = ref("");
  const white_model_path_ = ref("");
  const white_model_url_ = ref("");
  const white_model_progress_ = ref(-1);
  const white_model_contrast_ = ref(50);
  const white_model_relief_ = ref(30);
  const white_model_detail_ = ref(640);
  const white_model_source_ = ref("");
  const white_model_content_id_ = ref("");
  let white_model_apply_settings = false;
  const remake_jobs_ = refobj({});
  const remake_title_ = ref("视频复刻");
  const remake_message_ = ref("");
  const remake_error_ = ref("");
  const remake_path_ = ref("");
  const remake_url_ = ref("");
  const remake_progress_ = ref(-1);
  const remake_source_ = ref("");
  const remake_reference_ = ref({ source: true, white: false, whiteReady: false, model: "mu-video" });
  const remake_image_name_ = ref("可以不选参考图");
  const remake_shots_ = ref([]);
  const remake_story_rows_ = ref([]);
  const remake_story_busy_id_ = ref("");
  const remake_board_preview_ = ref(null);
  const remake_shot_mode_ = ref("scene");
  const remake_story_model_ = ref("gt-image");
  const remake_story_use_refs = Object.create(null);
  const remake_story_refs_ = ref([]);
  const remake_shot_message_ = ref("拉片后关键帧会留在这里，点一张可放大查看；生图参考用分镜表中的参考图。");
  const remake_shot_busy_ = ref(false);
  const remake_shot_phase_ = ref("");
  const remake_shot_id_ = ref("");
  let remake_shot_frames = [];
  const remake_story_prompts = Object.create(null);
  const remake_story_video_prompts = Object.create(null);
  const remake_story_scripts = Object.create(null);
  const remake_story_script_ = ref("");
  const remake_prompt_ = ref("");
  const remake_note_ = ref("");
  const remake_content_id_ = ref("");
  let remake_image_file = null;
  let remake_sequence = 0;
  let remake_timer = null;
  let remake_fill_from_reverse = false;
  const remake_reverse_label_ = ref("视频反推");
  const delete_task_ids_ = refarr([]);
  const delete_task_title_ = ref("");
  const delete_files_ = ref(true);
  const deleting_ = ref(false);
  let request_sequence = 0;
  let transcript_sequence = 0;
  let white_model_sequence = 0;
  let white_model_timer = null;
  let account_request_sequence = 0;
  let copy_feedback_timer = null;

  const ui = {
    input_keyword$: new Timeless.vm.InputCore({
      defaultValue: keyword_.value,
      placeholder: "搜索标题或描述",
      type: "search",
      allowClear: true,
      onChange(value) {
        set_keyword(value);
      },
      onEnter() {
        return methods.search();
      },
    }),
    checkbox_all$: new Timeless.vm.CheckboxCore({
      checked: scope_.value === "all",
      onChange(value) {
        set_all_scope(value);
      },
    }),
    select_platform$: new Timeless.vm.SelectCore({
      defaultValue: "",
      placeholder: "全部平台",
      search: select_search("搜索平台"),
      position: "popper",
      options: [
        ["", "全部平台"],
        ...Object.entries(window.PLATFORM_NAMES || {}),
      ].map(([value, label]) => select_item(label, value)),
      onChange(value) {
        account_id_.as("");
        ui.select_account$.setValue("", { silence: true });
        platform_id_.as(String(value || ""));
        void load_accounts();
        return load(1);
      },
    }),
    select_account$: new Timeless.vm.SelectCore({
      defaultValue: "",
      placeholder: "全部账号",
      search: select_search("搜索账号"),
      position: "popper",
      options: [select_item("全部账号", "")],
      onChange(value) {
        account_id_.as(String(value || ""));
        return load(1);
      },
    }),
    select_content_type$: new Timeless.vm.SelectCore({
      defaultValue: "",
      placeholder: "全部类型",
      position: "item-aligned",
      options: [
        new Timeless.vm.SelectItemCore({ label: "全部类型", value: "" }),
        new Timeless.vm.SelectItemCore({ label: "视频", value: "video" }),
        new Timeless.vm.SelectItemCore({
          label: "短视频",
          value: "short_video",
        }),
        new Timeless.vm.SelectItemCore({ label: "图集", value: "image_set" }),
        new Timeless.vm.SelectItemCore({ label: "文章", value: "article" }),
        new Timeless.vm.SelectItemCore({ label: "小说", value: "novel" }),
        new Timeless.vm.SelectItemCore({ label: "音频", value: "audio" }),
        new Timeless.vm.SelectItemCore({ label: "直播", value: "live" }),
      ],
      onChange(value) {
        content_type_.as(String(value || ""));
        load(1);
      },
    }),
    btn_search$: new Timeless.vm.ButtonCore({
      disabled: loading_.value,
      variant: "primary",
    }),
    btn_refresh$: new Timeless.vm.ButtonCore({
      disabled: loading_.value,
      variant: "outline",
      onClick() {
        reset_filters();
        void load_accounts();
        return load(1);
      },
    }),
    btn_retry$: new Timeless.vm.ButtonCore({
      disabled: loading_.value,
      variant: "primary",
      onClick() {
        return load(page_.value);
      },
    }),
    contentDetailDrawer$: new Timeless.vm.DialogCore({
      title: "内容详情",
      closeable: true,
      footer: false,
    }),
    transcriptDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_transcript_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      onClick() {
        return methods.copyTranscript();
      },
    }),
    btn_transcript_rerun$: new Timeless.vm.ButtonCore({
      variant: "primary",
      onClick() {
        return methods.rerunTranscript();
      },
    }),
    reverseDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_reverse_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.copyReverse();
      },
    }),
    btn_reverse_open$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.openReverseReport();
      },
    }),
    btn_reverse_rerun$: new Timeless.vm.ButtonCore({
      variant: "primary",
      disabled: true,
      onClick() {
        return methods.rerunReverse();
      },
    }),
    fileUrlDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_file_url_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      onClick() {
        return methods.copyFileURL();
      },
    }),
    whiteModelDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_white_model_run$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runWhiteModel();
      },
    }),
    btn_white_model_download$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadWhiteModel();
      },
    }),
    remakeDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_remake_prompt$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runRemakeReverse();
      },
    }),
    btn_remake_reverse_report$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.openRemakeReverseReport();
      },
    }),
    btn_remake_run$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runRemake();
      },
    }),
    btn_remake_download$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadRemake();
      },
    }),
    input_remake_note$: new Timeless.vm.InputCore({
      defaultValue: "",
      allowClear: false,
      ignoreEnterEvent: true,
      placeholder: "写下你想要的画面，例如人物在做什么、什么语气、什么风格。留空则按参考图和原始视频来写。",
      onChange(value) {
        remake_note_.as(value);
      },
    }),
    deleteConfirmDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      onOk() {
        return methods.confirmDelete();
      },
    }),
  };

  keyword_.subscribe({
    onChange(value) {
      if (ui.input_keyword$.value !== value) {
        ui.input_keyword$.setValue(value, { silence: true });
      }
    },
  });
  scope_.subscribe({
    onChange(value) {
      const checked = value === "all";
      if (ui.checkbox_all$.checked !== checked) {
        ui.checkbox_all$.setValue(checked, { silence: true });
      }
    },
  });
  loading_.subscribe({
    onChange(loading) {
      [ui.btn_search$, ui.btn_refresh$, ui.btn_retry$].forEach((button) => {
        if (loading) {
          button.disable();
        } else {
          button.enable();
        }
      });
    },
  });

  const list_request = new Timeless.kit.RequestCore(
    (params) => window.request.get("/api/content/list", params),
    {
      client: props.client,
      process(response) {
        if (response.error) {
          return Timeless.Result.Err(response.error);
        }
        return Timeless.Result.Ok(
          normalize_content_list_response(
            response.data,
            page_.value,
            page_size_.value,
          ),
        );
      },
    },
  );
  const account_list_request = new Timeless.kit.RequestCore(
    (params) => window.request.get("/api/account/list", params),
    { client: props.client },
  );

  const page_count_ = combine(
    { total: total_, pageSize: page_size_ },
    (state) =>
      Math.max(1, Math.ceil(state.total / Math.max(1, state.pageSize))),
  );
  const range_text_ = combine(
    {
      total: total_,
      page: page_,
      pageSize: page_size_,
      count: computed(contents_, (contents) => contents.length),
    },
    (state) => {
      if (!state.total || !state.count) {
        return `共 ${state.total || 0} 条`;
      }
      const start = (state.page - 1) * state.pageSize + 1;
      return `第 ${start}-${start + state.count - 1} 条，共 ${state.total} 条`;
    },
  );
  const list_status_ = combine(
    {
      initial: initial_,
      error: error_,
      contents: contents_,
    },
    (state) => {
      if (state.initial) return "initial";
      if (state.error) return "error";
      return state.contents.length > 0 ? "normal" : "empty";
    },
  );

  async function load(targetPage = page_.value) {
    const sequence = ++request_sequence;
    const requestedPage = Math.max(1, Number(targetPage) || 1);
    loading_.as(true);

    const params = {
      page: requestedPage,
      page_size: page_size_.value,
      scope: scope_.value,
    };
    const keyword = String(keyword_.value || "").trim();
    const contentType = String(content_type_.value || "").trim();
    const platform_id = String(platform_id_.value || "").trim();
    const account_id = String(account_id_.value || "").trim();
    if (keyword) {
      params.keyword = keyword;
    }
    if (contentType) {
      params.content_type = contentType;
    }
    if (platform_id) {
      params.platform_id = platform_id;
    }
    if (account_id) {
      params.account_id = account_id;
    }

    const result = await list_request.run(params);
    if (sequence !== request_sequence) {
      return result;
    }
    if (result.error) {
      error_.as(result.error.message || String(result.error));
      loading_.as(false);
      initial_.as(false);
      return result;
    }

    const data = result.data;
    error_.as("");
    contents_.as(data.list.map(normalize_content_item), { reset: true });
    total_.as(data.total);
    page_.as(data.page);
    page_size_.as(data.page_size);
    loading_.as(false);
    initial_.as(false);
    return result;
  }

  async function load_accounts() {
    const sequence = ++account_request_sequence;
    const selected_account_id = String(account_id_.value || "");
    const params = { page: 1, page_size: 200 };
    const platform_id = String(platform_id_.value || "").trim();
    if (platform_id) {
      params.platform_id = platform_id;
    }

    ui.select_account$.setLoading(true);
    const result = await account_list_request.run(params);
    if (sequence !== account_request_sequence) return result;

    const source = result.error ? {} : result.data || {};
    const list = Array.isArray(source.list)
      ? source.list
      : Array.isArray(source.List)
        ? source.List
        : [];
    const accounts = list.map(normalize_filter_account);
    const options = [
      select_item("全部账号", ""),
      ...accounts
        .filter((account) => account.id)
        .map((account) =>
          select_item(account.nickname, account.id, {
            account,
            search_text: [
              account.nickname,
              account.external_id,
              account.id,
            ].join(" "),
          }),
        ),
    ];
    const next_account_id = accounts.some(
      (account) => account.id === selected_account_id,
    )
      ? selected_account_id
      : "";
    account_id_.as(next_account_id);
    ui.select_account$.setOptions(options);
    ui.select_account$.setValue(next_account_id, { silence: true });
    ui.select_account$.setLoading(false);
    return result;
  }

  function set_keyword(value) {
    keyword_.as(String(value || ""));
  }

  function reset_filters() {
    set_keyword("");
    content_type_.as("");
    platform_id_.as("");
    account_id_.as("");
    ui.input_keyword$.setValue("", { silence: true });
    ui.select_content_type$.setValue("", { silence: true });
    ui.select_platform$.setValue("", { silence: true });
    ui.select_account$.setValue("", { silence: true });
  }

  function set_all_scope(value) {
    scope_.as(value ? "all" : "task");
    return load(1);
  }

  function change_page(target_page) {
    const page = Math.min(
      page_count_.value,
      Math.max(1, Number(target_page) || 1),
    );
    if (page === page_.value || loading_.value) return null;
    return load(page);
  }

  const methods = {
    ready() {
      return Promise.all([load_accounts(), load(1)]);
    },
    refresh() {
      return load(1);
    },
    search() {
      return load(1);
    },
    setKeyword: set_keyword,
    changePage: change_page,
    previousPage() {
      return change_page(page_.value - 1);
    },
    nextPage() {
      return change_page(page_.value + 1);
    },
    copyId(content) {
      const result = props.app.copy(content.id);
      copied_content_id_.as(content.id);
      clearTimeout(copy_feedback_timer);
      copy_feedback_timer = setTimeout(() => copied_content_id_.as(""), 3000);
      return result;
    },
    openSource(content) {
      if (!content || !content.url) {
        return;
      }
      props.app.openWindow(content.url);
    },
    openDetail(content) {
      const id = String(
        first_non_empty(content && content.id, content && content.ID),
      ).trim();
      if (!id) return;
      detail_id_.as(id);
      ui.contentDetailDrawer$.show();
    },
    detailHref: content_detail_href,
    platformName: content_platform_name,
    typeLabel: content_type_label,
    statistics: content_statistics,
    formatTime: window.format_time,
    openTranscript(content) {
      return open_transcript(content);
    },
    rerunTranscript() {
      const id = String(transcript_content_id_.value || "").trim();
      if (!id) return null;
      const again = transcript_action_label_.value === "重新提取";
      return load_transcript(
        { id, title: transcript_title_.value },
        again,
      );
    },
    copyTranscript() {
      const text = String(transcript_text_.value || "").trim();
      if (!text) return null;
      return props.app.copy(text);
    },
    openReverse(content) {
      return open_reverse(content);
    },
    rerunReverse() {
      return rerun_reverse();
    },
    copyReverse() {
      const text = String(reverse_text_.value || "").trim();
      if (!text) return null;
      return props.app.copy(text);
    },
    openReverseReport() {
      return open_reverse_report();
    },
    showFileURL(content) {
      return show_file_url(content);
    },
    copyFileURL() {
      const text = String(file_url_.value || "").trim();
      if (!text) return null;
      return props.app.copy(text);
    },
    downloadFile(content) {
      return download_content_file(content);
    },
    openWhiteModel(content) {
      return open_white_model(content);
    },
    runWhiteModel() {
      return run_white_model();
    },
    downloadWhiteModel() {
      const path = String(white_model_path_.value || "").trim();
      if (!path) return false;
      download_href(path);
      return true;
    },
    openRemake(content) {
      return open_remake(content);
    },
    previewRemakePrompt() {
      return run_remake_reverse();
    },
    runRemakeReverse() {
      return run_remake_reverse();
    },
    openRemakeReverseReport() {
      return open_remake_reverse_report();
    },
    runRemake() {
      return run_remake();
    },
    downloadRemake() {
      const path = String(remake_path_.value || "").trim();
      if (!path) return false;
      download_href(path);
      return true;
    },
    pickRemakeModel(value) {
      const current = normalize_remake_reference();
      current.model = ["hailuo", "hailuo-2-3", "buming-h3", "wan-3-0"].includes(value)
        ? value
        : "mu-video";
      remake_reference_.as(current);
    },
    pickRemakeReference(value) {
      const current = normalize_remake_reference();
      if (
        current.model !== "hailuo" &&
        current.model !== "buming-h3" &&
        current.model !== "wan-3-0"
      ) return;
      if (value === "source") current.source = !current.source;
      if (value === "white" && current.whiteReady) current.white = !current.white;
      remake_reference_.as(current);
      sync_remake_run_button();
    },
    pickRemakeShotMode(value) {
      remake_shot_mode_.as(value === "plot" ? "plot" : "scene");
    },
    pickRemakeStoryModel(value) {
      const raw = String(value || "").trim();
      if (raw === "seedream") remake_story_model_.as("seedream");
      else if (raw === "mj-img" || raw === "mj" || raw === "mj_imagine") {
        remake_story_model_.as("mj-img");
      } else if (raw === "mu-image" || raw === "muse-image") {
        remake_story_model_.as("mu-image");
      } else remake_story_model_.as("gt-image");
    },
    toggleRemakeStoryUseRef(shotId) {
      const id = String(shotId || "").trim();
      if (!id) return;
      remake_story_use_refs[id] = remake_story_use_refs[id] === false;
      remake_story_rows_.as(
        (remake_story_rows_.value || []).map((row) => {
          if (String(row.id || "") !== id) return row;
          const useRef = remake_story_use_refs[id] !== false;
          return {
            ...row,
            useRef,
            rowKey: `${row.rowKey || id}:ref${useRef ? "1" : "0"}`,
          };
        }),
      );
    },
    runRemakeShots() {
      return run_remake_shots();
    },
    runRemakeStoryboard(shotId) {
      return run_remake_storyboard(shotId);
    },
    runRemakeStoryPrompts(shotId) {
      return run_remake_story_prompts(shotId);
    },
    runRemakeStoryScript(shotId) {
      return run_remake_story_script(shotId);
    },
    updateRemakeStoryScript(shotId, script) {
      return update_remake_story_script(shotId, script);
    },
    runRemakeStoryVideo(shotId) {
      return run_remake_story_video(shotId);
    },
    updateRemakeStoryPrompt(shotId, prompt) {
      return update_remake_story_prompt(shotId, prompt);
    },
    updateRemakeStoryVideoPrompt(shotId, prompt) {
      return update_remake_story_video_prompt(shotId, prompt);
    },
    openRemakeBoard(board) {
      return open_remake_board(board);
    },
    closeRemakeBoard() {
      return close_remake_board();
    },
    saveRemakeBoard() {
      return save_remake_board();
    },
    pickRemakeShot(shot) {
      return pick_remake_shot(shot);
    },
    pickRemakeImage(file) {
      remake_shot_id_.as("");
      show_remake_shots(remake_shot_frames, "");
      remake_image_file = file;
      remake_image_name_.as(file ? file.name : "可以不选参考图");
      sync_remake_run_button();
    },
    requestDelete(content) {
      const ids = content_task_ids(content);
      if (!ids.length) {
        toast("这条内容没有下载任务");
        return null;
      }
      delete_task_ids_.as(ids);
      delete_task_title_.as(
        String((content && content.title) || "下载任务").trim() || "下载任务",
      );
      delete_files_.as(true);
      ui.deleteConfirmDialog$.show();
      return true;
    },
    confirmDelete() {
      return confirm_delete();
    },
    clean() {
      stop_white_model_poll();
      stop_remake_poll();
      stop_reverse_poll();
    },
  };

  const state = {
    contents: contents_,
    total: total_,
    page: page_,
    page_size: page_size_,
    page_count: page_count_,
    range_text: range_text_,
    scope: scope_,
    platform_id: platform_id_,
    account_id: account_id_,
    initial: initial_,
    status: list_status_,
    loading: loading_,
    error: error_,
    detail_id: detail_id_,
    copied_content_id: copied_content_id_,
    transcript_jobs: transcript_jobs_,
    reverse_jobs: reverse_jobs_,
    reverse_title: reverse_title_,
    reverse_text: reverse_text_,
    reverse_message: reverse_message_,
    reverse_action_label: reverse_action_label_,
    reverse_vlm: reverse_vlm_,
    reverse_vlm_frames: reverse_vlm_frames_,
    transcript_title: transcript_title_,
    transcript_text: transcript_text_,
    transcript_message: transcript_message_,
    transcript_action_label: transcript_action_label_,
    transcript_path: transcript_path_,
    transcript_busy: transcript_busy_,
    file_url: file_url_,
    file_url_title: file_url_title_,
    white_model_jobs: white_model_jobs_,
    white_model_title: white_model_title_,
    white_model_message: white_model_message_,
    white_model_error: white_model_error_,
    white_model_url: white_model_url_,
    white_model_progress: white_model_progress_,
    white_model_contrast: white_model_contrast_,
    white_model_relief: white_model_relief_,
    white_model_detail: white_model_detail_,
    remake_jobs: remake_jobs_,
    remake_title: remake_title_,
    remake_message: remake_message_,
    remake_url: remake_url_,
    remake_progress: remake_progress_,
    remake_reference: remake_reference_,
    remake_image_name: remake_image_name_,
    remake_shots: remake_shots_,
    remake_story_rows: remake_story_rows_,
    remake_story_busy_id: remake_story_busy_id_,
    remake_board_preview: remake_board_preview_,
    remake_shot_mode: remake_shot_mode_,
    remake_story_model: remake_story_model_,
    remake_story_refs: remake_story_refs_,
    remake_story_script: remake_story_script_,
    remake_reverse_label: remake_reverse_label_,
    remake_shot_message: remake_shot_message_,
    remake_shot_busy: remake_shot_busy_,
    remake_shot_phase: remake_shot_phase_,
    remake_prompt: remake_prompt_,
    delete_task_title: delete_task_title_,
    delete_task_count: computed(delete_task_ids_, (ids) =>
      Array.isArray(ids) ? ids.length : 0,
    ),
    delete_files: delete_files_,
    deleting: deleting_,
  };

  function set_transcript_job(id, status) {
    if (!id) return;
    transcript_jobs_.as({ ...transcript_jobs_.value, [id]: status });
  }

  async function fetch_content_detail(id) {
    const response = await fetch(
      `/api/content/detail?id=${encodeURIComponent(id)}`,
    );
    const payload = await response.json();
    if (!payload || payload.code !== 0) {
      throw new Error((payload && payload.msg) || "内容详情加载失败");
    }
    return payload.data || {};
  }

  function open_transcript(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return null;
    if (transcript_jobs_.value[id] === "loading") {
      ui.transcriptDialog$.show();
      return null;
    }
    const title = String((content && content.title) || "文案提取").trim() || "文案提取";
    const same = String(transcript_content_id_.value || "") === id;
    transcript_content_id_.as(id);
    transcript_title_.as(title);
    if (!same) {
      transcript_text_.as("");
      transcript_path_.as("");
      transcript_action_label_.as("开始提取");
      transcript_message_.as("点击「开始提取」开始识别口播。");
      ui.btn_transcript_copy$.disable();
      ui.btn_transcript_rerun$.disable();
    } else {
      transcript_action_label_.as(
        String(transcript_text_.value || "").trim() ? "重新提取" : "开始提取",
      );
    }
    ui.transcriptDialog$.show();
    return show_saved_transcript(content);
  }

  async function show_saved_transcript(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    const sequence = ++transcript_sequence;
    if (!String(transcript_text_.value || "").trim()) {
      transcript_message_.as("正在读取本地文案…");
    }
    try {
      const detail = await fetch_content_detail(id);
      if (sequence !== transcript_sequence) return null;
      const resource = pick_media_resource(detail);
      if (!resource) {
        transcript_text_.as("");
        transcript_path_.as("");
        transcript_message_.as("这条内容没有已下载的本地音视频，请先下载。");
        ui.btn_transcript_copy$.disable();
        ui.btn_transcript_rerun$.disable();
        set_transcript_job(id, "empty");
        return null;
      }
      const media_path = String(
        first_non_empty(resource.local_path, resource.LocalPath),
      ).trim();
      transcript_path_.as(media_path);
      const sidecar = transcript_sidecar_path(media_path);
      const response = await fetch(file_href(sidecar, false));
      if (sequence !== transcript_sequence) return null;
      const text = response.ok
        ? readable_transcript(await response.text())
        : "";
      if (sequence !== transcript_sequence) return null;
      if (!text) {
        transcript_text_.as("");
        transcript_action_label_.as("开始提取");
        transcript_message_.as("点击「开始提取」开始识别口播。");
        ui.btn_transcript_copy$.disable();
        ui.btn_transcript_rerun$.enable();
        if (transcript_jobs_.value[id] !== "loading") {
          set_transcript_job(id, "");
        }
        return null;
      }
      transcript_text_.as(text);
      transcript_action_label_.as("重新提取");
      transcript_message_.as("已读取本地文案。可以重新提取。");
      ui.btn_transcript_copy$.enable();
      ui.btn_transcript_rerun$.enable();
      set_transcript_job(id, "ready");
      return text;
    } catch (error) {
      if (sequence !== transcript_sequence) return null;
      transcript_action_label_.as("重新提取");
      transcript_message_.as(
        error && error.message ? error.message : "读取文案失败",
      );
      ui.btn_transcript_rerun$.enable();
      return null;
    }
  }

  async function show_file_url(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    const title =
      String((content && content.title) || "源站下载地址").trim() || "源站下载地址";
    file_url_title_.as(title);
    file_url_.as("");
    ui.fileUrlDialog$.show();
    if (!id) {
      file_url_.as("");
      return null;
    }
    try {
      const detail = await fetch_content_detail(id);
      file_url_.as(source_media_url(detail, content));
    } catch (error) {
      file_url_.as("");
      toast(error && error.message ? error.message : "读取下载地址失败");
    }
    return true;
  }

  async function download_content_file(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return false;
    try {
      const detail = await fetch_content_detail(id);
      const resource = pick_media_resource(detail);
      const media_path = String(
        first_non_empty(
          resource && resource.local_path,
          resource && resource.LocalPath,
        ),
      ).trim();
      if (!media_path) {
        toast("视频还没下载完成");
        return false;
      }
      download_href(media_path);
      return true;
    } catch (error) {
      toast(error && error.message ? error.message : "下载失败");
      return false;
    }
  }

  function set_white_model_job(id, status) {
    if (!id) return;
    white_model_jobs_.as({ ...white_model_jobs_.value, [id]: status });
  }

  function stop_white_model_poll() {
    if (white_model_timer) {
      clearInterval(white_model_timer);
      white_model_timer = null;
    }
  }

  function show_white_model_file(path, message) {
    white_model_path_.as(path);
    white_model_url_.as(`${file_href(path, false)}&t=${Date.now()}`);
    white_model_progress_.as(-1);
    white_model_error_.as("");
    white_model_message_.as(message || "已有白模视频");
    ui.btn_white_model_download$.enable();
    ui.btn_white_model_run$.enable();
  }

  function remember_white_model_settings(payload) {
    if (!white_model_apply_settings) return;
    const settings = payload && payload.settings;
    if (!settings || typeof settings !== "object") return;
    white_model_apply_settings = false;
    const contrast = Number(settings.contrast);
    const relief = Number(settings.relief);
    const detail = Number(settings.max_res);
    if (Number.isFinite(contrast)) {
      white_model_contrast_.as(Math.max(0, Math.min(100, Math.round(contrast))));
    }
    if (Number.isFinite(relief)) {
      white_model_relief_.as(Math.max(0, Math.min(100, Math.round(relief))));
    }
    if ([480, 640, 960].includes(detail)) white_model_detail_.as(detail);
  }

  function white_model_request_settings() {
    const contrast = Number(white_model_contrast_.value);
    const relief = Number(white_model_relief_.value);
    const detail = Number(white_model_detail_.value);
    return {
      contrast: Number.isFinite(contrast)
        ? Math.max(0, Math.min(100, Math.round(contrast)))
        : 40,
      relief: Number.isFinite(relief)
        ? Math.max(0, Math.min(100, Math.round(relief)))
        : 50,
      max_res: [480, 640, 960].includes(detail) ? detail : 640,
    };
  }

  function apply_white_model_status(payload, sequence, id) {
    if (sequence !== white_model_sequence) return;
    remember_white_model_settings(payload);
    if (!payload || payload.ok === false || payload.status === "error") {
      stop_white_model_poll();
      white_model_url_.as("");
      white_model_progress_.as(-1);
      const original = String(
        (payload && payload.error) || (payload && payload.message) || "转白模失败",
      );
      const explanation = String((payload && payload.explanation) || "").trim();
      white_model_message_.as(explanation || original);
      white_model_error_.as(explanation && explanation !== original ? original : "");
      set_white_model_job(id, "error");
      ui.btn_white_model_download$.disable();
      ui.btn_white_model_run$.enable();
      return;
    }
    if (payload.status === "running") {
      const progress = Number(payload.progress);
      white_model_progress_.as(Number.isFinite(progress) ? progress : 0);
      white_model_error_.as("");
      white_model_message_.as(payload.message || "正在转白模…");
      set_white_model_job(id, "loading");
      ui.btn_white_model_run$.disable();
      return;
    }
    if (payload.status === "ready" && payload.path) {
      stop_white_model_poll();
      show_white_model_file(payload.path, payload.message);
      set_white_model_job(id, "ready");
      return;
    }
    stop_white_model_poll();
    white_model_url_.as("");
    white_model_path_.as("");
    white_model_progress_.as(-1);
    white_model_error_.as("");
    white_model_message_.as(payload.message || "点击「转白模」开始。");
    set_white_model_job(id, "");
    ui.btn_white_model_download$.disable();
    ui.btn_white_model_run$.enable();
  }

  async function refresh_white_model(sequence, id) {
    const source = String(white_model_source_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/white-model?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_white_model_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== white_model_sequence) return null;
      white_model_message_.as("任务服务没有在运行。转白模需要本机任务页保持启动。");
      set_white_model_job(id, "error");
      ui.btn_white_model_run$.enable();
      return null;
    }
  }

  function watch_white_model(id) {
    stop_white_model_poll();
    const sequence = white_model_sequence;
    white_model_timer = setInterval(() => {
      refresh_white_model(sequence, id);
    }, 2000);
  }

  async function open_white_model(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return null;
    stop_white_model_poll();
    const title = String((content && content.title) || "转白模").trim() || "转白模";
    const same = String(white_model_content_id_.value || "") === id;
    white_model_content_id_.as(id);
    white_model_title_.as(title);
    if (!same) {
      white_model_url_.as("");
      white_model_path_.as("");
      white_model_source_.as("");
      white_model_progress_.as(-1);
      white_model_error_.as("");
      white_model_contrast_.as(50);
      white_model_relief_.as(30);
      white_model_detail_.as(640);
      white_model_message_.as("点击「转白模」开始。");
      ui.btn_white_model_download$.disable();
    }
    white_model_apply_settings = true;
    ui.btn_white_model_run$.disable();
    ui.whiteModelDialog$.show();
    try {
      const detail = await fetch_content_detail(id);
      if (String(white_model_content_id_.value || "") !== id) return null;
      const resource = pick_media_resource(detail);
      const media_path = String(
        first_non_empty(
          resource && resource.local_path,
          resource && resource.LocalPath,
        ),
      ).trim();
      if (!media_path) {
        white_model_message_.as("这条内容没有可转换的本地音视频。");
        ui.btn_white_model_run$.disable();
        return null;
      }
      white_model_source_.as(media_path);
      ui.btn_white_model_run$.enable();
      const sequence = ++white_model_sequence;
      const payload = await refresh_white_model(sequence, id);
      if (payload && payload.status === "running") watch_white_model(id);
      return payload;
    } catch (error) {
      white_model_message_.as(
        error && error.message ? error.message : "读取本地视频失败",
      );
      ui.btn_white_model_run$.disable();
      return null;
    }
  }

  async function run_white_model() {
    const id = String(white_model_content_id_.value || "").trim();
    const source = String(white_model_source_.value || "").trim();
    if (!id || !source) return null;
    stop_white_model_poll();
    const sequence = ++white_model_sequence;
    const force = Boolean(white_model_url_.value);
    white_model_progress_.as(0);
    white_model_error_.as("");
    white_model_message_.as("正在准备转白模…");
    set_white_model_job(id, "loading");
    ui.btn_white_model_run$.disable();
    ui.btn_white_model_download$.disable();
    if (force) {
      white_model_url_.as("");
      white_model_path_.as("");
    }
    try {
      const response = await fetch(`${task_console_origin()}/api/white-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: source, force, ...white_model_request_settings() }),
      });
      const payload = await response.json().catch(() => ({}));
      apply_white_model_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_white_model(id);
      return payload;
    } catch (_error) {
      if (sequence !== white_model_sequence) return null;
      white_model_message_.as("任务服务没有在运行。转白模需要本机任务页保持启动。");
      set_white_model_job(id, "error");
      ui.btn_white_model_run$.enable();
      return null;
    }
  }

  async function confirm_delete() {
    if (deleting_.value) return null;
    const ids = delete_task_ids_.value || [];
    if (!ids.length) {
      ui.deleteConfirmDialog$.hide();
      return null;
    }
    deleting_.as(true);
    const request = new Timeless.kit.RequestCore((body) =>
      window.request.post("/api/v1/download_task/delete", body),
    );
    const result = await request.run({
      task_ids: ids,
      delete_files: Boolean(delete_files_.value),
    });
    deleting_.as(false);
    if (result && result.error) {
      toast(result.error.message || "删除下载任务失败");
      return null;
    }
    ui.deleteConfirmDialog$.hide();
    delete_task_ids_.as([]);
    return load(page_.value);
  }

  async function load_transcript(content, force) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return null;
    const sequence = ++transcript_sequence;
    const title = String(content.title || "文案提取").trim() || "文案提取";
    transcript_content_id_.as(id);
    transcript_title_.as(title);
    transcript_text_.as("");
    transcript_path_.as("");
    transcript_message_.as(
      force ? "正在重新提取文案…" : "正在查找本地音视频…",
    );
    transcript_busy_.as(true);
    set_transcript_job(id, "loading");
    ui.btn_transcript_copy$.disable();
    ui.btn_transcript_rerun$.disable();
    ui.transcriptDialog$.show();

    try {
      const detail_response = await fetch(
        `/api/content/detail?id=${encodeURIComponent(id)}`,
      );
      const detail_payload = await detail_response.json();
      if (sequence !== transcript_sequence) return detail_payload;
      if (!detail_payload || detail_payload.code !== 0) {
        throw new Error(
          (detail_payload && detail_payload.msg) || "内容详情加载失败",
        );
      }
      const detail = detail_payload.data || {};
      const resource = pick_media_resource(detail);
      if (!resource) {
        transcript_message_.as("这条内容没有已下载的本地音视频，请先下载。");
        transcript_busy_.as(false);
        set_transcript_job(id, "empty");
        ui.btn_transcript_rerun$.enable();
        return null;
      }
      const media_path = String(
        first_non_empty(resource.local_path, resource.LocalPath),
      ).trim();
      transcript_path_.as(media_path);
      transcript_message_.as(
        force
          ? "正在重新识别并整理文案，长视频可能需要几分钟…"
          : "正在识别并整理文案。如果之前提取过，会直接打开已保存的文案。",
      );
      const response = await fetch(`${task_console_origin()}/api/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: media_path, force: Boolean(force) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== transcript_sequence) return payload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `文案提取失败（${response.status}）`);
      }
      transcript_text_.as(String(payload.text || ""));
      transcript_action_label_.as("重新提取");
      transcript_message_.as(String(payload.message || "文案已就绪"));
      transcript_busy_.as(false);
      set_transcript_job(id, "ready");
      ui.btn_transcript_copy$.enable();
      ui.btn_transcript_rerun$.enable();
      return payload;
    } catch (error) {
      if (sequence !== transcript_sequence) return null;
      const message = error && error.message ? error.message : String(error);
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(message);
      transcript_action_label_.as("重新提取");
      transcript_message_.as(
        offline
          ? "任务服务没有在运行。文案提取需要本机任务页保持启动。"
          : message,
      );
      transcript_busy_.as(false);
      set_transcript_job(id, "error");
      ui.btn_transcript_rerun$.enable();
      return null;
    }
  }

  function set_reverse_job(id, status) {
    if (!id) return;
    const jobs = { ...(reverse_jobs_.value || {}) };
    if (status) jobs[id] = status;
    else delete jobs[id];
    reverse_jobs_.as(jobs);
  }

  function stop_reverse_poll() {
    if (reverse_timer) window.clearInterval(reverse_timer);
    reverse_timer = null;
  }

  function apply_reverse_status(payload, sequence, id) {
    if (sequence !== reverse_sequence) return;
    if (!payload || payload.ok === false || payload.status === "error") {
      stop_reverse_poll();
      reverse_text_.as("");
      reverse_message_.as(
        (payload && (payload.message || payload.error)) || "视频反推失败",
      );
      reverse_action_label_.as("重新反推");
      set_reverse_job(id, "error");
      ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.disable();
      ui.btn_reverse_rerun$.enable();
      if (remake_fill_from_reverse) {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(
          (payload && (payload.message || payload.error)) || "视频反推失败",
        );
        sync_remake_run_button();
      }
      return;
    }
    if (payload.status === "running") {
      reverse_message_.as(payload.message || "正在反推视频…");
      set_reverse_job(id, "loading");
      ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.disable();
      ui.btn_reverse_rerun$.disable();
      if (remake_fill_from_reverse) {
        remake_reverse_label_.as("反推中");
        remake_shot_busy_.as(true);
        remake_shot_phase_.as("reverse");
        remake_shot_message_.as(payload.message || "正在视频反推…");
        remake_message_.as(payload.message || "正在视频反推…");
        sync_remake_run_button();
      }
      return;
    }
    if (payload.status === "ready") {
      stop_reverse_poll();
      const preview = String(payload.text || "");
      reverse_text_.as(preview);
      reverse_action_label_.as("重新反推");
      reverse_message_.as(payload.message || "视频反推完成");
      set_reverse_job(id, "ready");
      if (preview.trim()) ui.btn_reverse_copy$.enable();
      else ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.enable();
      ui.btn_reverse_rerun$.enable();
      ui.btn_remake_reverse_report$.enable();
      const remake_source = String(remake_source_.value || "").trim();
      const reverse_source = String(reverse_path_.value || "").trim();
      if (
        remake_fill_from_reverse ||
        (remake_source && reverse_source && remake_source === reverse_source)
      ) {
        remake_prompt_.as(preview);
      }
      if (remake_fill_from_reverse) {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(payload.message || "视频反推完成。");
        remake_message_.as(payload.message || "视频反推完成。");
        sync_remake_run_button();
      }
      return;
    }
    stop_reverse_poll();
    reverse_text_.as("");
    reverse_action_label_.as("开始反推");
    reverse_message_.as(payload.message || "点击「开始反推」开始拆解这条视频。");
    set_reverse_job(id, "");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.enable();
  }

  async function refresh_reverse(sequence, id) {
    const source = String(reverse_path_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_reverse_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== reverse_sequence) return null;
      stop_reverse_poll();
      reverse_action_label_.as("重新反推");
      reverse_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      set_reverse_job(id, "error");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  function watch_reverse(id) {
    stop_reverse_poll();
    const sequence = reverse_sequence;
    reverse_timer = window.setInterval(() => {
      refresh_reverse(sequence, id);
    }, 2500);
  }

  async function begin_reverse(id, media_path, force) {
    const sequence = ++reverse_sequence;
    reverse_path_.as(media_path);
    reverse_text_.as("");
    set_reverse_job(id, "loading");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.disable();
    reverse_message_.as(force ? "正在重新反推…" : "正在查找已有反推结果…");
    try {
      if (!force) {
        const lookup = await fetch(
          `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(media_path)}`,
        );
        const found = await lookup.json().catch(() => ({}));
        if (sequence !== reverse_sequence) return found;
        if (found && (found.status === "ready" || found.status === "running" || found.status === "error" || found.ok === false)) {
          apply_reverse_status(found, sequence, id);
          if (found.status === "running") watch_reverse(id);
          return found;
        }
      }
      reverse_message_.as("正在准备反推…");
      const response = await fetch(`${task_console_origin()}/api/video-reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: media_path,
          force: Boolean(force),
          use_vlm: reverse_vlm_.value !== false,
          vlm_images: reverse_vlm_frames_.value === "all" ? 0 : 3,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== reverse_sequence) return payload;
      apply_reverse_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_reverse(id);
      return payload;
    } catch (error) {
      if (sequence !== reverse_sequence) return null;
      const message = error && error.message ? error.message : String(error);
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(message);
      stop_reverse_poll();
      reverse_message_.as(
        offline
          ? "任务服务没有在运行。视频反推需要本机任务页保持启动。"
          : message,
      );
      reverse_action_label_.as("重新反推");
      set_reverse_job(id, "error");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  async function preview_reverse(id, media_path) {
    const sequence = ++reverse_sequence;
    reverse_path_.as(media_path);
    reverse_action_label_.as("开始反推");
    reverse_message_.as("点击「开始反推」开始拆解这条视频。");
    try {
      const lookup = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(media_path)}`,
      );
      const found = await lookup.json().catch(() => ({}));
      if (sequence !== reverse_sequence) return found;
      if (
        found &&
        (found.status === "ready" ||
          found.status === "running" ||
          found.status === "error" ||
          found.ok === false)
      ) {
        apply_reverse_status(found, sequence, id);
        if (found.status === "running") watch_reverse(id);
        return found;
      }
      ui.btn_reverse_rerun$.enable();
      return found;
    } catch (_error) {
      if (sequence !== reverse_sequence) return null;
      reverse_action_label_.as("开始反推");
      reverse_message_.as("点击「开始反推」开始拆解这条视频。");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  async function open_reverse(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return null;
    if (reverse_jobs_.value[id] === "loading") {
      ui.reverseDialog$.show();
      if (!reverse_timer) watch_reverse(id);
      return null;
    }
    stop_reverse_poll();
    const title = String((content && content.title) || "视频反推").trim() || "视频反推";
    reverse_content_id_.as(id);
    reverse_title_.as(title);
    reverse_text_.as("");
    reverse_path_.as("");
    reverse_action_label_.as("开始反推");
    reverse_message_.as("点击「开始反推」开始拆解这条视频。");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.disable();
    ui.reverseDialog$.show();
    try {
      const detail = await fetch_content_detail(id);
      if (String(reverse_content_id_.value || "") !== id) return null;
      const resource = pick_media_resource(detail);
      const media_path = String(
        first_non_empty(
          resource && resource.local_path,
          resource && resource.LocalPath,
        ),
      ).trim();
      if (!media_path) {
        reverse_message_.as("这条内容没有已下载的本地视频，请先下载。");
        set_reverse_job(id, "empty");
        return null;
      }
      return preview_reverse(id, media_path);
    } catch (error) {
      reverse_action_label_.as("重新反推");
      reverse_message_.as(error && error.message ? error.message : "读取本地视频失败");
      set_reverse_job(id, "error");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  function rerun_reverse() {
    const id = String(reverse_content_id_.value || "").trim();
    const media_path = String(reverse_path_.value || "").trim();
    if (!id || !media_path) return null;
    const again = reverse_action_label_.value === "重新反推";
    return begin_reverse(id, media_path, again);
  }

  function open_reverse_report() {
    const media_path = String(reverse_path_.value || "").trim();
    if (!media_path) return null;
    const url = `${task_console_origin()}/api/video-reverse/report?path=${encodeURIComponent(media_path)}`;
    window.open(url, "_blank", "noopener");
    return true;
  }

  function open_remake_reverse_report() {
    const media_path = String(
      remake_source_.value || reverse_path_.value || "",
    ).trim();
    if (!media_path) return null;
    reverse_path_.as(media_path);
    const url = `${task_console_origin()}/api/video-reverse/report?path=${encodeURIComponent(media_path)}`;
    window.open(url, "_blank", "noopener");
    return true;
  }

  async function refresh_remake_reverse_report(media_path) {
    const path = String(media_path || remake_source_.value || "").trim();
    if (!path) {
      ui.btn_remake_reverse_report$.disable();
      return false;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(path)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (payload && payload.status === "ready") {
        reverse_path_.as(path);
        reverse_text_.as(String(payload.text || ""));
        remake_prompt_.as(String(payload.text || ""));
        ui.btn_remake_reverse_report$.enable();
        return true;
      }
      ui.btn_remake_reverse_report$.disable();
      return false;
    } catch (_error) {
      ui.btn_remake_reverse_report$.disable();
      return false;
    }
  }

  function set_remake_job(id, status) {
    if (!id) return;
    const jobs = { ...(remake_jobs_.value || {}) };
    if (status) jobs[id] = status;
    else delete jobs[id];
    remake_jobs_.as(jobs);
  }

  function stop_remake_poll() {
    if (remake_timer) window.clearTimeout(remake_timer);
    remake_timer = null;
  }

  function normalize_remake_reference(ready) {
    const current = {
      source: true,
      white: false,
      whiteReady: false,
      ...(remake_reference_.value || {}),
    };
    current.source = current.source !== false;
    if (!["hailuo", "hailuo-2-3", "buming-h3", "wan-3-0", "mu-video"].includes(current.model)) current.model = "mu-video";
    if (typeof ready === "boolean") current.whiteReady = ready;
    if (!current.whiteReady) current.white = false;
    return current;
  }

  function apply_remake_white_ready(ready) {
    remake_reference_.as(normalize_remake_reference(Boolean(ready)));
  }

  async function refresh_remake_white(source) {
    const path = String(source || "").trim();
    if (!path) {
      apply_remake_white_ready(false);
      return false;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/white-model?path=${encodeURIComponent(path)}`,
      );
      const payload = await response.json().catch(() => ({}));
      const ready = Boolean(payload && payload.ok && payload.status === "ready");
      apply_remake_white_ready(ready);
      return ready;
    } catch (_error) {
      apply_remake_white_ready(false);
      return false;
    }
  }

  function remake_request_flags() {
    const selected = normalize_remake_reference();
    if (
      selected.model === "hailuo" ||
      selected.model === "buming-h3" ||
      selected.model === "wan-3-0"
    ) {
      return {
        model: selected.model,
        use_original: Boolean(selected.source),
        use_white: Boolean(selected.white && selected.whiteReady),
      };
    }
    return {
      model: selected.model === "hailuo-2-3" ? "hailuo-2-3" : "mu-video",
      use_original: false,
      use_white: false,
    };
  }

  function sync_remake_run_button() {
    const running = remake_progress_.value >= 0 && remake_progress_.value < 100;
    const source_ready = Boolean(String(remake_source_.value || "").trim());
    const shot_busy = Boolean(remake_shot_busy_.value);
    if (running || !source_ready || shot_busy) ui.btn_remake_run$.disable();
    else ui.btn_remake_run$.enable();
    if (running || !source_ready || shot_busy) ui.btn_remake_prompt$.disable();
    else ui.btn_remake_prompt$.enable();
  }

  function white_model_output_path(source) {
    const path = String(source || "");
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return `${slash >= 0 ? path.slice(0, slash + 1) : ""}${stem}.whitemodel.mp4`;
  }

  function apply_remake_status(payload, sequence, id) {
    if (sequence !== remake_sequence) return;
    if (payload && typeof payload.prompt === "string" && payload.prompt) {
      remake_prompt_.as(payload.prompt);
    }
    if (!payload || payload.ok === false || payload.status === "error") {
      const message = (payload && (payload.explanation || payload.error)) || "视频复刻失败";
      remake_error_.as(message);
      remake_message_.as(message);
      remake_progress_.as(-1);
      set_remake_job(id, "error");
      sync_remake_run_button();
      return;
    }
    if (payload.status === "running") {
      remake_message_.as(payload.message || "正在生成 5 秒预览…");
      remake_progress_.as(Number(payload.progress) || 0);
      set_remake_job(id, payload.mode === "prompt" ? "" : "loading");
      ui.btn_remake_prompt$.disable();
      ui.btn_remake_run$.disable();
      ui.btn_remake_download$.disable();
      return;
    }
    if (payload.status === "prompt") {
      remake_message_.as(payload.message || "提示词已写好");
      remake_progress_.as(-1);
      set_remake_job(id, "");
      sync_remake_run_button();
      return;
    }
    if (payload.status === "ready" && payload.path) {
      remake_path_.as(payload.path);
      remake_url_.as(`${file_href(payload.path, false)}&t=${Date.now()}`);
      remake_message_.as(payload.message || "5 秒预览已生成");
      remake_progress_.as(-1);
      set_remake_job(id, "ready");
      ui.btn_remake_download$.enable();
      sync_remake_run_button();
      return;
    }
    remake_message_.as(payload.message || "可先视频反推，再按镜生图。");
    remake_progress_.as(-1);
    set_remake_job(id, "");
    sync_remake_run_button();
  }

  async function refresh_remake(sequence, id) {
    const source = String(remake_source_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_remake_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== remake_sequence) return null;
      remake_message_.as("任务服务没有在运行。视频复刻需要本机任务页保持启动。");
      return null;
    }
  }

  function watch_remake(id) {
    stop_remake_poll();
    const tick = async () => {
      const sequence = remake_sequence;
      const payload = await refresh_remake(sequence, id);
      if (sequence !== remake_sequence) return;
      if (payload && payload.status === "running") {
        remake_timer = window.setTimeout(tick, 2000);
      }
    };
    remake_timer = window.setTimeout(tick, 2000);
  }

  function shot_caption(frame) {
    const time = Number(frame && frame.time);
    const clock = Number.isFinite(time) ? `${time.toFixed(1)} 秒` : "";
    const label = String((frame && frame.label) || "").trim();
    if (label && label !== clock) return clock ? `${clock} ${label}` : label;
    return clock || label || "关键帧";
  }

  function is_weak_story_prompt(text) {
    const raw = String(text || "").trim();
    return !raw || raw.startsWith("按参考图重绘这一镜头的分镜静帧");
  }

  function story_image_label(model) {
    const key = String(model || "").trim();
    if (key === "seedream") return "Seedream 5.0";
    if (key === "gt-image" || key === "gt-image-2" || key === "gpt-image-2") {
      return "GT Image 2";
    }
    if (key === "mu-image") return "MU 生图";
    if (key === "mj-img" || key === "mj") return "MJ";
    return "GT Image 2";
  }

  function is_pull_shot_message(text) {
    const raw = String(text || "").trim();
    if (!raw) return false;
    if (
      /分镜图已|分镜视频|提示词已|花费\s*¥|正在用|DeepSeek|MU 生图|Seedream|动态提示词|已从视频反推填充/.test(
        raw,
      )
    ) {
      return false;
    }
    return /抽出|拉片|情节|画面变化|没有文案|没有配置|反推/.test(raw);
  }

  function set_story_row_status(shotId, status) {
    const target = String(shotId || "").trim();
    const note = String(status || "").trim();
    if (!target || !note) return;
    remake_shot_frames = (remake_shot_frames || []).map((frame) => {
      if (String(frame.id || "") !== target) return frame;
      return { ...frame, status: note };
    });
  }

  function show_remake_shots(frames, selectedId) {
    const selected = String(selectedId || "");
    const busy_id = String(remake_story_busy_id_.value || "");
    remake_shot_frames = Array.isArray(frames) ? frames : [];
    remake_shots_.as(
      remake_shot_frames.map((frame) => {
        const picture = String(frame.path || "");
        return {
          id: String(frame.id || ""),
          path: picture,
          url: picture ? `${file_href(picture, false)}&t=${Date.now()}` : "",
          caption: shot_caption(frame),
          selected: String(frame.id || "") === selected,
        };
      }),
    );
    remake_story_rows_.as(
      remake_shot_frames.map((frame) => {
        const id = String(frame.id || "");
        const picture = String(frame.path || "");
        const generated = String(frame.generated || "").trim();
        const video = String(frame.video || "").trim();
        const saved = String(frame.prompt || "").trim();
        const saved_video = String(frame.video_prompt || "").trim();
        const raw_status = String(frame.status || "").trim();
        const status = /分镜脚本已写好/.test(raw_status) ? "" : raw_status;
        const saved_script = String(frame.script || "").trim();
        if (saved && !is_weak_story_prompt(saved)) {
          remake_story_prompts[id] = saved;
        } else if (saved && is_weak_story_prompt(remake_story_prompts[id] || "")) {
          remake_story_prompts[id] = "";
        } else if (!(id in remake_story_prompts)) {
          remake_story_prompts[id] = is_weak_story_prompt(saved) ? "" : saved;
        }
        if (saved_video) {
          remake_story_video_prompts[id] = saved_video;
        } else if (!(id in remake_story_video_prompts)) {
          remake_story_video_prompts[id] = remake_story_prompts[id] || "";
        }
        if (saved_script) {
          remake_story_scripts[id] = saved_script;
        } else if (!(id in remake_story_scripts)) {
          remake_story_scripts[id] = "";
        }
        if (!(id in remake_story_use_refs)) {
          remake_story_use_refs[id] = true;
        }
        const prompt = remake_story_prompts[id] || "";
        const video_prompt = remake_story_video_prompts[id] || "";
        const shot_script = remake_story_scripts[id] || "";
        const use_ref = remake_story_use_refs[id] !== false;
        const version = [
          prompt.length,
          prompt.slice(0, 16),
          video_prompt.length,
          video_prompt.slice(0, 16),
          generated ? "1" : "0",
          video ? "1" : "0",
          status.length,
          status.slice(0, 16),
          shot_script.length,
          shot_script.slice(0, 16),
          use_ref ? "1" : "0",
        ].join(":");
        return {
          id,
          rowKey: `${id}:${version}`,
          path: picture,
          url: picture ? `${file_href(picture, false)}&t=${Date.now()}` : "",
          caption: shot_caption(frame),
          prompt,
          videoPrompt: video_prompt,
          generated,
          generatedUrl: generated
            ? `${file_href(generated, false)}&t=${Date.now()}`
            : "",
          video,
          videoUrl: video ? `${file_href(video, false)}&t=${Date.now()}` : "",
          status,
          script: shot_script,
          useRef: use_ref,
          busy: Boolean(busy_id && busy_id === id),
        };
      }),
    );
  }

  function update_remake_story_script(shotId, script) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_scripts[id] = String(script || "");
    remake_shot_frames = (remake_shot_frames || []).map((frame) => {
      if (String(frame.id || "") !== id) return frame;
      return { ...frame, script: remake_story_scripts[id] };
    });
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_scripts[id];
        return {
          ...row,
          script: next,
          rowKey: `${id}:s:${String(next.length)}:${next.slice(0, 24)}`,
        };
      }),
    );
  }

  function update_remake_story_prompt(shotId, prompt) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_prompts[id] = String(prompt || "");
    if (!String(remake_story_video_prompts[id] || "").trim()) {
      remake_story_video_prompts[id] = remake_story_prompts[id];
    }
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_prompts[id];
        const video_prompt = remake_story_video_prompts[id] || "";
        return {
          ...row,
          prompt: next,
          videoPrompt: video_prompt,
          rowKey: `${id}:${String(next.length)}:${next.slice(0, 16)}:${String(video_prompt.length)}`,
        };
      }),
    );
  }

  function update_remake_story_video_prompt(shotId, prompt) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_video_prompts[id] = String(prompt || "");
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_video_prompts[id];
        return {
          ...row,
          videoPrompt: next,
          rowKey: `${id}:v:${String(next.length)}:${next.slice(0, 24)}`,
        };
      }),
    );
  }

  function open_remake_board(board) {
    const url = String((board && board.url) || "").trim();
    if (!url) return;
    remake_board_preview_.as({
      url,
      path: String((board && board.path) || "").trim(),
      caption: String((board && board.caption) || "").trim(),
      kind: String((board && board.kind) || "").trim() === "video" ? "video" : "image",
    });
  }

  function close_remake_board() {
    remake_board_preview_.as(null);
  }

  function save_remake_board() {
    const board = remake_board_preview_.value;
    if (!board) return false;
    const path = String(board.path || "").trim();
    if (path) {
      download_href(path);
      return true;
    }
    const url = String(board.url || "").trim();
    if (!url) return false;
    let href = url;
    try {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set("download", "1");
      href = parsed.toString();
    } catch (_error) {
      href = url.includes("download=1")
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}download=1`;
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  async function refresh_remake_shots(path) {
    remake_shot_id_.as("");
    show_remake_shots([], "");
    remake_shot_message_.as("拉片后关键帧会留在这里，点一张可放大查看；生图参考用分镜表中的参考图。");
    const source = String(path || "").trim();
    if (!source) return;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/shots?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) return;
      if (String(remake_source_.value || "") !== source) return;
      show_remake_shots(payload.frames || [], "");
      if (typeof payload.script === "string") {
        remake_story_script_.as(payload.script);
      }
      if (payload.message && is_pull_shot_message(payload.message)) {
        remake_shot_message_.as(payload.message);
      } else if ((payload.frames || []).length) {
        remake_shot_message_.as("点关键帧可放大查看；生成分镜图时用表中参考图。");
      }
    } catch (_error) {
      remake_shot_message_.as("拉片记录暂时读不出来。");
    }
  }

  async function run_remake_shots() {
    const source = String(remake_source_.value || "").trim();
    if (!source || remake_shot_busy_.value) return null;
    const mode = remake_shot_mode_.value === "plot" ? "plot" : "scene";
    remake_shot_phase_.as("shots");
    remake_shot_busy_.as(true);
    sync_remake_run_button();
    remake_shot_message_.as(mode === "plot" ? "正在按情节拉片…" : "正在按画面拉片…");
    Object.keys(remake_story_prompts).forEach((key) => {
      delete remake_story_prompts[key];
    });
    Object.keys(remake_story_video_prompts).forEach((key) => {
      delete remake_story_video_prompts[key];
    });
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: source, mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "拉片失败");
        return payload;
      }
      if (String(remake_source_.value || "") !== source) return payload;
      remake_shot_id_.as("");
      show_remake_shots(payload.frames || [], "");
      remake_shot_message_.as(payload.message || "拉片完成。点关键帧可放大查看；生图用表中参考图。");
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。拉片需要本机任务页保持启动。");
      return null;
    } finally {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      sync_remake_run_button();
    }
  }

  async function poll_remake_storyboard(source, shotId) {
    const target = String(shotId || "").trim();
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (String(remake_source_.value || "") !== source) return payload;
      if (payload && typeof payload.script === "string") {
        remake_story_script_.as(payload.script);
      }
      if (payload && Array.isArray(payload.frames)) {
        Object.keys(remake_story_prompts).forEach((key) => {
          delete remake_story_prompts[key];
        });
        Object.keys(remake_story_video_prompts).forEach((key) => {
          delete remake_story_video_prompts[key];
        });
        (payload.frames || []).forEach((frame) => {
          const id = String((frame && frame.id) || "");
          const text = String((frame && frame.prompt) || "").trim();
          const video_text = String((frame && frame.video_prompt) || "").trim();
          if (id && text && !is_weak_story_prompt(text)) {
            remake_story_prompts[id] = text;
          }
          if (id && video_text) {
            remake_story_video_prompts[id] = video_text;
          }
        });
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      if (payload && payload.status === "running") {
        remake_story_busy_id_.as(String(payload.shot_id || target));
        const mode = String((payload && payload.mode) || "");
        remake_shot_phase_.as(
          mode === "prompt"
            ? "story-prompt"
            : mode === "script"
              ? "story-script"
              : mode === "video"
                ? "story-video"
                : "story",
        );
        const running_note =
          payload.message ||
          (mode === "prompt"
            ? "正在用 DeepSeek 写分镜提示词…"
            : mode === "video"
              ? `正在生成第 ${target} 镜视频…`
              : `正在用 ${story_image_label(remake_story_model_.value)} 生成第 ${target} 镜…`);
        set_story_row_status(payload.shot_id || target, running_note);
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        window.setTimeout(() => poll_remake_storyboard(source, target), 2000);
        return payload;
      }
      const phase = String(remake_shot_phase_.value || "");
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      const failed = (Array.isArray(payload && payload.jobs) ? payload.jobs : []).find(
        (job) => {
          if (!job || job.status !== "error") return false;
          const sid = String(job.shot_id || "").trim();
          if (target && sid && sid !== target) return false;
          const mode = String(job.mode || "");
          if (phase === "story-video") return mode === "video";
          if (phase === "story-script") return mode === "script";
          if (phase === "story-prompt") return mode === "prompt";
          return mode === "image" || !mode;
        },
      );
      if (failed) {
        const err = String(failed.error || failed.message || "生成失败");
        set_story_row_status(failed.shot_id || target, err);
        remake_shot_message_.as(err);
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      const done_mode = String((payload && payload.mode) || "");
      if (done_mode === "script") {
        const shot = String((payload && payload.shot_id) || target || "").trim();
        if (shot) {
          set_story_row_status(shot, "");
        } else {
          remake_shot_frames = (remake_shot_frames || []).map((frame) => ({
            ...frame,
            status: /分镜脚本|写分镜脚本/.test(String(frame.status || ""))
              ? ""
              : frame.status,
          }));
        }
        if (payload && payload.error) {
          remake_shot_message_.as(payload.error);
        } else if (payload && payload.message) {
          remake_shot_message_.as(payload.message);
        }
      } else {
        const done_note =
          (payload && (payload.message || payload.error)) ||
          (done_mode === "prompt"
            ? "分镜提示词已写好。"
            : done_mode === "video"
              ? `第 ${target} 镜视频已生成。`
              : `第 ${target} 镜分镜图已生成。`);
        set_story_row_status(
          payload && payload.shot_id ? payload.shot_id : target,
          done_note,
        );
      }
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return payload;
    } catch (_error) {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      set_story_row_status(target, "任务服务没有在运行。生成分镜图需要本机任务页保持启动。");
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return null;
    }
  }

  async function run_remake_story_script(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || remake_shot_busy_.value) return null;
    if (!(remake_shot_frames || []).length) {
      remake_shot_message_.as("先拉片，再生成分镜脚本。");
      return null;
    }
    remake_shot_phase_.as("story-script");
    remake_shot_busy_.as(true);
    remake_story_busy_id_.as(target);
    sync_remake_run_button();
    const writing_note = target
      ? `正在写第 ${target} 镜分镜脚本…`
      : "正在按镜头批量写分镜脚本…";
    if (target) set_story_row_status(target, writing_note);
    remake_shot_message_.as(writing_note);
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-script`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            note: String(remake_note_.value || "").trim(),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_story_busy_id_.as("");
        sync_remake_run_button();
        remake_shot_message_.as((payload && payload.error) || "写分镜脚本失败");
        return payload;
      }
      if (typeof payload.script === "string" && payload.script.trim()) {
        remake_story_script_.as(payload.script);
      }
      return poll_remake_storyboard(source, target);
    } catch (_error) {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      remake_shot_message_.as("任务服务没有在运行。写分镜脚本需要本机任务页保持启动。");
      return null;
    }
  }

  async function run_remake_story_prompts(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || remake_shot_busy_.value) return null;
    if (!(remake_shot_frames || []).length) {
      remake_shot_message_.as("先拉片，再写分镜提示词。");
      return null;
    }
    remake_shot_phase_.as("story-prompt");
    remake_shot_busy_.as(true);
    remake_story_busy_id_.as(target);
    sync_remake_run_button();
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    remake_shot_message_.as(
      target
        ? `正在用 DeepSeek 写第 ${target} 镜提示词…`
        : "正在用 DeepSeek 为每镜写专业提示词…",
    );
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-prompts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            note: String(remake_note_.value || "").trim(),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_story_busy_id_.as("");
        sync_remake_run_button();
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        remake_shot_message_.as((payload && payload.error) || "写分镜提示词失败");
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target);
    } catch (_error) {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      remake_shot_message_.as("任务服务没有在运行。写提示词需要本机任务页保持启动。");
      return null;
    }
  }

  async function run_remake_storyboard(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || !target || remake_shot_busy_.value) return null;
    remake_shot_phase_.as("story");
    remake_shot_busy_.as(true);
    remake_story_busy_id_.as(target);
    sync_remake_run_button();
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    const draft = String(remake_story_prompts[target] || "").trim();
    const picked = String(remake_story_model_.value || "").trim();
    const image_model =
      picked === "seedream"
        ? "seedream"
        : picked === "mj-img" || picked === "mj"
          ? "mj-img"
          : picked === "mu-image" || picked === "muse-image"
            ? "mu-image"
            : "gt-image";
    remake_shot_message_.as(
      is_weak_story_prompt(draft)
        ? `正在用 DeepSeek 写第 ${target} 镜专业提示词，再生成…`
        : `正在用 ${story_image_label(image_model)} 生成第 ${target} 镜…`,
    );
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: source,
          shot_id: target,
          prompt: draft,
          note: String(remake_note_.value || "").trim(),
          image_model,
          reference_ids: (remake_story_refs_.value || []).filter((item) => item && item.selected !== false).map((item) => item.id),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_story_busy_id_.as("");
        sync_remake_run_button();
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        remake_shot_message_.as((payload && payload.error) || "生成分镜图失败");
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target);
    } catch (_error) {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      remake_shot_message_.as("任务服务没有在运行。生成分镜图需要本机任务页保持启动。");
      return null;
    }
  }

  async function run_remake_story_video(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || !target || remake_shot_busy_.value) return null;
    const frame = (remake_shot_frames || []).find(
      (item) => String(item.id || "") === target,
    );
    const draft = String(
      remake_story_scripts[target] || (frame && frame.script) || "",
    ).trim();
    if (!draft) {
      remake_shot_message_.as("先生成分镜脚本。");
      return null;
    }
    if (!frame || !String(frame.generated || "").trim()) {
      remake_shot_message_.as("先生成这一镜的分镜图；视频默认用结果图作参考。");
      return null;
    }
    const selected = remake_reference_.value || {};
    const video_model = String(selected.model || "mu-video");
    remake_shot_phase_.as("story-video");
    remake_shot_busy_.as(true);
    remake_story_busy_id_.as(target);
    sync_remake_run_button();
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    remake_shot_message_.as(`正在生成第 ${target} 镜视频…`);
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            prompt: draft,
            note: String(remake_note_.value || "").trim(),
            video_model,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_story_busy_id_.as("");
        sync_remake_run_button();
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        remake_shot_message_.as((payload && payload.error) || "生成分镜视频失败");
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target);
    } catch (_error) {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_id_.as("");
      sync_remake_run_button();
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      remake_shot_message_.as("任务服务没有在运行。生成分镜视频需要本机任务页保持启动。");
      return null;
    }
  }

  function pick_remake_shot(shot) {
    const id = String((shot && shot.id) || "").trim();
    if (!id) return false;
    remake_shot_id_.as(id);
    show_remake_shots(remake_shot_frames, id);
    return true;
  }

  function remake_page_href(options = {}) {
    const page = new URL(window.location.href);
    page.pathname = "/remake";
    page.search = "";
    page.hash = "";
    const id = String(options.id || "").trim();
    const media_path = String(options.path || "").trim();
    const title = String(options.title || "").trim();
    if (id) page.searchParams.set("id", id);
    if (media_path) page.searchParams.set("path", media_path);
    if (title) page.searchParams.set("title", title);
    return page.toString();
  }

  function seed_auth_for_new_tab() {
    const key = "vf-auth-user";
    try {
      let user = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!user && window.top && window.top !== window) {
        try {
          user =
            window.top.sessionStorage.getItem(key) ||
            window.top.localStorage.getItem(key);
        } catch (_error) {
          /* ignore cross-frame access */
        }
      }
      if (user) {
        localStorage.setItem(key, user);
        sessionStorage.setItem(key, user);
      }
    } catch (_error) {
      /* ignore storage access */
    }
  }

  function open_remake_window(options = {}) {
    seed_auth_for_new_tab();
    const href = remake_page_href(options);
    // 不用 noopener：新标签要继承登录态，否则 index.html 会踢到 /login
    window.open(href, "_blank");
    return href;
  }

  async function open_remake(content) {
    const id = String(first_non_empty(content && content.id, "")).trim();
    if (!id) return null;
    const title = String((content && content.title) || "视频复刻").trim() || "视频复刻";
    try {
      const detail = await fetch_content_detail(id);
      const resource = pick_media_resource(detail);
      const media_path = String(
        first_non_empty(resource && resource.local_path, resource && resource.LocalPath),
      ).trim();
      open_remake_window({ id, path: media_path, title });
      return true;
    } catch (error) {
      toast(error && error.message ? error.message : "读取本地视频失败");
      return null;
    }
  }

  async function fill_remake_from_reverse() {
    const source = String(remake_source_.value || "").trim();
    if (!source) return null;
    remake_shot_busy_.as(true);
    remake_shot_phase_.as("reverse");
    remake_reverse_label_.as("反推中");
    sync_remake_run_button();
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/from-reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: source }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "按反推拆分镜头失败");
        remake_message_.as((payload && payload.error) || "按反推拆分镜头失败");
        return payload;
      }
      Object.keys(remake_story_prompts).forEach((key) => {
        delete remake_story_prompts[key];
      });
      Object.keys(remake_story_video_prompts).forEach((key) => {
        delete remake_story_video_prompts[key];
      });
      remake_shot_id_.as("");
      show_remake_shots(payload.frames || [], "");
      remake_shot_message_.as("点关键帧可放大查看；生成分镜图时用表中参考图。");
      remake_message_.as("可先视频反推，再按镜生图。");
      ui.btn_remake_reverse_report$.enable();
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。按反推拆分镜头需要本机任务页保持启动。");
      remake_message_.as("任务服务没有在运行。按反推拆分镜头需要本机任务页保持启动。");
      return null;
    } finally {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_reverse_label_.as("视频反推");
      sync_remake_run_button();
    }
  }

  async function run_remake_reverse() {
    const id = String(remake_content_id_.value || "").trim();
    const source = String(remake_source_.value || "").trim();
    if (!id || !source || remake_shot_busy_.value) return null;
    remake_fill_from_reverse = true;
    remake_reverse_label_.as("反推中");
    remake_shot_busy_.as(true);
    remake_shot_phase_.as("reverse");
    remake_error_.as("");
    remake_shot_message_.as("正在拆镜头（不看图写提示词）…");
    remake_message_.as("正在拆镜头（不看图写提示词）…");
    sync_remake_run_button();
    // 复刻反推只拆镜头/声音，不走 VLM 写提示词。
    reverse_vlm_.as(false);
    reverse_vlm_frames_.as("3");
    try {
      const payload = await begin_reverse(id, source, true);
      if (!payload || payload.ok === false || payload.status === "error") {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(
          (payload && (payload.error || payload.message)) || "视频反推失败",
        );
        sync_remake_run_button();
      }
      return payload;
    } catch (_error) {
      remake_fill_from_reverse = false;
      remake_reverse_label_.as("视频反推");
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_shot_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      remake_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      sync_remake_run_button();
      return null;
    }
  }

  async function run_remake() {
    const id = String(remake_content_id_.value || "").trim();
    const source = String(remake_source_.value || "").trim();
    if (!id || !source) return null;
    const flags = remake_request_flags();
    stop_remake_poll();
    const sequence = ++remake_sequence;
    const force = Boolean(remake_url_.value);
    remake_progress_.as(0);
    remake_error_.as("");
    remake_message_.as("正在准备 5 秒预览…");
    set_remake_job(id, "loading");
    ui.btn_remake_run$.disable();
    ui.btn_remake_download$.disable();
    if (force) {
      remake_url_.as("");
      remake_path_.as("");
    }
    const body = new FormData();
    body.append("path", source);
    if (remake_image_file) body.append("image", remake_image_file, remake_image_file.name);
    if (force) body.append("force", "1");
    body.append("model", flags.model);
    body.append("use_original", flags.use_original ? "1" : "0");
    body.append("use_white", flags.use_white ? "1" : "0");
    if (flags.use_white) body.append("reference_path", white_model_output_path(source));
    const note = String(remake_note_.value || "").trim();
    if (note) body.append("note", note.slice(0, 2000));
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake`, {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      apply_remake_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_remake(id);
      return payload;
    } catch (_error) {
      if (sequence !== remake_sequence) return null;
      remake_message_.as("任务服务没有在运行。视频复刻需要本机任务页保持启动。");
      set_remake_job(id, "error");
      sync_remake_run_button();
      return null;
    }
  }

  return { state, ui, methods };
}

export { ContentViewModel, content_type_label, normalize_content_item, normalize_content_list_response };
